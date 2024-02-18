import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppModule } from "app/app.module";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { Web3LoadingTypeEnum } from "app/services/web3/model/web3-loading-type";
import { Web3Service } from "app/services/web3/web3.service";
import { QrCodeModule } from 'ng-qrcode';
import { JazziconModule } from 'ngx-jazzicon';
import { Subject, takeUntil } from "rxjs";
import { WalletBalance } from "./model/wallet-balance";
import { isNotEmpty } from "class-validator";

@Component({
    selector: 'flare-base-wallet-balance',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe, QrCodeModule, LoaderComponent],
    providers: [AddressTrimPipe],
    templateUrl: './wallet-balance.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletBalanceComponent implements OnInit, OnChanges {
    @Input() network: string;
    @Input() colorScheme: string;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    loading: boolean = false;
    isClientConnected: boolean = false;
    isSmartContractsInitialized: boolean = false;
    selectedChainId: number;
    selectedChain: IChainDefinition;
    selectedAddress: string;
    qrColors: { light: any, dark: any } = { light: '#fff', dark: '#0F172A' };
    public walletBalance: WalletBalance = new WalletBalance();
    constructor(
        private _web3Service: Web3Service,
        private _uiNotificationsService: UiNotificationsService,
        private _cdr: ChangeDetectorRef) {

    }

    ngOnInit(): void {
        this.isClientConnected = this._web3Service.isClientConnected();
        this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
        this.selectedChainId = this._web3Service.getConnectedChain();
        this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
        this.selectedAddress = this._web3Service.getConnectedAddress();
        this.walletBalance = this._web3Service.getBalances();
        this._cdr.detectChanges();

        this._web3Service.loading$.pipe(takeUntil(this._unsubscribeAll)).subscribe(isLoading => {
            if (isLoading.type == Web3LoadingTypeEnum.GLOBAL || isLoading.type == Web3LoadingTypeEnum.BALANCES) {
                this.loading = isLoading.loading;
                    this._cdr.detectChanges();
            }
        });
        this._web3Service.balancesChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(walletBalance => {
            this.walletBalance = walletBalance;
            this._cdr.detectChanges();
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

    }


    isWalletConnected(): boolean {
        return (this.isClientConnected && this.selectedChainId != null && this.isSmartContractsInitialized && typeof this.selectedAddress != 'undefined' && this.selectedAddress != null);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.colorScheme && (changes.colorScheme.currentValue != changes.colorScheme.previousValue)) {
            if (changes.colorScheme.currentValue == 'light') {
                this.qrColors.light = '#FFF';
                this.qrColors.dark = '#0F172A';
            } else {
                this.qrColors.light = '#0F172A';
                this.qrColors.dark = '#E2E8F0';
            }
            this._cdr.detectChanges();
        }
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(true);
        this._unsubscribeAll.complete();
    }
}