import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { DateRange } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NgDatePickerModule, SelectedDateEvent } from "app/commons/ng-datetime-picker/public-api";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { FeedsRequest, FinalizedPricesFeedsRequest, RevealedPricesFeedsRequest, RewardsDistributedRequest } from "app/model/feeds-request";
import { LoadingMap } from "app/model/loading-map";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { FtsoService } from "app/services/ftso.service";
import { plainToClass } from 'class-transformer';
import { isDefined, isNotEmpty, isNumber } from "class-validator";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { Observable, Subject, forkJoin, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, NetworkEnum, PaginatedResult, PriceEpochSettings, PriceFinalized, PriceFinalizedSortEnum, PriceRevealed, PriceRevealedSortEnum, RewardDistributed, RewardDistributedSortEnum, RewardEpochSettings, SortOrderEnum } from "../../../../../../../libs/commons/src";
import { DataProviderSubmissionStats } from "../../../../../../../libs/commons/src/model/ftso/data-provider-submission-stats";
import { DataProviderFeedsChartComponent } from "../data-provider-feeds-chart/data-provider-feeds-chart.component";
import { DataProviderSubmissionStatsComponent, SubmissionStatsChartType } from "../data-provider-submission-stats/data-provider-submission-stats.component";
import { DataProvidersSubmissionStatsTableComponent } from "../data-providers-submission-stats-table/data-providers-submission-stats-table.component";
import { DataProvidersDistributedRewardsTableComponent } from "../data-providers-distributed-rewards-table/data-providers-distributed-rewards-table.component";
import { CounterComponent } from "app/modules/counter/counter.component";


