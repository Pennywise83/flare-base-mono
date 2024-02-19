import { ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from "@angular/material/menu";
import { Router } from "@angular/router";
import { AppModule } from "app/app.module";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { Web3LoadingTypeEnum } from "app/services/web3/model/web3-loading-type";
import { Web3Service } from "app/services/web3/web3.service";
import { JazziconModule } from 'ngx-jazzicon';
import { Subject, concatMap, takeUntil } from "rxjs";
import { NetworkEnum } from "../../../../../../../libs/commons/src";

@Component({
    selector: 'flare-base-wallet-button',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe, MatMenuModule, ClipboardModule, MatDividerModule],
    providers: [AddressTrimPipe],
    templateUrl: './wallet-button.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Default
})
export class WalletButtonComponent implements OnInit, OnChanges {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @Input() network: string;
    @Input() isScreenSmall: boolean;
    isWeb3ClientInstalled: boolean = false;
    isSmartContractsInitialized: boolean = false;
    isClientConnected: boolean;
    selectedAddress: string;
    selectedChainId: number;
    selectedChain: IChainDefinition;
    loading: boolean = true;

    constructor(
        private _web3Service: Web3Service,
        private _uiNotificationsService: UiNotificationsService,
        private _router: Router,
        private _cdr: ChangeDetectorRef) {

    }

    connectWeb3Client(): void {
        this._web3Service.connectWeb3Client(NetworkEnum[this.network]).subscribe(res => {
        }, err => {
            this._uiNotificationsService.error('Unable to connect wallet', err.message);
            this._cdr.detectChanges();
        })
    }
    disconnectWeb3Client(): void {
        this._web3Service.clientConnected$.next(false);
        this._cdr.detectChanges();
    }

    isWalletConnected(): boolean {
        return (this.isClientConnected && this.selectedChainId != null && this.isSmartContractsInitialized && typeof this.selectedAddress != 'undefined' && this.selectedAddress != null);
    }
    switchNetwork() {
        let network: string = this.selectedChain.network;
        const currentUrl = this._router.url;
        const segments = currentUrl.split('/');
        let parsedSegments: string[] = [];
        segments.map(segment => {
            parsedSegments.push(segment.split('?')[0]);
        })
        parsedSegments[1] = network;
        parsedSegments.splice(0, 1);
        this._router.navigate(parsedSegments);
        this.network = network;
    }
    ngOnInit(): void {
        this._web3Service.checkMetamaskProvider().subscribe(web3ClientInstalled => {
            this.isWeb3ClientInstalled = web3ClientInstalled;
            if (this.isWeb3ClientInstalled) {
                this._web3Service.checkIfIsConnected().subscribe(clientConnected => {
                    this.isClientConnected = clientConnected;
                    this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
                    this.selectedChainId = this._web3Service.getConnectedChain();
                    this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
                    this.selectedAddress = this._web3Service.getConnectedAddress();
                    if (this.isWalletConnected()) {
                        this._web3Service.fetchBalances(this.selectedAddress).pipe(
                            concatMap(() => this._web3Service.fetchDelegatesOf(this.selectedAddress)),
                            concatMap(() => this._web3Service.fetchUnclaimedRewards(this.selectedAddress)),
                            concatMap(() => this._web3Service.fetchRewardDistributorNamedInstances(this.selectedAddress))
                        ).subscribe(() => {
                            this._cdr.detectChanges();
                        });
                    }
                }, clientErr => {
                    this._uiNotificationsService.error(`Unable to check if Web3 Client is connected`, clientErr, 10_000);
                    return;
                });
            }
        }, web3ClientInstalledErr => {
            this._uiNotificationsService.error(`Unable to check Web3 Client availability`, web3ClientInstalledErr);
            return;
        });

        this._web3Service.addressChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(addressChanged => {
            this.selectedAddress = addressChanged;
            if (this.isWalletConnected()) {
                this._web3Service.fetchBalances(this.selectedAddress).pipe(
                    concatMap(() => this._web3Service.fetchDelegatesOf(this.selectedAddress)),
                    concatMap(() => this._web3Service.fetchUnclaimedRewards(this.selectedAddress)),
                    concatMap(() => this._web3Service.fetchRewardDistributorNamedInstances(this.selectedAddress))
                ).subscribe(() => {
                    this._cdr.detectChanges();
                });
            }

        });
        this._web3Service.chainIdChanged$.pipe(takeUntil(this._unsubscribeAll)).subscribe(chainChanged => {
            this.selectedChainId = chainChanged;
            this.selectedChain = availableChains.find(chain => chain.chainId == chainChanged);
            if (this.isWalletConnected()) {
                this.switchNetwork();
            }
            this._cdr.detectChanges();
        });
        this._web3Service.clientConnected$.pipe(takeUntil(this._unsubscribeAll)).subscribe(clientConnected => {
            this.isClientConnected = clientConnected;
            this._cdr.detectChanges();
        });
        this._web3Service.smartContractsInitialized$.pipe(takeUntil(this._unsubscribeAll)).subscribe(smartContractsInitialized => {
            this.isSmartContractsInitialized = smartContractsInitialized;
            this._cdr.detectChanges();
        });
        this._web3Service.loading$.pipe(takeUntil(this._unsubscribeAll)).subscribe(isLoading => {
            if (isLoading.type == Web3LoadingTypeEnum.GLOBAL) {
                this.loading = isLoading.loading;
                this._cdr.detectChanges();
            }
        });

    }
    ngOnChanges(changes: SimpleChanges): void {
        if (changes.network && !changes.network.isFirstChange() && changes.network.currentValue != changes.network.previousValue && this.isClientConnected) {
            if (this.isWalletConnected()) {
                this._web3Service.connectWeb3Client(NetworkEnum[this.network]).subscribe(res => {
                }, err => {
                    this._uiNotificationsService.error(`Unable to change network for Web3 Client`, err, 10_000);
                })
            }
        }
    }

    public getSeed(input: string): number {
        return Number(input) / 10000000000000000000000000000000;
    }

}