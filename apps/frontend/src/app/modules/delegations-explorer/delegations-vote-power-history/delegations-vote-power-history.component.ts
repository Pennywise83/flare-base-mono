import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
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
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { CounterComponent } from "app/modules/counter/counter.component";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { VotePowerService } from "app/services/votepower.service";
import { isDefined, isNotEmpty } from "class-validator";
import { isEmpty, isNumber } from "lodash";
import { MatomoTracker } from "ngx-matomo";
import { Observable, Subject, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, NetworkEnum, RewardEpochSettings, VotePowerDTO } from "../../../../../../../libs/commons/src";
import { DataProviderDelegationsComponent, VotePowerDelegatorsChange } from "../data-provider-delegations/data-provider-delegations.component";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { VotePowerHistoryComponent } from "app/modules/vote-power-history/votepower-history.component";

@Component({
    selector: 'flare-base-delegations-votepower-history',
    templateUrl: './delegations-vote-power-history.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, CounterComponent, MatButtonModule, AddressTrimPipe, DatePipe,
        LoaderComponent, MatFormFieldModule, MatInputModule, ShortNumberPipe, TimeDiffPipe, MatMenuModule, NgxMatSelectSearchModule, VotePowerHistoryComponent,
        DataProviderDelegationsComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe, DatePipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DelegationVotePowerHistoryComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    rewardEpochSettings: RewardEpochSettings;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    loading: boolean;
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    selectedTimeRangeDefinition: TimeRangeDefinition;
    dataProvidersInfo: DataProviderInfo[] = [];
    dataProviderInfo: DataProviderInfo;
    filteredDataProvidersInfo: DataProviderInfo[] = [];
    timeRanges: TimeRangeDefinition[] = [
        new TimeRangeDefinition('last6Months', 'Last 6 months', ((60 * 60 * 24 * 30) * 6) * 1000),
        new TimeRangeDefinition('last9Months', 'Last 9 months', ((60 * 60 * 24 * 30) * 9) * 1000),
        new TimeRangeDefinition('lastYear', 'Last year', ((60 * 60 * 24 * 30) * 12) * 1000),
        new TimeRangeDefinition('last2Years', 'Last 2 years', ((60 * 60 * 24 * 30) * 12) * 2 * 1000),
    ];
    request: VotePowerHistoryRequest;
    refreshTimestamp: number;
    exportCsvTimestamp: number;
    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _dataProvidersService: FtsoService,
        private _votePowerService: VotePowerService,
        private _datePipe: DatePipe,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker
    ) {
    }


    ngOnInit(): void {
        Utils.getParentParams(this._route).pipe(
            takeUntil(this._unsubscribeAll))
            .subscribe(async params => {
                this._parentParams = { ...this._parentParams, ...params };

                if (isEmpty(this._parentParams['network'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    this.loading = false;
                    return;
                }
                if (this._parentParams['network'] != this.network) {
                    this.network = NetworkEnum[this._parentParams['network']];
                    this.selectedTimeRangeDefinition = this.timeRanges[0];
                    this._epochsService.getRewardEpochSettings(this.network).subscribe(rewardEpochSettingsRes => {
                        this.rewardEpochSettings = rewardEpochSettingsRes;
                        this._titleService.setTitle(`Flare Base - ${this.network} - Vote power history`);
                    }, rewardEpochSettingsErr => {
                        this._uiNotificationsService.error(`Unable to initialize component`, rewardEpochSettingsErr);
                        return;
                    }).add(async () => {
                        this.request = new VotePowerHistoryRequest(null, this.selectedTimeRangeDefinition.getTimeRange().start, this.selectedTimeRangeDefinition.getTimeRange().end);
                        this._parseQueryParams();
                        this._route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe(queryParams => {
                            this._parseQueryParams();
                            this._getDataProvidersInfo().subscribe(dataProvidersInfo => {
                                this.filteredDataProvidersInfo = dataProvidersInfo;
                                this.dataProvidersInfo = dataProvidersInfo;
                                this.dataProviderInfo = this._getDataProviderInfo(this.request.address);
                                Commons.setPageTitle(`Flare Base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Vote power history - ${isEmpty(this.request.address) ? 'Total' : this.dataProviderInfo.name}`, this._titleService, this._matomoTracker)
                                this.refreshData();
                            })
                        });
                    })
                }
            });
    }
    exportCsv() {
        this.exportCsvTimestamp = new Date().getTime();
        this._cdr.detectChanges();
    }

    handleDataProviderChange(dataProviderAddress: MatSelectChange): void {
        this.request.address = dataProviderAddress.value;
        this._updateQueryParams(this.request).then();
    }
    private async _updateQueryParams(request: VotePowerHistoryRequest): Promise<void> {
        this._cdr.detectChanges();
        const currentParams = { ...this._route.snapshot.queryParams };
        if (isNotEmpty(this.selectedTimeRangeDefinition.id)) {
            currentParams['timeRangeId'] = this.selectedTimeRangeDefinition.id;
        }
        currentParams['address'] = request.address;
        currentParams['startTime'] = request.startTime;
        currentParams['endTime'] = request.endTime;
        this._cdr.detectChanges();
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: currentParams,
            preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
        return;
    }
    submitForm(): void {
        this._updateQueryParams(this.request);
    }
    filterDataProvider(filter: string): void {
        this.filteredDataProvidersInfo = this.dataProvidersInfo.filter(dp => dp.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0 || dp.address.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    }
    private _getDataProvidersInfo(): Observable<DataProviderInfo[]> {
        return new Observable<DataProviderInfo[]>(observer => {
            this._dataProvidersService.getDataProvidersInfo(this.network).subscribe(res => {
                this.dataProvidersInfo = res;
                observer.next(res);
            }, err => {
                this._uiNotificationsService.error('Unable to get data provider info', err);
                observer.error(err);
            }).add(() => {
                observer.complete();
            });
        });
    }
    private _getDataProviderInfo(address: string): DataProviderInfo {
        let dpInfo: DataProviderInfo = this.dataProvidersInfo.find(dpInfo => dpInfo.address == address);
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            return dpInfo;
        }
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
        this.request.address = isDefined(this._route.snapshot.queryParamMap.get('address')) ? this._route.snapshot.queryParamMap.get('address') : '';
        this.request.startTime = startTime;
        this.request.endTime = endTime;
    }
    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.request.startTime = timeRange.start;
        this.request.endTime = timeRange.end;
        this._updateQueryParams(this.request).then();
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    refreshData() {
        this.refreshTimestamp = new Date().getTime();
        this._cdr.detectChanges();
    }
}
