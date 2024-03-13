import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { AppModule } from "app/app.module";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { ConfigService } from "app/services/config";
import { MediaWatcherService } from "app/services/media-watcher";
import { Web3Service } from "app/services/web3/web3.service";
import { isEmpty } from "class-validator";
import { JazziconModule } from 'ngx-jazzicon';
import { MatomoTracker } from 'ngx-matomo';
import { Subject, combineLatest, map, takeUntil } from "rxjs";
import { WalletBalanceComponent } from "../wallet-balance/wallet-balance.component";
import { WalletDelegationsRewardsComponent } from "../wallet-claimed-rewards/wallet-delegations-rewards.component";
import { WalletDelegationsComponent } from "../wallet-delegations/wallet-delegations.component";
import { WalletWrapComponent } from "../wallet-wrap/wallet-wrap.component";
import { Commons } from "../../../../../../../libs/commons/src";

@Component({
    selector: 'flare-base-wallet-dashboard',
    imports: [AppModule, MatButtonModule, MatIconModule, UiNotificationsModule, JazziconModule, AddressTrimPipe,
        WalletBalanceComponent, WalletWrapComponent, WalletDelegationsComponent, WalletDelegationsRewardsComponent],
    providers: [AddressTrimPipe],
    templateUrl: './wallet-dashboard.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletDashboardComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    network: string;
    colorScheme: string;
    isWeb3ClientInstalled: boolean = false;
    walletConnected: boolean;
    address: string;
    loading: boolean = true;
    unsubscribeAll: Subject<any> = new Subject<any>();
    isClientConnected: boolean;
    chainId: number;
    isSmartContractsInitialized: boolean = false;


    constructor(
        private _configService: ConfigService,
        private _mediaWatcherService: MediaWatcherService,
        private _route: ActivatedRoute,
        private _web3Service: Web3Service,
        private _uiNotificationsService: UiNotificationsService,
        private _cdr: ChangeDetectorRef,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker) {

    }
    isWalletConnected(): boolean {
        return (this.isClientConnected && this.chainId != null && this.isSmartContractsInitialized && typeof this.address != 'undefined' && this.address != null);
    }
    ngOnDestroy(): void {
    }
    ngOnInit(): void {
        Utils.getParentParams(this._route).pipe(
            takeUntil(this.unsubscribeAll))
            .subscribe(async params => {
                this._parentParams = { ...this._parentParams, ...params };
                if (isEmpty(this._parentParams['network'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    this.loading = false;
                    return;
                }
                this.network = this._parentParams['network'];
                Commons.setPageTitle(`Flare Base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Wallet`, this._titleService, this._matomoTracker)

                combineLatest([
                    this._configService.config$,
                    this._mediaWatcherService.onMediaQueryChange$(['(prefers-color-scheme: dark)', '(prefers-color-scheme: light)'])
                ]).pipe(
                    takeUntil(this.unsubscribeAll),
                    map(([config, mediaQueryChange]) => {
                        if (config.scheme === 'auto') {
                            this.colorScheme = mediaQueryChange.breakpoints['(prefers-color-scheme: dark)'] ? 'dark' : 'light';
                        } else {
                            this.colorScheme = config.scheme;
                        }

                    })
                ).subscribe(() => {
                    this.isClientConnected = this._web3Service.isClientConnected();
                    this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
                    this.chainId = this._web3Service.getConnectedChain();
                    this.address = this._web3Service.getConnectedAddress();
                    this._cdr.detectChanges();
                })
            });
    }
}