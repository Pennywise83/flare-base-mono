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
import { DelegationsRequest } from "app/model/delegations-request";
import { DelegatorsRequest } from "app/model/delegators-request";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { DelegatotionService } from "app/services/delegations.service";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { isDefined, isEmpty, isNotEmpty, isNumber } from "class-validator";
import { saveAs } from 'file-saver';
import { MatomoTracker } from 'ngx-matomo';
import { Subject, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, DelegationDTO, DelegationsSortEnum, NetworkEnum, PaginatedResult, SortOrderEnum } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { TimeDiffPipe } from "../../commons/pipes/time-diff.pipe";
import { CounterComponent } from "../counter/counter.component";
import { DataProvidersComponent } from "../data-providers/data-providers.component";
import { DelegationsTableComponent } from "../delegations-table/delegations-table.component";


@Component({
    selector: 'flare-base-delegations-search',
    templateUrl: './delegations-search.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, CounterComponent,
        LoaderComponent, DataProvidersComponent, MatFormFieldModule, MatInputModule, DelegationsTableComponent, TimeDiffPipe,
        MatMenuModule, DatePipe,
        MatButtonModule,],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [TimeDiffPipe, DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DelegationsSearchComponent implements OnInit, OnDestroy {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    request: DelegationsRequest;
    delegations: PaginatedResult<DelegationDTO[]>;
    loading: boolean;
    tableColumns: string[] = ['timestamp', 'rewardEpoch', 'to', 'from', 'amount'];
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
        private _delegationsService: DelegatotionService,
        private _epochsService: EpochsService,
        private _datePipe: DatePipe,
        private _ftsoService: FtsoService,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker
    ) {
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }


    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.request.startTime = timeRange.start;
        this.request.endTime = timeRange.end;
        this._updateQueryParams(this.request).then();
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
                    this._titleService.setTitle(`Flare Base - ${this._network} - Delegations search`);
                    Commons.setPageTitle(`Flare base - ${this._network.charAt(0).toUpperCase() + this._network.slice(1)} - Delegations search`, this._titleService, this._matomoTracker)
                    this.request = new DelegationsRequest();
                    this._parseQueryParams();
                    this._route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe(queryParams => {
                        this._parseQueryParams();
                        this.refreshData(this.request);
                    });
                }
            });
    }

    exportCsv(): void {
        this.loading = true;
        let startTime: string = this._datePipe.transform(this.request.startTime, 'YYYY-MM-dd _HH-mm-ss');
        let endTime: string = this._datePipe.transform(this.request.endTime, 'YYYY-MM-dd_HH-mm-ss');
        this._delegationsService.getDelegationsCsv(this._network, this.request).subscribe(delegations => {
            saveAs(delegations, `${this._network}-Delegations-from_${this.request.from ? this.request.from : 'all'}-to_${this.request.to ? this.request.to : 'all'}-startTime_${startTime}-endTime_${endTime}.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export data provider delegations data', statsErr);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }
    handleRequestEvent(requestEvent: DelegatorsRequest): void {
        this.request.page = requestEvent.page;
        this.request.pageSize = requestEvent.pageSize;
        this.request.sortField = requestEvent.sortField;
        this.request.sortOrder = requestEvent.sortOrder;
        let currentParams = { ...this._route.snapshot.queryParams };
        currentParams.page = this.request.page;
        currentParams.pageSize = this.request.pageSize;
        currentParams.sortField = this.request.sortField;
        currentParams.sortOrder = this.request.sortOrder;
        this._updateQueryParams(this.request);
    }

    submitSearch(): void {
        this._updateQueryParams(this.request);
    }
    refreshData(request: DelegationsRequest): void {
        this.loading = true;
        this._cdr.detectChanges();
        this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfoRes => {
            this.dataProvidersInfo = dataProvidersInfoRes;
            this._delegationsService.getDelegations(this._network, request).subscribe(delegationsRes => {
                this.delegations = delegationsRes;
            }, delegatorsErr => {
                this._uiNotificationsService.error('Unable to get delegations with provided search', delegatorsErr);
            }).add(() => {
                this.loading = false;
                this._cdr.detectChanges();
                if (this.delegations.numResults > 0 && (this.delegations.page - 1) * this.delegations.pageSize >= this.delegations.numResults) {
                    this.request.page = 1;
                    this.refreshData(this.request);
                }
            });
        });
    }

    private async _updateQueryParams(request: DelegationsRequest): Promise<void> {
        const currentParams = { ...this._route.snapshot.queryParams };
        if (isNotEmpty(this.selectedTimeRangeDefinition.id)) {
            currentParams['timeRangeId'] = this.selectedTimeRangeDefinition.id;
        }
        currentParams['from'] = request.from;
        currentParams['to'] = request.to;
        currentParams['startTime'] = request.startTime;
        currentParams['endTime'] = request.endTime;
        currentParams['page'] = request.page;
        currentParams['pageSize'] = request.pageSize;
        currentParams['sortField'] = request.sortField;
        currentParams['sortOrder'] = request.sortOrder;
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
        this.request.from = isDefined(this._route.snapshot.queryParamMap.get('from')) ? this._route.snapshot.queryParamMap.get('from') : '';
        this.request.to = isDefined(this._route.snapshot.queryParamMap.get('to')) ? this._route.snapshot.queryParamMap.get('to') : '';

        this.request.startTime = startTime;
        this.request.endTime = endTime;

        this.request.page = isNaN(parseInt(this._route.snapshot.queryParamMap.get('page'))) ? 1 : parseInt(this._route.snapshot.queryParamMap.get('page'));
        this.request.pageSize = isNaN(parseInt(this._route.snapshot.queryParamMap.get('pageSize'))) ? 50 : parseInt(this._route.snapshot.queryParamMap.get('pageSize'));
        this.request.sortField = (isDefined(this._route.snapshot.queryParamMap.get('sortField')) && isDefined(DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')])) ? DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')] : DelegationsSortEnum.timestamp;
        this.request.sortOrder = (isDefined(this._route.snapshot.queryParamMap.get('sortOrder')) && isDefined(SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')])) ? SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')] : SortOrderEnum.desc;
        this._cdr.detectChanges();
    }

    selectDelegator(delegator: { value: string, targetRoute: string[] }): void {
        if (delegator.targetRoute.includes('rewards')) {
            this._router.navigate([this._network, ...delegator.targetRoute], { queryParams: { whoClaimed: delegator.value } });

        } else {
            this.request.from = delegator.value;
            this.request.to = null;
            this.request.page = 1;
            this._updateQueryParams(this.request);
        }
    }

    selectDataProvider(dataProvider: { value: string, targetRoute: string[] }): void {
        if (dataProvider.targetRoute.includes('rewards')) {
            this._router.navigate([this._network, ...dataProvider.targetRoute], { queryParams: { dataProvider: dataProvider.value } });
        } else {
            if (dataProvider.targetRoute.includes('explorer')) {
                this._router.navigate([this._network, ...dataProvider.targetRoute]);
            } else if (dataProvider.targetRoute.includes('search')) {
                this.request.from = null;
                this.request.to = dataProvider.value;
                this.request.page = 1;
                this._updateQueryParams(this.request);
            }
        }
    }

}