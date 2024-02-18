import { DOCUMENT, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Inject, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, NavigationEnd, Router, RouterModule, RouterOutlet } from "@angular/router";
import { AppModule } from "app/app.module";
import { UiNotificationsModule } from "app/commons/ui-notifications/ui-notifications.module";
import { ConfigService } from "app/services/config/config.service";
import { Scheme, UiConfig } from "app/services/config/config.types";
import { EpochsService } from "app/services/epochs.service";
import { MediaWatcherService } from "app/services/media-watcher";
import { HorizontalNavigationComponent, NavigationService, VerticalNavigationComponent } from "app/services/navigation";
import { Navigation } from "app/services/navigation/navigation.types";
import { SplashScreenService } from "app/services/splash-screen";
import { Subject, combineLatest, map, takeUntil } from "rxjs";
import { navigationDefinition } from "../../commons/navigation-definition";
import { WalletButtonComponent } from "../wallet/wallet-button/wallet-button.component";

@Component({
    selector: 'flare-base-main',
    imports: [AppModule, NgIf, MatButtonModule, MatIconModule, RouterOutlet, MatMenuModule, MatFormFieldModule, MatSelectModule, FormsModule,
        VerticalNavigationComponent, HorizontalNavigationComponent, UiNotificationsModule, MatMenuModule, WalletButtonComponent, RouterModule],
    templateUrl: './main.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    isScreenSmall: boolean;
    navigation: Navigation;
    config: UiConfig;
    network: string;
    initialized: boolean = false;
    currentYear: number;
    routerEvents: EventEmitter<string> = new EventEmitter<string>();
    constructor(
        private _router: Router,
        private _route: ActivatedRoute,
        private _mediaWatcherService: MediaWatcherService,
        private _navigationService: NavigationService,
        private _epochService: EpochsService,
        private _splashScreenService: SplashScreenService,
        private _configService: ConfigService,
        private _cdr: ChangeDetectorRef,
        @Inject(DOCUMENT) private _document: any) {

    }


    selectNetwork(networkChange: string) {
        let network: string;
        network = networkChange;
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

    setScheme(scheme: Scheme): void {
        localStorage.setItem('scheme', scheme);
        this._configService.config = { scheme };
        this.config.scheme = scheme;
    }

    toggleNavigation(name: string): void {
        const navigation = this._navigationService.getComponent<VerticalNavigationComponent>(name);
        if (navigation) {
            navigation.toggle();
        }
    }

    ngOnInit(): void {
        this._splashScreenService.show();
        this.currentYear = new Date().getFullYear();
        combineLatest([
            this._configService.config$,
            this._mediaWatcherService.onMediaQueryChange$(['(prefers-color-scheme: dark)', '(prefers-color-scheme: light)']),
            this._mediaWatcherService.onMediaChange$,
        ]).pipe(
            takeUntil(this._unsubscribeAll),
            map(([config, mediaQueryChange, mediaChange]) => {
                this.config = config;
                const options = {
                    scheme: config.scheme,
                    theme: config.theme,
                };
                let localStorageScheme: string = localStorage.getItem('scheme');
                if (localStorageScheme) {
                    options.scheme = localStorageScheme;
                    config.scheme = localStorageScheme;
                }
                this.isScreenSmall = !mediaChange.matchingAliases.includes('md');
                if (config.scheme === 'auto') {
                    // Decide the scheme using the media query
                    options.scheme = mediaQueryChange.breakpoints['(prefers-color-scheme: dark)'] ? 'dark' : 'light';
                }
                this._cdr.detectChanges();
                return options;
            }),
        ).subscribe((options) => {
            this._document.body.classList.remove('light', 'dark');
            this._document.body.classList.add(options.scheme);
            this._cdr.detectChanges();
        });
        this._route.paramMap.subscribe(params => {
            this.network = params.get('network');
            if (this.network) {
                this._epochService.getRewardEpochSettings(this.network).subscribe(() => {
                    (this.navigation as any) = {};
                    this.navigation.default = navigationDefinition[this.network];
                    this._splashScreenService.hide();
                    this.initialized = true;
                    this._cdr.detectChanges();
                });

            }
        });
        this._router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this.routerEvents.emit(event.url);
            }
        });
        const currentUrl = this._router.url;
        this.routerEvents.emit(currentUrl);

    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

}