@Component({
    selector: 'flare-base-data-provider-feeds',
    templateUrl: './data-providers-feeds.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule,
        LoaderComponent, MatFormFieldModule, MatInputModule, ShortNumberPipe, TimeDiffPipe,
        NgxMatSelectSearchModule, NgDatePickerModule, DataProviderFeedsChartComponent, MatSlideToggleModule, CounterComponent,
        DataProvidersSubmissionStatsTableComponent, DataProvidersDistributedRewardsTableComponent,
        DataProviderSubmissionStatsComponent,
        MatButtonModule, MatMenuModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProviderFeedsComponent implements OnInit, OnDestroy, OnChanges {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    loadingMap: LoadingMap;
    @Input() network: NetworkEnum;
    @Input() rewardEpochSettings: RewardEpochSettings;
    @Input() priceEpochSettings: PriceEpochSettings;
    @Input() request: FeedsRequest = new FeedsRequest(null, null, null);
    @Output() requestUpdate: EventEmitter<FeedsRequest> = new EventEmitter();
    @Input() refreshTimestamp: number;
    dataProviderInfo: DataProviderInfo[];
    lastRequest: FeedsRequest = new FeedsRequest(null, null, null);
    selectedProvider: DataProviderInfo;
    availableSymbols: string[] = []
    filteredAvailableSymbols: string[];
    rewardsDistributed: RewardDistributed[] = [];
    selectedTimeRangeDefinition: TimeRangeDefinition;
    dataProvidersInfoMap: Record<string, DataProviderInfo> = {};
    timeRanges: TimeRangeDefinition[] = [
        new TimeRangeDefinition('last15Minutes', 'Last 15 minutes', (60 * 15) * 1000),
        new TimeRangeDefinition('last30Minutes', 'Last 30 minutes', (60 * 30) * 1000),
        new TimeRangeDefinition('lastHour', 'Last hour', (60 * 60) * 1000),
        new TimeRangeDefinition('last3Hours', 'Last 3 hours', ((60 * 60) * 3) * 1000),
        new TimeRangeDefinition('last6Hours', 'Last 6 hours', ((60 * 60) * 6) * 1000),
        new TimeRangeDefinition('last12Hours', 'Last 12 hours', ((60 * 60) * 12) * 1000),
        new TimeRangeDefinition('lastDay', 'Last day', ((60 * 60) * 24) * 1000),
        new TimeRangeDefinition(null, 'Custom range', 0),
    ];
    loading: boolean;
    initialized: boolean;
    revealedPrices: PriceRevealed[];
    finalizedPrices: PriceFinalized[];
    submissionStats: DataProviderSubmissionStats[];
    symbolSubmissionStats: DataProviderSubmissionStats[];
    pricesData: { finalizedPrices: PriceFinalized[], revealedPrices: PriceRevealed[], submissionStats: DataProviderSubmissionStats[], distributedRewards: RewardDistributed[] } = { finalizedPrices: [], revealedPrices: [], submissionStats: [], distributedRewards: [] };
    isRelativeView: boolean = false;
    submissionStatsTypes = SubmissionStatsChartType;
    sortOrder = SortOrderEnum;
    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _uiNotificationsService: UiNotificationsService,
        private _router: Router,
        private _ftsoService: FtsoService
    ) {
        this.loadingMap = new LoadingMap(this._cdr);
    }


    ngOnInit(): void {
        this.initialized = false;
        this._parseQueryParams();
        this._ftsoService.getDataProvidersInfo(this.network, this.rewardEpochSettings.getEpochIdForTime(this.request.startTime)).subscribe(dataProviderInfo => {
            this.dataProviderInfo = dataProviderInfo;
            this._route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe(queryParams => {
                this._parseQueryParams();
                this.refreshData(this.request);
            });
        });
    }
    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.refreshTimestamp && !changes.refreshTimestamp.isFirstChange() && changes.refreshTimestamp.currentValue != changes.refreshTimestamp.previousValue)) {
            if (isNotEmpty(this.selectedTimeRangeDefinition) && isNotEmpty(this.selectedTimeRangeDefinition.id)) {
                this.request.startTime = this.selectedTimeRangeDefinition.getTimeRange().start;
                this.request.endTime = this.selectedTimeRangeDefinition.getTimeRange().end;
            }
            this.refreshData(this.request);
        }

    }
    parseSelectedDated(startTime: number, endTime: number): DateRange<Date> {
        return new DateRange(new Date(startTime), new Date(endTime));
    }
    handleTimeRangeChange(date: SelectedDateEvent) {
        date.selectedOption.id
        this.request.startTime = date.range.start.getTime();
        this.request.endTime = date.range.end.getTime();
        this.selectedTimeRangeDefinition = this.timeRanges.find(tr => tr.id == date.selectedOption.id);
        this.timeRanges.filter(tr => date.selectedOption.id == tr.id).map(tr => tr.isSelected = true);
        this._updateQueryParams(this.request);
        this.refreshData(this.request);

    }
    refreshData(request: FeedsRequest): void {
        this.loading = true;
        let calls: Observable<string[] | PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceRevealed[]> | DataProviderSubmissionStats[] | PaginatedResult<RewardDistributed[]>>[] = [];
        let symbolChanged: boolean = false;
        let timeRangeChanged: boolean = false;
        let addressChanged: boolean = false;
        if (this.lastRequest.symbol != this.request.symbol) {
            symbolChanged = true;
        }
        if ((this.lastRequest.startTime != this.request.startTime) || this.lastRequest.endTime != this.request.endTime) {
            timeRangeChanged = true;
        }
        if (this.lastRequest.address != this.request.address) {
            addressChanged = true;
        }

        if (addressChanged || timeRangeChanged || !this.initialized) {
            calls = [
                this._getAvailableSymbols(request),
                this._getFinalizedPrices(request),
                this._getRevealedPrices(request),
                this._getDataProviderSubmissionStats(request),
                this._getRewardsDistributed(request)
            ]
        } else if (symbolChanged) {
            calls = [
                this._getFinalizedPrices(request),
                this._getRevealedPrices(request),
            ]
        }
        forkJoin(calls).subscribe(res => {
            const revealedEpochIds: number[] = [... new Set(this.revealedPrices.map(revealedPrice => revealedPrice.epochId))];
            this.finalizedPrices = this.finalizedPrices.filter(finalizedPrice => revealedEpochIds.includes(finalizedPrice.epochId));
            //this.finalizedPrices.forEach(finalizedPrice => finalizedPrice.timestamp = this.priceEpochSettings.getEndTimeForEpochId(finalizedPrice.epochId));
            this.pricesData = { finalizedPrices: this.finalizedPrices, revealedPrices: this.revealedPrices, submissionStats: this.submissionStats, distributedRewards: this.rewardsDistributed };
            this.initialized = true;
            this.lastRequest = Commons.clone(request);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }

    private _getFinalizedPrices(request: FeedsRequest): Observable<PaginatedResult<PriceFinalized[]>> {
        return new Observable<PaginatedResult<PriceFinalized[]>>(observer => {
            this.loadingMap.setLoading('getFinalizedPrices', true);
            let originalRequest: FinalizedPricesFeedsRequest = plainToClass(FinalizedPricesFeedsRequest, request);
            originalRequest.sortField = PriceFinalizedSortEnum.epochId;
            originalRequest.sortOrder = SortOrderEnum.asc;
            this._ftsoService.getFinalizedPrices(this.network, originalRequest).subscribe(finalizedPrices => {
                this.finalizedPrices = finalizedPrices.results;
                this._cdr.detectChanges();
                observer.next(finalizedPrices);
            }, finalizedPricesErr => {
                this._uiNotificationsService.error('Unable to fetch finalized prices', finalizedPricesErr);
                observer.error(finalizedPricesErr);
            }).add(() => {
                this.loadingMap.setLoading('getFinalizedPrices', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }
    private _getRevealedPrices(request: FeedsRequest): Observable<PaginatedResult<PriceRevealed[]>> {
        return new Observable<PaginatedResult<PriceRevealed[]>>(observer => {
            this.loadingMap.setLoading('getRevealedPrices', true);
            let originalRequest: RevealedPricesFeedsRequest = plainToClass(RevealedPricesFeedsRequest, request);
            originalRequest.sortField = PriceRevealedSortEnum.epochId;
            originalRequest.sortOrder = SortOrderEnum.asc;
            this._ftsoService.getRevealedPrices(this.network, originalRequest).subscribe(revealedPrices => {
                this.revealedPrices = revealedPrices.results;
                this._cdr.detectChanges();
                observer.next(revealedPrices);
            }, revealedPricesErr => {
                this._uiNotificationsService.error('Unable to fetch revealed prices', revealedPricesErr);
                observer.error(revealedPricesErr);
            }).add(() => {
                this.loadingMap.setLoading('getRevealedPrices', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }
    private _getRewardsDistributed(request: FeedsRequest): Observable<PaginatedResult<RewardDistributed[]>> {
        return new Observable<PaginatedResult<RewardDistributed[]>>(observer => {
            this.loadingMap.setLoading('getRewardsDistributed', true);
            let originalRequest: RewardsDistributedRequest = plainToClass(RewardsDistributedRequest, request);
            originalRequest.symbol = null;
            originalRequest.sortField = RewardDistributedSortEnum.priceEpochId;
            originalRequest.sortOrder = SortOrderEnum.asc;
            this._ftsoService.getDataProviderRewardsDistributed(this.network, originalRequest).subscribe(rewardsDistributed => {
                this.rewardsDistributed = rewardsDistributed.results;
                this._cdr.detectChanges();
                observer.next(rewardsDistributed);
            }, revealedPricesErr => {
                this._uiNotificationsService.error('Unable to fetch rewards distributed', revealedPricesErr);
                observer.error(revealedPricesErr);
            }).add(() => {
                this.loadingMap.setLoading('getRewardsDistributed', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }
    private _getDataProviderInfo(address: string): DataProviderInfo {
        let dpInfo: DataProviderInfo = this.dataProviderInfo.find(dpInfo => dpInfo.address == address);
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            return dpInfo;
        }
    }
    private _getDataProviderSubmissionStats(request: FeedsRequest): Observable<DataProviderSubmissionStats[]> {
        return new Observable<DataProviderSubmissionStats[]>(observer => {
            this.loadingMap.setLoading('getDataProviderSubmissionStats', true);
            let originalRequest = plainToClass(FeedsRequest, request);
            originalRequest.symbol = 'all';
            const selectedSymbol: string = request.symbol;
            this._ftsoService.getDataProviderSubmissionStats(this.network, originalRequest).subscribe(submissionStats => {
                this.submissionStats = submissionStats;
                this.symbolSubmissionStats = submissionStats.filter(submissionStat => submissionStat.symbol == selectedSymbol);
                this._cdr.detectChanges();
                observer.next(submissionStats);
            }, submissionStatsErr => {
                this._uiNotificationsService.error('Unable to fetch data provider submission stats', submissionStatsErr);
                observer.error(submissionStatsErr);
            }).add(() => {
                this.loadingMap.setLoading('getDataProviderSubmissionStats', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }
    private _getAvailableSymbols(request: FeedsRequest): Observable<string[]> {
        return new Observable<string[]>(observer => {
            this.loadingMap.setLoading('getAvailableSymbols', true);
            let originalRequest = plainToClass(FeedsRequest, request);
            originalRequest.symbol = 'all';
            this._ftsoService.getAvailableSymbols(this.network, originalRequest).subscribe(availableSymbols => {
                this.availableSymbols = availableSymbols;
                this.filteredAvailableSymbols = availableSymbols;
                this._cdr.detectChanges();
                observer.next(availableSymbols);
            }, availableSymbolsErr => {
                this._uiNotificationsService.error('Unable to get available symbols', availableSymbolsErr);
                observer.error(availableSymbolsErr);
            }).add(() => {
                this.loadingMap.setLoading('getAvailableSymbols', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }


    private _parseQueryParams(): void {
        const currentParams = { ...this._route.snapshot.queryParams };

        let startTime: number = this.request.startTime;
        let endTime: number = this.request.endTime;
        let symbol: string = this.request.symbol;
        let address: string = this.request.address;
        let relativeView: boolean = this.isRelativeView;
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
        if (!isDefined(startTime) && !isDefined(endTime)) {
            this.selectedTimeRangeDefinition = this.timeRanges[1];
            startTime = this.timeRanges[1].getTimeRange().start;
            endTime = this.timeRanges[1].getTimeRange().end;
        }
        if (endTime - startTime >= this.timeRanges.find(tr => tr.id == 'lastDay').timeDiff + 1000) {
            startTime = endTime - this.timeRanges.find(tr => tr.id == 'lastDay').timeDiff;
            this._updateQueryParams(this.request);
            this._uiNotificationsService.warning(`Selected time range too wide`, 'The maximum selectable interval is 24 hours')
        }
        if (!isDefined(symbol)) {
            symbol = isDefined(this._route.snapshot.queryParamMap.get('symbol')) ? this._route.snapshot.queryParamMap.get('symbol') : Utils.getChainDefinition(this.network).nativeCurrency.symbol;
        }
        if (isDefined(this._route.snapshot.queryParamMap.get('address')) && this._route.snapshot.queryParamMap.get('address') != address) {
            address = this._route.snapshot.queryParamMap.get('address');
        }
        if (isDefined(this._route.snapshot.queryParamMap.get('relative'))) {
            relativeView = (this._route.snapshot.queryParamMap.get('relative') == 'true' || this._route.snapshot.queryParamMap.get('relative') == 'false') ? JSON.parse(this._route.snapshot.queryParamMap.get('relative')) : false;
        }
        if (isNotEmpty(this.dataProviderInfo)) {
            this.dataProviderInfo.map(dpInfo => {
                this.dataProvidersInfoMap[dpInfo.address] = this._getDataProviderInfo(dpInfo.address);
            });
        }

        this.request = new FeedsRequest(address, startTime, endTime);
        this.request.symbol = symbol;
        this.request.page = 1;
        this.isRelativeView = relativeView;
        this.request.pageSize = 50000;
        /*      if (this.request.address != currentParams.address || (this.selectedTimeRangeDefinition && (this.selectedTimeRangeDefinition.id != currentParams.timeRangeId)) || (this.selectedTimeRangeDefinition && this.selectedTimeRangeDefinition.timeDiff && (parseInt(currentParams.endTime) - parseInt(currentParams.startTime) != this.selectedTimeRangeDefinition.timeDiff)) || this.request.page != parseInt(currentParams.page) || this.request.symbol != currentParams.symbol) {
                 this.requestUpdate.emit(this.request);
                 this._updateQueryParams(this.request)
             } */
        this._cdr.detectChanges();
    }

    private _updateQueryParams(request: FeedsRequest) {
        this._cdr.detectChanges();
        const currentParams = { ...this._route.snapshot.queryParams };
        if (isNotEmpty(this.selectedTimeRangeDefinition) && isNotEmpty(this.selectedTimeRangeDefinition.id)) {
            currentParams['timeRangeId'] = this.selectedTimeRangeDefinition.id;
        }
        currentParams['startTime'] = request.startTime;
        currentParams['endTime'] = request.endTime;
        currentParams['symbol'] = request.symbol;
        currentParams['address'] = request.address;
        currentParams['relative'] = this.isRelativeView
        this._cdr.detectChanges();
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: currentParams,
            preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
    }
    submitForm(): void {
        this._updateQueryParams(this.request);
    }
    handleSymbolChange(change: MatSelectChange): void {
        this.request.symbol = change.value;
        this._updateQueryParams(this.request)
    }
    filterAvailableSymbols(filter: string): void {
        this.filteredAvailableSymbols = this.availableSymbols.filter(symbol => symbol.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    }
    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.request.startTime = timeRange.start;
        this.request.endTime = timeRange.end;
        this._updateQueryParams(this.request);
    }
    toggleRelativeView() {
        this.isRelativeView = !this.isRelativeView;
        this._updateQueryParams(this.request);
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}