import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from "@angular/material/input";
import { MatSliderModule } from '@angular/material/slider';
import { AppModule } from "app/app.module";
import { AlertComponent } from "app/commons/alert";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { TransactionOperationEnum } from "app/services/web3/model/transaction-operation.enum";
import { Web3LoadingTypeEnum } from "app/services/web3/model/web3-loading-type";
import { Web3Service } from "app/services/web3/web3.service";
import { QrCodeModule } from 'ng-qrcode';
import { JazziconModule } from 'ngx-jazzicon';
import { Subject, debounceTime, takeUntil } from "rxjs";
import { ClientMessage } from "../model/client-message";
import { WalletBalance } from "../wallet-balance/model/wallet-balance";
import { WrapDetails } from "./model/wrap-details";

@Component({
    selector: 'flare-base-wallet-wrap',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe, QrCodeModule, LoaderComponent,
        FormsModule, MatFormFieldModule, MatInputModule, MatSliderModule, MatDialogModule, AlertComponent],
    providers: [AddressTrimPipe],
    templateUrl: './wallet-wrap.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletWrapComponent implements OnInit {
    @Input() colorScheme: string;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    isClientConnected: boolean = false;
    isSmartContractsInitialized: boolean = false;
    selectedChainId: number;
    selectedChain: IChainDefinition;
    selectedAddress: string;
    loading: boolean = false;
    public clientMessage: ClientMessage = new ClientMessage()
    public wrapDetails: WrapDetails = new WrapDetails();
    public walletBalance: WalletBalance = new WalletBalance();
    public intermediateAmount: number = 0;
    public intermediateAmountChange$ = new Subject<any>();
    public isWrap: boolean = true;
    public operations = TransactionOperationEnum;
    public operation: TransactionOperationEnum;
    @ViewChild('dialogTemplate') dialogTemplate: TemplateRef<any>;
    constructor(
        private _web3Service: Web3Service,
        private _uiNotificationsService: UiNotificationsService,
        public dialog: MatDialog,
        private _cdr: ChangeDetectorRef) {

    }



    ngOnInit(): void {
        this.isClientConnected = this._web3Service.isClientConnected();
        this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
        this.selectedChainId = this._web3Service.getConnectedChain();
        this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
        this.selectedAddress = this._web3Service.getConnectedAddress();
        this.walletBalance = this._web3Service.getBalances();
        this.intermediateAmount = 0;
        this.updateIntermediateBalances();
        this.handleSliderChanges(0);
        this._cdr.detectChanges();


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
            this.intermediateAmount = 0;
            this.updateIntermediateBalances();
            this.handleSliderChanges(0);
            this._cdr.detectChanges();
        });
        this.intermediateAmountChange$.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(250)
        ).subscribe((intermediateAmount: any) => {
            this.handleSliderChanges(parseFloat(intermediateAmount.value));
            this._cdr.detectChanges();
        });
    }

    updateIntermediateBalances() {
        this.wrapDetails = new WrapDetails();
        this.wrapDetails.nativeIntermediateAmount = this.walletBalance.nativeTokenBalance;
        this.wrapDetails.wrappedIntermediateAmount = this.walletBalance.wrappedTokenBalance;
        this._cdr.detectChanges();
    }

    public handleSliderChanges(value: number) {
        if (this.isWrap) {
            this.wrapDetails.nativeIntermediateAmount = this.walletBalance.nativeTokenBalance - value;
            this.wrapDetails.wrappedIntermediateAmount = this.walletBalance.wrappedTokenBalance + value;
        } else {

            this.wrapDetails.nativeIntermediateAmount = this.walletBalance.nativeTokenBalance + value;
            this.wrapDetails.wrappedIntermediateAmount = this.walletBalance.wrappedTokenBalance - value;

        }
        this.intermediateAmount = value;
        this.wrapDetails.nativeIntermediatePercentage = (this.wrapDetails.nativeIntermediateAmount * 100) / (this.wrapDetails.wrappedIntermediateAmount + this.wrapDetails.nativeIntermediateAmount);
        this.wrapDetails.wrappedIntermediatePercentage = (this.wrapDetails.wrappedIntermediateAmount * 100) / (this.wrapDetails.nativeIntermediateAmount + this.wrapDetails.wrappedIntermediateAmount);
        this._cdr.detectChanges();
    }

    getBalances(): void {
        this._web3Service.fetchBalances(this.selectedAddress).subscribe(walletBalance => {
            this.walletBalance = walletBalance;
            this.intermediateAmount = 0;
            this.updateIntermediateBalances();
            this._cdr.detectChanges();
        }, balancesErr => {
            this._uiNotificationsService.error(`Unable to get balances`, balancesErr);
        })
    }
    swap(): void {
        this.isWrap = !this.isWrap;
        this.updateIntermediateBalances();
        this.handleSliderChanges(this.intermediateAmount);
        this._cdr.detectChanges();
    }
    openWrapDialog(operation: TransactionOperationEnum) {
        this.operation = operation;
        this.clientMessage.reset();

        if (operation == TransactionOperationEnum.wrap && (this.walletBalance.nativeTokenBalance - this.intermediateAmount) < 2) {
            this.clientMessage = new ClientMessage('Be careful', 'You are delegating almost the entire balance. Please, make sure to leave some native tokens in your balance in order to have enough liquidity to sign the transactions.', null, 'warning');
        }
        this._cdr.detectChanges();
        this.dialog.open(this.dialogTemplate, {
            disableClose: true
        }).afterClosed().subscribe(() => {
            this.getBalances();
        })
    }
    wrap(): void {
        this.operation = TransactionOperationEnum.submitting;
        this._web3Service.wrap(this.intermediateAmount).subscribe(res => {
            if (res.operation == TransactionOperationEnum.transacting) {
                this.operation = TransactionOperationEnum.transacting;
            } else if (res.operation == TransactionOperationEnum.confirmed) {
                this.clientMessage = new ClientMessage('Transaction successfull', 'Wrap operation done.', res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'primary');
                this.operation = TransactionOperationEnum.confirmed;
            } else {
                this.operation = res.operation;
                this.clientMessage = new ClientMessage('Transaction failed', res.message, res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'danger');
            }
        })
    }
    unwrap(): void {
        this.operation = TransactionOperationEnum.submitting;
        this._web3Service.unwrap(this.intermediateAmount).subscribe(res => {
            if (res.operation == TransactionOperationEnum.transacting) {
                this.operation = TransactionOperationEnum.transacting;
            } else if (res.operation == TransactionOperationEnum.confirmed) {
                this.clientMessage = new ClientMessage('Transaction successfull', 'Unwrap operation done.', res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'primary');
                this.operation = TransactionOperationEnum.confirmed;
            } else {
                this.operation = res.operation;
                this.clientMessage = new ClientMessage('Transaction failed', res.message, res.txId != null ? `${this.selectedChain.blockExplorerUrls[0]}tx/${res.txId}` : null, 'danger');
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