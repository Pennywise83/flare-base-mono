import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from "@angular/material/tooltip";
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
import { RewardDistributorNamedInstance } from "app/services/web3/model/reward-distributor-named-instance";
import { TransactionOperationEnum } from "app/services/web3/model/transaction-operation.enum";
import { Web3LoadingTypeEnum } from "app/services/web3/model/web3-loading-type";
import { Web3Service } from "app/services/web3/web3.service";
import { isEmpty, isNotEmpty } from "class-validator";
import { QrCodeModule } from 'ng-qrcode';
import { JazziconModule } from 'ngx-jazzicon';
import { Observable, Subject, takeUntil } from "rxjs";
import { DataProviderExtendedInfo, RewardEpochSettings } from "../../../../../../../libs/commons/src";
import { Reward, UnclaimedReward } from "../../../../../../../libs/commons/src/model/rewards/reward";
import { ClientMessage } from "../model/client-message";
import { WalletBalance } from "../wallet-balance/model/wallet-balance";
import { ClaimRewardsRequest } from "./model/claim-rewards-request";

@Component({
    selector: 'flare-base-wallet-delegations-rewards',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe, QrCodeModule, LoaderComponent,
        FormsModule, MatFormFieldModule, MatInputModule, MatSliderModule, MatSlideToggleModule, MatDialogModule, MatRadioModule, AlertComponent, TimeDiffPipe, MatSlideToggleModule, CountdownComponent, MatTooltipModule],
    providers: [AddressTrimPipe, TimeDiffPipe],
    templateUrl: './wallet-delegations-rewards.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletDelegationsRewardsComponent implements OnInit {
    @Input() network: string;
    @Input() colorScheme: string;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

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
    public time: number;

    public nextRewardEpochCountdown: string;
    @ViewChild('dialogTemplate') dialogTemplate: TemplateRef<any>;
    public dataProvidersData: DataProviderExtendedInfo[] = [];
    public filteredDataProvidersData: DataProviderExtendedInfo[] = [];
    public delegationSlot: number;
    public hideOverDelegated: boolean = true;
    public searchFilter$ = new Subject<any>();
    public searchFilter: string = '';
    public walletBalance: WalletBalance = new WalletBalance();
    public unclaimedRewards: UnclaimedReward[] = [];
    public claimedRewards: Reward[] = [];
    public receiveMode: 'own' | 'other' | 'distributor' = 'own';
    public rewardDistributorNamedInstances: RewardDistributorNamedInstance[] = [];
    public claimRequest: ClaimRewardsRequest = new ClaimRewardsRequest();

    constructor(
        private _web3Service: Web3Service,
        private _epochService: EpochsService,
        private _ftsoService: FtsoService,
        private _timeDiffPipe: TimeDiffPipe,
        private _uiNotificationsService: UiNotificationsService,
        public dialog: MatDialog,
        private _cdr: ChangeDetectorRef) {

    }

    ngOnInit(): void {
        this.initializeComponent();
        this._web3Service.loading$.pipe(takeUntil(this._unsubscribeAll)).subscribe(isLoading => {
            if (isLoading.type == Web3LoadingTypeEnum.GLOBAL || isLoading.type == Web3LoadingTypeEnum.UNCLAIMED_REWARDS) {
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
            this._cdr.detectChanges();
        });
        this._web3Service.clientConnected$.pipe(takeUntil(this._unsubscribeAll)).subscribe(clientConnected => {
            this.isClientConnected = clientConnected;
            this._cdr.detectChanges();
        });

        this._web3Service.balancesChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(walletBalance => {
            this.walletBalance = walletBalance;
            this._cdr.detectChanges();
        });
        this._web3Service.unclaimedRewardsChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(unclaimedRewards => {
            this.unclaimedRewards = unclaimedRewards;
            this._cdr.detectChanges();
        });
        this._web3Service.rewardDistributorNamedInstancesChange$.pipe(takeUntil(this._unsubscribeAll)).subscribe(rewardDistributorNamedInstances => {
            this.rewardDistributorNamedInstances = rewardDistributorNamedInstances;
            this._cdr.detectChanges();
        });

    }


    private initializeComponent() {
        this._epochService.getRewardEpochSettings(this.network).subscribe(rewardEpochSettings => {
            this.rewardEpochSettings = rewardEpochSettings;
            this.time = rewardEpochSettings.getEndTimeForEpochId(rewardEpochSettings.getCurrentEpochId());
            this._getDataProvidersData(rewardEpochSettings.getCurrentEpochId()).subscribe(dataProvidersData => {
                this.isClientConnected = this._web3Service.isClientConnected();
                this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
                this.selectedChainId = this._web3Service.getConnectedChain();
                this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
                this.walletBalance = this._web3Service.getBalances();
                this.selectedAddress = this._web3Service.getConnectedAddress();
                this.unclaimedRewards = this._web3Service.getUnclaimedRewards();
                this.rewardDistributorNamedInstances = this._web3Service.getRewardDistributorNamedInstances();
                this._cdr.detectChanges();
            });
        });
    }


    public getClaimableRewardsAmount(claimable: boolean): number {
        if (isNotEmpty(this.unclaimedRewards)) {
            return [...this.unclaimedRewards.values()]
                .filter(unclaimedReward => unclaimedReward.claimable == claimable)
                .reduce((acc, unclaimedReward) => acc + unclaimedReward.amount, 0);
        } else {
            return 0;
        }
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
    openClaimRewardsDialog(): void {
        this.operation = TransactionOperationEnum.rewardsClaim;
        this.claimRequest.receiver = this.selectedAddress;
        this.unclaimedRewards.filter(ur => ur.claimable).map(ur => this.claimRequest.rewardEpochIds.push(ur.rewardEpochId));
        this.receiveMode = 'own';
        this.clientMessage.reset();
        this.dialog.open(this.dialogTemplate, {
            disableClose: true,
            width: '800px'
        }).afterClosed().subscribe(() => {

        })
    }

    toggleWrapRewards(change: MatSlideToggleChange): void {
        this.claimRequest.wrap = change.checked;
        this._cdr.detectChanges();
    }

    setReceiveMode(receiveMode: 'own' | 'other' | 'distributor'): void {
        if (receiveMode == 'own') {
            this.claimRequest.receiver = this.selectedAddress;
        } else if (receiveMode == 'other') {
            this.claimRequest.receiver = '';
        } else if (receiveMode == 'distributor') {
            this.claimRequest.receiver = '';
        }
        this._cdr.detectChanges();
    }
    claimRewards(claimRewardsRequest: ClaimRewardsRequest): void {
        this.operation = TransactionOperationEnum.submitting;
        this.unclaimedRewards.map(ur => this.claimRequest.rewardEpochIds.push(ur.rewardEpochId));
        this._web3Service.claimRewards(this.selectedAddress, claimRewardsRequest).subscribe(res => {
            if (res.operation == TransactionOperationEnum.transacting) {
                this.operation = TransactionOperationEnum.transacting;
            } else if (res.operation == TransactionOperationEnum.confirmed) {
                this.clientMessage = new ClientMessage('Transaction successfull', 'Rewards succesfully claimed.', res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'primary');
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

    isWalletConnected(): boolean {
        return (this.isClientConnected && this.selectedChainId != null && this.isSmartContractsInitialized && typeof this.selectedAddress != 'undefined' && this.selectedAddress != null);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(true);
        this._unsubscribeAll.complete();
    }
}