import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { LoadingMap } from "app/model/loading-map";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { RewardsService } from "app/services/rewards.service";
import { isDefined, isEmpty, isNotEmpty, isNumber } from "class-validator";
import { saveAs } from 'file-saver';
import { MatomoTracker } from 'ngx-matomo';
import { Subject, takeUntil } from "rxjs";
import { ClaimedRewardHistogramElement, ClaimedRewardsGroupByEnum, Commons, DataProviderInfo, DelegationsSortEnum, NetworkEnum, PaginatedResult, RewardDTO, SortOrderEnum } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { TimeDiffPipe } from "../../commons/pipes/time-diff.pipe";
import { ClaimedRewardsHistogramRequest, ClaimedRewardsRequest } from "../../model/claimed-rewards-request";
import { ClaimedRewardsChartComponent } from "../claimed-rewards-chart/claimed-rewards-chart.component";
import { ClaimedRewardsTableComponent } from "../claimed-rewards-table/claimed-rewards-table.component";
import { CounterComponent } from "../counter/counter.component";
import { DataProvidersComponent } from "../data-providers/data-providers.component";
import { DelegationsTableComponent } from "../delegations-table/delegations-table.component";


@Component({
    selector: 'flare-base-claimed-rewards-search',
    templateUrl: './claimed-rewards-search.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, CounterComponent,
        LoaderComponent, DataProvidersComponent, MatFormFieldModule, MatInputModule, DelegationsTableComponent, TimeDiffPipe,
        MatMenuModule, DatePipe, MatButtonModule, ClaimedRewardsTableComponent, ClaimedRewardsChartComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [TimeDiffPipe, DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class ClaimedRewardsSearchComponent implements OnInit, OnDestroy {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    tableRequest: ClaimedRewardsRequest;
    histogramGroupBy: ClaimedRewardsGroupByEnum = ClaimedRewardsGroupByEnum.rewardEpochId;
    claimedRewards: PaginatedResult<RewardDTO[]>;
    claimedRewardsDateHistogramData: ClaimedRewardHistogramElement[];
    loadingMap: LoadingMap;
    tableColumns: string[] = ['timestamp', 'rewardEpoch', 'whoClaimed', 'dataProvider', 'sentTo', 'amount'];
    dataProvidersInfo: DataProviderInfo[] = [];
    selectedTimeRangeDefinition: TimeRangeDefinition;
    timeRanges: TimeRangeDefinition[] = [
        new TimeRangeDefinition('lastMonth', 'Last month', (60 * 60 * 24 * 30) * 1000),
        new TimeRangeDefinition('last3Months', 'Last 3 months', ((60 * 60 * 24 * 30) * 3) * 1000),
        new TimeRangeDefinition('last6Months', 'Last 6 months', ((60 * 60 * 24 * 30) * 6) * 1000),
        new TimeRangeDefinition('lastYear', 'Last year', ((60 * 60 * 24 * 30) * 12) * 1000),
        new TimeRangeDefinition('last2Years', 'Last 2 years', ((60 * 60 * 24 * 30) * 12) * 2 * 1000)
    ]

    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _rewardsService: RewardsService,
        private _epochsService: EpochsService,
        private _datePipe: DatePipe,
        private _ftsoService: FtsoService,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker
    ) {
        this.loadingMap = new LoadingMap(this._cdr);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }


    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.tableRequest.startTime = timeRange.start;
        this.tableRequest.endTime = timeRange.end;
        this._updateQueryParams(this.tableRequest).then();
    }
    ngOnInit(): void {
        Utils.getParentParams(this._route).pipe(
            takeUntil(this._unsubscribeAll))
            .subscribe(params => {
                this._parentParams = { ...this._parentParams, ...params };
                if (isEmpty(this._parentParams['network'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    return;
                }
                if (this._parentParams['network'] != this._network) {
                    this._network = NetworkEnum[this._parentParams['network']];
                    this.selectedTimeRangeDefinition = this.timeRanges[0];
                    Commons.setPageTitle(`Flare base - ${this._network.charAt(0).toUpperCase() + this._network.slice(1)} - Claimed rewards search`, this._titleService, this._matomoTracker);
                    this.tableRequest = new ClaimedRewardsRequest(null, null, null, null);
                    this._parseQueryParams();
                    this._route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe(queryParams => {
                        this._parseQueryParams();
                        this.refreshTableData(this.tableRequest);
                        this.refreshChartData(this.tableRequest);
                    });
                }
            });
    }

    exportCsv(): void {
        this.loadingMap.setLoading('tableData', true);
        let startTime: string = this._datePipe.transform(this.tableRequest.startTime, 'YYYY-MM-dd _HH-mm-ss');
        let endTime: string = this._datePipe.transform(this.tableRequest.endTime, 'YYYY-MM-dd_HH-mm-ss');
        this._rewardsService.getClaimedRewardsCsv(this._network, this.tableRequest).subscribe(claimedRewards => {
            saveAs(claimedRewards, `${this._network}-ClaimedRewards-whoClaimed_${this.tableRequest.whoClaimed ? this.tableRequest.whoClaimed : 'all'}-dataProvider_${this.tableRequest.dataProvider ? this.tableRequest.dataProvider : 'all'}-sentTo_${this.tableRequest.sentTo ? this.tableRequest.sentTo : 'all'}-startTime_${startTime}-endTime_${endTime}.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export claimed rewards data', statsErr);
        }).add(() => {
            this.loadingMap.setLoading('tableData', false);
            this._cdr.detectChanges();
        });
    }
    handleRequestEvent(requestEvent: ClaimedRewardsRequest): void {
        this.tableRequest.page = requestEvent.page;
        this.tableRequest.pageSize = requestEvent.pageSize;
        this.tableRequest.sortField = requestEvent.sortField;
        this.tableRequest.sortOrder = requestEvent.sortOrder;
        let currentParams = { ...this._route.snapshot.queryParams };
        currentParams.page = this.tableRequest.page;
        currentParams.pageSize = this.tableRequest.pageSize;
        currentParams.sortField = this.tableRequest.sortField;
        currentParams.sortOrder = this.tableRequest.sortOrder;
        this._updateQueryParams(this.tableRequest);
    }

    submitSearch(): void {
        this._updateQueryParams(this.tableRequest);
    }
    refreshTableData(request: ClaimedRewardsRequest): void {
        this.loadingMap.setLoading('tableData', true);
        this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfoRes => {
            this.dataProvidersInfo = dataProvidersInfoRes;
            this._rewardsService.getClaimedRewards(this._network, request).subscribe(claimedRewardsRes => {
                this.claimedRewards = claimedRewardsRes;
            }, claimedRewardsErr => {
                this._uiNotificationsService.error('Unable to get claimed rewards with provided search', claimedRewardsErr);
            }).add(() => {
                this.loadingMap.setLoading('tableData', false);
                if (this.claimedRewards.numResults > 0 && (this.claimedRewards.page - 1) * this.claimedRewards.pageSize >= this.claimedRewards.numResults) {
                    this.tableRequest.page = 1;
                    this.refreshTableData(this.tableRequest);
                }
            });
        });
    }

    setHistogramGroupBy(groupBy: ClaimedRewardsGroupByEnum): void {
        this.histogramGroupBy = groupBy;
        let currentParams = { ...this._route.snapshot.queryParams };
        currentParams.groupBy = this.histogramGroupBy;
        this._updateQueryParams(this.tableRequest);
        this.refreshChartData(this.tableRequest);
    }
    refreshChartData(request: ClaimedRewardsRequest): void {
        this.loadingMap.setLoading('chartData', true);
        let chartRequest: ClaimedRewardsHistogramRequest = new ClaimedRewardsHistogramRequest(request.whoClaimed, request.dataProvider, request.startTime, request.endTime, this.histogramGroupBy);
        this._cdr.detectChanges();
        this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfoRes => {
            this.dataProvidersInfo = dataProvidersInfoRes;
            this._rewardsService.getClaimedRewardsgetClaimedRewardsDateHistogram(this._network, chartRequest).subscribe(claimedRewardsRes => {
                this.claimedRewardsDateHistogramData = claimedRewardsRes;
            }, claimedRewardsErr => {
                this._uiNotificationsService.error('Unable to get claimed rewards date histogram with provided search', claimedRewardsErr);
            }).add(() => {
                this.loadingMap.setLoading('chartData', false);
            });
        });
    }

    private async _updateQueryParams(request: ClaimedRewardsRequest): Promise<void> {
        var currentParams = { ...this._route.snapshot.queryParams };
        if (isNotEmpty(this.selectedTimeRangeDefinition.id)) {
            currentParams['timeRangeId'] = this.selectedTimeRangeDefinition.id;
        }
        currentParams['whoClaimed'] = request.whoClaimed;
        currentParams['sentTo'] = request.sentTo;
        currentParams['dataProvider'] = request.dataProvider;
        currentParams['startTime'] = request.startTime;
        currentParams['endTime'] = request.endTime;
        currentParams['page'] = request.page;
        currentParams['pageSize'] = request.pageSize;
        currentParams['sortField'] = request.sortField;
        currentParams['sortOrder'] = request.sortOrder;
        currentParams['groupBy'] = this.histogramGroupBy;
        this._cdr.detectChanges();
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: currentParams, preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
        return;
    }
    private _parseQueryParams(): void {
        let startTime: number = this.timeRanges[0].getTimeRange().start;
        let endTime: number = this.timeRanges[0].getTimeRange().end;
        if (isDefined(this._route.snapshot.queryParamMap.get('timeRangeId'))) {
            let inputTimeRangeDef: TimeRangeDefinition = this.timeRanges.find(tr => tr.id == this._route.snapshot.queryParamMap.get('timeRangeId'));
            if (isNotEmpty(inputTimeRangeDef)) {
                this.selectedTimeRangeDefinition = inputTimeRangeDef;
                startTime = inputTimeRangeDef.getTimeRange().start;
                endTime = inputTimeRangeDef.getTimeRange().end;
            } else {
                if (isDefined(this._route.snapshot.queryParamMap.get('startTime')) && isNumber(this._route.snapshot.queryParamMap.get('startTime'))) {
                    startTime = parseInt(this._route.snapshot.queryParamMap.get('startTime'));
                }
                if (isDefined(this._route.snapshot.queryParamMap.get('endTime')) && isNumber(this._route.snapshot.queryParamMap.get('endTime'))) {
                    endTime = parseInt(this._route.snapshot.queryParamMap.get('endTime'));
                }
            }
        } else {
            if (isDefined(this._route.snapshot.queryParamMap.get('startTime')) && isNumber(this._route.snapshot.queryParamMap.get('startTime'))) {
                startTime = parseInt(this._route.snapshot.queryParamMap.get('startTime'));
            }
            if (isDefined(this._route.snapshot.queryParamMap.get('endTime')) && isNumber(this._route.snapshot.queryParamMap.get('endTime'))) {
                startTime = parseInt(this._route.snapshot.queryParamMap.get('endTime'));
            }
        }
        this.tableRequest.whoClaimed = isDefined(this._route.snapshot.queryParamMap.get('whoClaimed')) ? this._route.snapshot.queryParamMap.get('whoClaimed') : '';
        this.tableRequest.dataProvider = isDefined(this._route.snapshot.queryParamMap.get('dataProvider')) ? this._route.snapshot.queryParamMap.get('dataProvider') : '';
        this.tableRequest.sentTo = isDefined(this._route.snapshot.queryParamMap.get('sentTo')) ? this._route.snapshot.queryParamMap.get('sentTo') : '';

        this.tableRequest.startTime = startTime;
        this.tableRequest.endTime = endTime;

        this.tableRequest.page = isNaN(parseInt(this._route.snapshot.queryParamMap.get('page'))) ? 1 : parseInt(this._route.snapshot.queryParamMap.get('page'));
        this.tableRequest.pageSize = isNaN(parseInt(this._route.snapshot.queryParamMap.get('pageSize'))) ? 50 : parseInt(this._route.snapshot.queryParamMap.get('pageSize'));
        this.tableRequest.sortField = (isDefined(this._route.snapshot.queryParamMap.get('sortField')) && isDefined(DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')])) ? DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')] : DelegationsSortEnum.timestamp;
        this.tableRequest.sortOrder = (isDefined(this._route.snapshot.queryParamMap.get('sortOrder')) && isDefined(SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')])) ? SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')] : SortOrderEnum.desc;
        this.histogramGroupBy = (isDefined(this._route.snapshot.queryParamMap.get('groupBy')) && isDefined(ClaimedRewardsGroupByEnum[this._route.snapshot.queryParamMap.get('groupBy')])) ? ClaimedRewardsGroupByEnum[this._route.snapshot.queryParamMap.get('groupBy')] : ClaimedRewardsGroupByEnum.rewardEpochId;
        this._cdr.detectChanges();
    }

    selectWhoClaimed(whoClaimed: { value: string, targetRoute: string[] }): void {
        if (whoClaimed.targetRoute.includes('delegations')) {
            this._router.navigate([this._network, ...whoClaimed.targetRoute], { queryParams: { from: whoClaimed.value } });
        } else {
            this.tableRequest.whoClaimed = whoClaimed.value;
            this.tableRequest.dataProvider = null;
            this.tableRequest.sentTo = null;
            this.tableRequest.page = 1;
            this._updateQueryParams(this.tableRequest);
        }
    }

    selectReceiver(sentTo: { value: string, targetRoute: string[] }): void {
        if (sentTo.targetRoute.includes('delegations')) {
            this._router.navigate([this._network, ...sentTo.targetRoute], { queryParams: { from: sentTo.value } });
        } else {
            this.tableRequest.whoClaimed = null;
            this.tableRequest.dataProvider = null;
            this.tableRequest.sentTo = sentTo.value;
            this.tableRequest.page = 1;
            this._updateQueryParams(this.tableRequest);
        }
    }

    selectDataProvider(dataProvider: { value: string, targetRoute: string[] }): void {
        if (dataProvider.targetRoute.includes('delegations')) {
            if (dataProvider.targetRoute.includes('explorer')) {
                this._router.navigate([this._network, ...dataProvider.targetRoute]);
            } else if (dataProvider.targetRoute.includes('search')) {
                this._router.navigate([this._network, ...dataProvider.targetRoute], { queryParams: { to: dataProvider.value } });
            }
        } else if (dataProvider.targetRoute.includes('search')) {
            this.tableRequest.whoClaimed = null;
            this.tableRequest.sentTo = null;
            this.tableRequest.dataProvider = dataProvider.value;
            this.tableRequest.page = 1;
            this._updateQueryParams(this.tableRequest);
        }
    }

}