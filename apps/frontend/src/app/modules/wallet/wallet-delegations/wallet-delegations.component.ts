import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from "@angular/material/input";
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { AppModule } from "app/app.module";
import { AlertComponent } from "app/commons/alert";
import { CountdownComponent } from "app/commons/countdown/countdown.component";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { TransactionOperationEnum } from "app/services/web3/model/transaction-operation.enum";
import { Web3LoadingTypeEnum } from "app/services/web3/model/web3-loading-type";
import { Web3Service } from "app/services/web3/web3.service";
import { isEmpty, isNotEmpty } from "class-validator";
import { QrCodeModule } from 'ng-qrcode';
import { JazziconModule } from 'ngx-jazzicon';
import { Observable, Subject, debounceTime, merge, takeUntil } from "rxjs";
import { Commons, DataProviderExtendedInfo, RewardEpochSettings } from "../../../../../../../libs/commons/src";
import { ClientMessage } from "../model/client-message";
import { WalletBalance } from "../wallet-balance/model/wallet-balance";
import { DelegatesOf } from "./model/delegates-of";
import { DelegatesOfRequest } from "./model/delegates-of-request";

@Component({
    selector: 'flare-base-wallet-delegations',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe, QrCodeModule, LoaderComponent,
        FormsModule, MatFormFieldModule, MatInputModule, MatSliderModule, MatDialogModule, AlertComponent, TimeDiffPipe, MatSlideToggleModule, CountdownComponent],
    providers: [AddressTrimPipe, TimeDiffPipe],
    templateUrl: './wallet-delegations.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletDelegationsComponent implements OnInit {
    @Input() network: string;
    @Input() colorScheme: string;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    private _unsubscribePartial: Subject<any> = new Subject<any>();

    public isClientConnected: boolean = false;
    public isSmartContractsInitialized: boolean = false;
    public selectedChainId: number;
    public selectedChain: IChainDefinition;
    public selectedAddress: string;
    public loading: boolean = false;
    public dataProvidersLoading: boolean = false;
    public rewardEpochSettings: RewardEpochSettings;
    public clientMessage: ClientMessage = new ClientMessage()
    public operations = TransactionOperationEnum;
    public operation: TransactionOperationEnum;

    public delegations: Map<number, DelegatesOf> = new Map();
    public delegateRequest: Map<number, DelegatesOfRequest> = new Map();
    @ViewChild('dialogTemplate') dialogTemplate: TemplateRef<any>;
    public dataProvidersData: DataProviderExtendedInfo[] = [];
    public filteredDataProvidersData: DataProviderExtendedInfo[] = [];
    public delegationSlot: number;
    public hideOverDelegated: boolean = true;
    public searchFilter$ = new Subject<any>();
    public searchFilter: string = '';
    public walletBalance: WalletBalance = new WalletBalance();
    public hasBatchDelegate: boolean = false;

    constructor(
        private _web3Service: Web3Service,
        private _epochService: EpochsService,
        private _ftsoService: FtsoService,
        private _uiNotificationsService: UiNotificationsService,
        public dialog: MatDialog,
        private _cdr: ChangeDetectorRef) {

    }
    ngOnInit(): void {
        this.initializeComponent();
        this._web3Service.loading$.pipe(takeUntil(this._unsubscribeAll)).subscribe(isLoading => {
            if (isLoading.type == Web3LoadingTypeEnum.GLOBAL || isLoading.type == Web3LoadingTypeEnum.BALANCES) {
                this.loading = isLoading.loading;
                this._cdr.detectChanges();
            }
        });
        this._web3Service.addressChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(addressChanged => {
            this.selectedAddress = addressChanged;
            this._cdr.detectChanges();
        });
        this._web3Service.chainIdChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(chainChanged => {
            this.selectedChainId = chainChanged;
            this.selectedChain = availableChains.find(chain => chain.chainId == chainChanged);
            if (this.isWalletConnected()) {
                this.initializeComponent();
            }
            this._cdr.detectChanges();
        });
        this._web3Service.smartContractsInitialized$.pipe(takeUntil(this._unsubscribeAll)).subscribe(smartContractsInitialized => {
            this.isSmartContractsInitialized = smartContractsInitialized;
            this.hasBatchDelegate = this._web3Service.hasBatchDelegate();
            this._cdr.detectChanges();
        });
        this._web3Service.clientConnected$.pipe(takeUntil(this._unsubscribeAll)).subscribe(clientConnected => {
            this.isClientConnected = clientConnected;
            this._cdr.detectChanges();
        });
        this._web3Service.delegatesOfChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(delegatesOf => {
            this.delegations = delegatesOf;
            this._cdr.detectChanges();
        });
        this._web3Service.balancesChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(walletBalance => {
            this.walletBalance = walletBalance;
            this._cdr.detectChanges();
        });

    }


    private initializeComponent() {
        this._unsubscribePartial.next(true);
        this.delegations.set(0, new DelegatesOf('', 0));
        this.delegations.set(1, new DelegatesOf('', 0));
        this._epochService.getRewardEpochSettings(this.network).subscribe(rewardEpochSettings => {
            this.rewardEpochSettings = rewardEpochSettings;
            this._getDataProvidersData(rewardEpochSettings.getCurrentEpochId()).subscribe(dataProvidersData => {
                this.isClientConnected = this._web3Service.isClientConnected();
                this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
                this.selectedChainId = this._web3Service.getConnectedChain();
                this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
                this.delegations = this._web3Service.getDelegatesOf();
                this.walletBalance = this._web3Service.getBalances();
                this.selectedAddress = this._web3Service.getConnectedAddress();
                this.hasBatchDelegate = this._web3Service.hasBatchDelegate();
                this._cdr.detectChanges();
                this.searchFilter$.pipe(
                    takeUntil(merge(this._unsubscribeAll, this._unsubscribePartial)),
                    debounceTime(250)
                ).subscribe((filterValue: any) => {
                    this.searchFilter = filterValue.value ? filterValue.value.toLowerCase() : '';
                    this.applyFilters();
                });
                this.applyFilters();
            });
        });
    }

    addBatchDelegation(delegateRequest: Map<number, DelegatesOf>, remove: boolean): void {
        this.operation = TransactionOperationEnum.submitting;
        if (remove) {
            delegateRequest.has(0) ? delegateRequest.get(0).percentage = 0 : false;
            delegateRequest.has(1) ? delegateRequest.get(1).percentage = 0 : false;
        }
        this._web3Service.batchDelegate(delegateRequest).subscribe(res => {
            if (res.operation == TransactionOperationEnum.transacting) {
                this.operation = TransactionOperationEnum.transacting;
            } else if (res.operation == TransactionOperationEnum.confirmed) {
                this.clientMessage = new ClientMessage('Transaction successfull', 'Delegations succesfully updated.', res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'primary');
                this.operation = TransactionOperationEnum.confirmed;
                this._web3Service.fetchDelegatesOf(this.selectedAddress).subscribe();
                this._web3Service.fetchBalances(this.selectedAddress).subscribe();
                this._cdr.detectChanges();

            } else {
                this.operation = res.operation;
                this.clientMessage = new ClientMessage('Transaction failed', res.message, res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'danger');
                this._cdr.detectChanges();

            }
        })
    }

    addDelegation(delegateRequest: DelegatesOfRequest, remove: boolean): void {
        this.operation = TransactionOperationEnum.submitting;
        if (remove) {
            delegateRequest.percentage = 0;
        }
        this._web3Service.delegate(delegateRequest).subscribe(res => {
            if (res.operation == TransactionOperationEnum.transacting) {
                this.operation = TransactionOperationEnum.transacting;
                this._cdr.detectChanges();
            } else if (res.operation == TransactionOperationEnum.confirmed) {
                let message: string = 'Delegation addedd succesfully.';
                if (delegateRequest.existingDelegation) {
                    message = 'Delegation succesfully updated.'
                }
                if (remove) {
                    message = 'Delegation succesfully removed.';
                }
                this.clientMessage = new ClientMessage('Transaction successfull', message, res.txId != null ? `${this.selectedChain.blockExplorerUrls}tx/${res.txId}` : null, 'info');
                this.operation = TransactionOperationEnum.confirmed;
                this._web3Service.fetchDelegatesOf(this.selectedAddress).subscribe();
                this._web3Service.fetchBalances(this.selectedAddress).subscribe();
                this._cdr.detectChanges();
            } else {
                this.operation = res.operation;
                this.clientMessage = new ClientMessage('Transaction failed', res.message, res.txId != null ? `${this.selectedChain.blockExplorerUrls}tx/${res.txId}` : null, 'error');
                this._cdr.detectChanges();
            }
        });
    }
    public getAllocatedShare(): number {
        if (isNotEmpty(this.delegations)) {
            return [...this.delegations.values()].reduce((acc, delegate) => acc + delegate.percentage, 0);
        } else {
            return 0;
        }
    }
    public getAllocatedValue(): number {
        if (isNotEmpty(this.delegations)) {
            return (this.walletBalance.wrappedTokenBalance / 100) * this.getAllocatedShare();
        } else {
            return 0;
        }
    }
    public getAllocableShare(): number {
        return 100 - this.getAllocatedShare();
    }

    private _getDataProvidersData(rewardEpoch: number): Observable<void> {
        return new Observable<void>(observer => {
            this.dataProvidersLoading = true;
            this._ftsoService.getDataProvidersData(this.network, rewardEpoch).subscribe(dataProvidersData => {
                dataProvidersData.result.filter(dp => dp.icon == null).map(dp => dp.icon = 'assets/images/unknown.png');
                this.dataProvidersData = dataProvidersData.result.filter(dp => dp.whitelisted);
                if (this.hideOverDelegated) {
                    this.filteredDataProvidersData = this.dataProvidersData.filter(dp => dp.votePowerPercentage < 2.5);
                } else {
                    this.filteredDataProvidersData = this.dataProvidersData;
                }
                observer.next();
            }, dataProvidersDataErr => {
                this._uiNotificationsService.error('Unable to fetch data providers data', dataProvidersDataErr);
                observer.error(dataProvidersDataErr);
            }).add(() => {
                this.dataProvidersLoading = false;
                this._cdr.detectChanges();
                observer.complete();
            });
        });
    }
    getDataProviderInfoByAddress(address: string): DataProviderExtendedInfo {
        let dataProviderInfo: DataProviderExtendedInfo =
            this.dataProvidersData.find(d => d.address.toLowerCase() == address.toLowerCase());
        if (!isEmpty(dataProviderInfo)) {
            if (isEmpty(dataProviderInfo.icon)) {
                dataProviderInfo.icon = 'assets/images/unknown.png';
            }
        }
        return dataProviderInfo;
    }
    openDataProvidersDialog(delegationSlot: number, existingDelegation: boolean): void {
        this.operation = TransactionOperationEnum.selectDataProvider;
        this.hideOverDelegated = true;
        this.searchFilter = null;
        this.delegationSlot = delegationSlot;
        this.delegateRequest.set(delegationSlot, this.delegations.has(delegationSlot) ? new DelegatesOfRequest(this.delegations.get(delegationSlot).address, this.delegations.get(delegationSlot).percentage * 100, this.delegations.get(delegationSlot).percentage + this.getAllocableShare(), existingDelegation) : new DelegatesOfRequest('', 0, this.getAllocableShare(), existingDelegation));
        this.clientMessage.reset();
        this.dialog.open(this.dialogTemplate, {
            disableClose: true,
            width: '800px'
        }).afterClosed().subscribe((action) => {
            if (isNotEmpty(action) && action == 'addDelegation') {
                this.delegations.set(this.delegationSlot, this.delegateRequest.get(this.delegationSlot));
            }
            this.delegationSlot = null;
            this.delegateRequest = new Map<number, DelegatesOfRequest>();
            this._cdr.detectChanges();
        });
    }
    openBatchDelegateDialog(remove: boolean): void {
        this.operation = !remove ? TransactionOperationEnum.batchDelegate : TransactionOperationEnum.removeDelegations;
        this.clientMessage.reset();
        this.dialog.open(this.dialogTemplate, {
            disableClose: true,
            width: '800px'
        }).afterClosed().subscribe(() => {
            this.delegationSlot = null;
            this.delegateRequest = new Map<number, DelegatesOfRequest>();

        })
    }



    toggleOverDelegated(change: MatSlideToggleChange): void {
        this.hideOverDelegated = change.checked;
        this.applyFilters();
        this._cdr.detectChanges();
    }
    applyFilters(): void {
        this.filteredDataProvidersData = this.dataProvidersData;
        if (this.hideOverDelegated) {
            this.filteredDataProvidersData = this.filteredDataProvidersData.filter(dp => dp.votePowerPercentage < 2.5);
        }
        if (isNotEmpty(this.searchFilter)) {
            this.filteredDataProvidersData = this.filteredDataProvidersData.filter(dp => (dp.name.toLowerCase().indexOf(this.searchFilter.toLowerCase()) >= 0 || dp.address.toLowerCase().indexOf(this.searchFilter.toLowerCase()) >= 0));
        }

        this.filteredDataProvidersData.filter(dp => dp.name.toLowerCase().indexOf('acdt') >= 0).map(dp => {
            let promotedDataProvider: DataProviderExtendedInfo = Commons.clone(dp);
            this.filteredDataProvidersData.splice(this.filteredDataProvidersData.indexOf(dp), 1);
            this.filteredDataProvidersData.unshift(promotedDataProvider);
        })
        this._cdr.detectChanges();
    }
    isWalletConnected(): boolean {
        return (this.isClientConnected && this.selectedChainId != null && this.isSmartContractsInitialized && typeof this.selectedAddress != 'undefined' && this.selectedAddress != null);
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(true);
        this._unsubscribeAll.complete();
    }
}