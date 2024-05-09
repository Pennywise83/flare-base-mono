import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NgDatePickerModule } from "app/commons/ng-datetime-picker/public-api";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { DelegatorsRequest } from "app/model/delegators-request";
import { FeedsRequest } from "app/model/feeds-request";
import { RewardsHistoryRequest } from "app/model/rewards-history-request";
import { TimeRangeDefinition } from "app/model/time-range";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { RewardsHistoryComponent } from "app/modules/data-providers-explorer/rewards-history/rewards-history.component";
import { DataProviderDelegationsComponent } from "app/modules/delegations-explorer/data-provider-delegations/data-provider-delegations.component";
import { VotePowerHistoryComponent } from "app/modules/vote-power-history/votepower-history.component";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { isDefined, isNotEmpty } from "class-validator";
import { isEmpty } from "lodash";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { MatomoTracker } from "ngx-matomo";
import { Observable, Subject, debounceTime, forkJoin, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, NetworkEnum, PriceEpochSettings, RewardEpochSettings } from "../../../../../../../libs/commons/src";
import { DataProviderFeedsComponent } from "../data-provider-feeds/data-provider-feeds.component";
import { DataProviderSectionEnum } from "../model/data-provider-sections.enum";



@Component({
    selector: 'flare-base-data-provider-details',
    templateUrl: './data-providers-details.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, LoaderComponent, MatFormFieldModule, MatInputModule, ShortNumberPipe, TimeDiffPipe, AddressTrimPipe, NgxMatSelectSearchModule, VotePowerHistoryComponent, RewardsHistoryComponent, DataProviderDelegationsComponent, MatDialogModule, MatButtonModule, MatMenuModule, NgDatePickerModule, DataProviderFeedsComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProviderDetailsComponent implements OnInit, OnDestroy {
    private _parentParams: { [param: string]: string };
    network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    section: DataProviderSectionEnum;
    sections = DataProviderSectionEnum;
    loading: boolean;
    selected: { startDate: any, endDate: any };
    rewardEpochSettings: RewardEpochSettings;
    priceEpochSettings: PriceEpochSettings;
    dataProviderInfo: DataProviderInfo[];
    filteredDataProvidersData: DataProviderInfo[] = [];

    selectedProviders: DataProviderInfo[] = [];
    filteredDataProvidersInfo: DataProviderInfo[] = [];
    refreshTimestamp: number;
    address: string;
    feedsRequest: FeedsRequest;
    delegatorsRequest: DelegatorsRequest;
    votePowerRequest: VotePowerHistoryRequest;
    rewardsHistoryRequest: RewardsHistoryRequest;
    selectedTimeRange: TimeRangeDefinition;

    @ViewChild('dialogTemplate') dialogTemplate: TemplateRef<any>;
    searchFilter$ = new Subject<any>();
    searchFilter: string = '';
    comparisonIdx: number;

    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _ftsoService: FtsoService,
        private _titleService: Title,
        public dialog: MatDialog,
        private _matomoTracker: MatomoTracker) {
    }

    ngOnInit(): void {
        this.loading = true;
        Utils.getParentParams(this._route).pipe(
            takeUntil(this._unsubscribeAll))
            .subscribe(async params => {
                this._parentParams = { ...this._parentParams, ...params };
                if (isEmpty(this._parentParams['network'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    return;
                }
                this._parseQueryParams();
                this.selectedProviders = [];
                this._epochsService.getRewardEpochSettings(this.network).subscribe(rewardEpochSettings => {
                    this.rewardEpochSettings = rewardEpochSettings;
                    let targetRewardEpoch: number = this.rewardEpochSettings.getCurrentEpochId();
                    if (this._route.snapshot.queryParamMap.get('endTime')) {
                        targetRewardEpoch = this.rewardEpochSettings.getEpochIdForTime(parseInt(this._route.snapshot.queryParamMap.get('endTime')));
                    }
                    let calls: Observable<PriceEpochSettings | DataProviderInfo[]>[] = [];
                    calls.push(this._epochsService.getPriceEpochSettings(this.network));
                    calls.push(this._ftsoService.getDataProvidersInfo(this.network, targetRewardEpoch));
                    forkJoin(calls).subscribe(res => {
                        this.priceEpochSettings = res[0] as PriceEpochSettings;
                        this.dataProviderInfo = res[1] as DataProviderInfo[];
                        this.filteredDataProvidersData = res[1] as DataProviderInfo[];
                        let startTime: number;
                        let endTime: number;
                        if (!this._route.snapshot.queryParamMap.get('startTime') || !this._route.snapshot.queryParamMap.get('endTime')) {
                            if (targetRewardEpoch == this.rewardEpochSettings.getCurrentEpochId()) {
                                startTime = new Date().getTime() - (60 * 60 * 1000);
                                endTime = new Date().getTime() - 10000;
                            } else {
                                startTime = this.rewardEpochSettings.getEndTimeForEpochId(targetRewardEpoch) - (60 * 60 * 1000);
                                endTime = this.rewardEpochSettings.getEndTimeForEpochId(targetRewardEpoch) - 10000;
                            }
                        } else {
                            startTime = parseInt(this._route.snapshot.queryParamMap.get('startTime'));
                            endTime = parseInt(this._route.snapshot.queryParamMap.get('endTime'));
                        }
                        this.feedsRequest = new FeedsRequest(this.address, startTime, endTime);
                        this.delegatorsRequest = new DelegatorsRequest(this.address, this.rewardEpochSettings.getEpochIdForTime(this.feedsRequest.endTime));
                        this.votePowerRequest = new VotePowerHistoryRequest(this.address, this.feedsRequest.startTime, this.feedsRequest.endTime);
                        this.rewardsHistoryRequest = new RewardsHistoryRequest(this.address, this.feedsRequest.startTime, this.feedsRequest.endTime);
                        if (!isEmpty(this.feedsRequest.address)) {
                            this.feedsRequest.addressList.map((address, idx) => {
                                this.selectedProviders[idx] = this.dataProviderInfo.find(dpInfo => dpInfo.address == address);
                                if (typeof this.selectedProviders[idx] == 'undefined') {
                                    this.selectedProviders[0] = this.dataProviderInfo[Math.floor(Math.random() * this.dataProviderInfo.length)];
                                }
                            });
                            this.address = this.selectedProviders.map(dp => dp.address).join(',');
                        } else {
                            this.selectedProviders[0] = this.dataProviderInfo[Math.floor(Math.random() * this.dataProviderInfo.length)];
                            if (!this.selectedProviders) {
                                (this.selectedProviders as any) = {
                                    address: this.address.toLowerCase(),
                                    name: this.address.toLowerCase()
                                }
                            }
                            this.address = this.selectedProviders[0].address;
                            this.feedsRequest.address = this.selectedProviders[0].address;
                            this.feedsRequest.startTime = this.rewardEpochSettings.getEndTimeForEpochId(targetRewardEpoch) - (60 * 15 * 1000);
                            this.feedsRequest.endTime = this.rewardEpochSettings.getEndTimeForEpochId(targetRewardEpoch);
                        }
                        this.loading = false;
                        this.filteredDataProvidersInfo = this.dataProviderInfo;
                        this._route.params.subscribe(params => {
                            switch (params.section) {
                                default:
                                    this.section = DataProviderSectionEnum.info;
                                    break;
                                case DataProviderSectionEnum.feeds:
                                    this.feedsRequest = new FeedsRequest(this.address, parseInt(this._route.snapshot.queryParamMap.get('startTime')), parseInt(this._route.snapshot.queryParamMap.get('endTime')))
                                    this.feedsRequest.symbol = isDefined(this._route.snapshot.queryParamMap.get('symbol')) ? this._route.snapshot.queryParamMap.get('symbol') : Utils.getChainDefinition(this.network).nativeCurrency.symbol;
                                    Commons.setPageTitle(`Flare base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Data providers explorer - Feeds - ${this.selectedProviders[0].name} -  ${this.feedsRequest.symbol}`, this._titleService, this._matomoTracker);
                                    this.section = DataProviderSectionEnum.feeds;
                                    break;
                                case DataProviderSectionEnum.delegations:
                                    this.delegatorsRequest = new DelegatorsRequest(this.address.split(',')[0], this.rewardEpochSettings.getEpochIdForTime(this.feedsRequest.endTime));
                                    Commons.setPageTitle(`Flare base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Data providers explorer - Delegations - ${this.selectedProviders[0].name}`, this._titleService, this._matomoTracker);
                                    this.section = DataProviderSectionEnum.delegations;
                                    break;
                                case DataProviderSectionEnum.votepower:
                                    this.votePowerRequest = new VotePowerHistoryRequest(this.address, this.rewardEpochSettings.getStartTimeForEpochId(this.rewardEpochSettings.getEpochIdForTime(this.feedsRequest.endTime) - 60), this.feedsRequest.endTime);
                                    this.votePowerRequest.pageSize = 5000;
                                    Commons.setPageTitle(`Flare base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Data providers explorer - Vote power - ${this.selectedProviders[0].name}`, this._titleService, this._matomoTracker);
                                    this.section = DataProviderSectionEnum.votepower;
                                    break;
                                case DataProviderSectionEnum.rewards:
                                    this.rewardsHistoryRequest = new RewardsHistoryRequest(this.address, this.rewardEpochSettings.getStartTimeForEpochId(this.rewardEpochSettings.getEpochIdForTime(this.feedsRequest.endTime) - 60), this.feedsRequest.endTime);
                                    this.rewardsHistoryRequest.pageSize = 5000;
                                    Commons.setPageTitle(`Flare base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Data providers explorer - Rewards history - ${this.selectedProviders[0].name}`, this._titleService, this._matomoTracker);
                                    this.section = DataProviderSectionEnum.rewards;
                                    break;
                            }
                            this.loading = false;
                            this.searchFilter$.pipe(
                                takeUntil(this._unsubscribeAll),
                                debounceTime(250)
                            ).subscribe((filterValue: any) => {
                                this.searchFilter = filterValue.value ? filterValue.value.toLowerCase() : '';
                                this.applyFilters();
                            });
                            this._cdr.detectChanges();
                        });
                    }, err => {
                        this._uiNotificationsService.error(`Unable to initialize component`, err);
                        this.loading = false;
                        return;
                    });
                })
            });
    }
    getDataProviderInfo(address: string): DataProviderInfo {
        let dpInfo: DataProviderInfo = this.dataProviderInfo.find(dpInfo => dpInfo.address == address);
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            return dpInfo;
        }
    }

    filterDataProvider(filter: string): void {
        this.filteredDataProvidersInfo = this.dataProviderInfo.filter(dp => dp.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0 || dp.address.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    }
    handleDataProviderChange(dataProviderAddress: MatSelectChange): void {
        this.selectedProviders[0] = this.dataProviderInfo.find(dp => dp.address == dataProviderAddress.value);
        this.address = this.selectedProviders.map(dp => dp.address).join(',');
        this.feedsRequest.address = this.address;
        this.delegatorsRequest.address = this.feedsRequest.addressList[0];
        this.rewardsHistoryRequest.address = this.feedsRequest.addressList[0];
        if (this.section == this.sections.feeds) {
            this._updateQueryParams();
        } else {
            this.refreshData();
            this._updateQueryParams();
        }


    }
    private _parseQueryParams(): void {
        this.network = NetworkEnum[this._parentParams['network']];
        this.address = this._route.snapshot.queryParamMap.get('address');
    }
    private _updateQueryParams() {
        this._cdr.detectChanges();
        const currentParams = { ...this._route.snapshot.queryParams };
        currentParams['address'] = this.address;
        this._cdr.detectChanges();
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: currentParams,
            preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
    }
    refreshData() {
        this.refreshTimestamp = new Date().getTime();
        this._cdr.detectChanges();
    }
    openDataProvidersDialog(addressIndex: number): void {
        this.comparisonIdx = addressIndex;
        this.searchFilter = null;
        this.dialog.open(this.dialogTemplate, {
            width: '800px'
        }).afterClosed().subscribe((action) => {
            if (isNotEmpty(action)) {
                this.selectedProviders[addressIndex] = action;
                this.feedsRequest.address = this.selectedProviders.map(dp => dp.address).join(',');
                this.address = this.feedsRequest.address;
                this._updateQueryParams();
                this._cdr.detectChanges();
            }
        });
    }
    removeDataProviderFromComparison(addressIndex: number): void {
        delete this.selectedProviders[addressIndex];
        this.feedsRequest.address = this.selectedProviders.map(dp => dp.address).join(',');
        this.address = this.feedsRequest.address;
        this._updateQueryParams();
        this._cdr.detectChanges();
    }
    applyFilters(): void {
        this.filteredDataProvidersData = this.dataProviderInfo;
        if (isNotEmpty(this.searchFilter)) {
            this.filteredDataProvidersData = this.filteredDataProvidersData.filter(dp => (dp.name.toLowerCase().indexOf(this.searchFilter.toLowerCase()) >= 0 || dp.address.toLowerCase().indexOf(this.searchFilter.toLowerCase()) >= 0));
        }

        this.filteredDataProvidersData.map(dp => {
            let promotedDataProvider: DataProviderInfo = Commons.clone(dp);
            this.filteredDataProvidersData.splice(this.filteredDataProvidersData.indexOf(dp), 1);
            this.filteredDataProvidersData.unshift(promotedDataProvider);
        })
        this._cdr.detectChanges();
    }
    navigateTo(section: DataProviderSectionEnum): void {
        const currentParams = { ...this._route.snapshot.queryParams };
        this._cdr.detectChanges();
        this._router.navigate(['', this.network, 'ftso', 'data-providers', section], {
            relativeTo: this._route,
            queryParams: currentParams,
            preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

}