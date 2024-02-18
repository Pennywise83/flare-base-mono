import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { Utils } from "app/commons/utils";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { FtsoService } from "app/services/ftso.service";
import { VotePowerService } from "app/services/votepower.service";
import { isDefined, isNotEmpty, isNumber } from "class-validator";
import { saveAs } from 'file-saver';
import { isEmpty } from "lodash";
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { Subject, takeUntil } from "rxjs";
import { DataProviderInfo, NetworkEnum, RewardEpochSettings, VotePowerDTO } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { UiNotificationsService } from "../../commons/ui-notifications/ui-notifications.service";
import { EpochsService } from "../../services/epochs.service";
import { DataProviderDelegationsComponent, VotePowerDelegatorsChange } from "../delegations-explorer/data-provider-delegations/data-provider-delegations.component";
import { VotePowerDelegationsChangeTableComponent } from "../delegations-explorer/data-provider-delegations/vote-power-delegations-table/vote-power-delegations-table.component";
import { VotePowerOverDelegationsChartComponent } from "../delegations-explorer/data-provider-delegations/vote-power-over-delegations-chart/vote-power-over-delegations-chart.component";
import { Title } from "@angular/platform-browser";


@Component({
    selector: 'flare-base-votepower-history',
    templateUrl: './votepower-history.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, LoaderComponent, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, VotePowerDelegationsChangeTableComponent, VotePowerOverDelegationsChartComponent, MatMenuModule, DatePipe, NgxMatSelectSearchModule, AddressTrimPipe],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class VotePowerHistoryComponent implements OnInit, OnDestroy {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    rewardEpochSettings: RewardEpochSettings;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    loading: boolean;
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    selectedTimeRangeDefinition: TimeRangeDefinition;
    dataProvidersInfo: DataProviderInfo[] = [];
    filteredDataProvidersInfo: DataProviderInfo[] = [];
    timeRanges: TimeRangeDefinition[] = [
        new TimeRangeDefinition('last6Months', 'Last 6 months', ((60 * 60 * 24 * 30) * 6) * 1000),
        new TimeRangeDefinition('last9Months', 'Last 9 months', ((60 * 60 * 24 * 30) * 9) * 1000),
        new TimeRangeDefinition('lastYear', 'Last year', ((60 * 60 * 24 * 30) * 12) * 1000),
        new TimeRangeDefinition('last2Years', 'Last 2 years', ((60 * 60 * 24 * 30) * 12) * 2 * 1000),
    ];
    request: VotePowerHistoryRequest;

    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _ftsoService: FtsoService,
        private _votePowerService: VotePowerService,
        private _datePipe: DatePipe,
        private _titleService: Title
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
                if (this._parentParams['network'] != this._network) {
                    this._network = NetworkEnum[this._parentParams['network']];
                    this.selectedTimeRangeDefinition = this.timeRanges[0];
                    this._epochsService.getRewardEpochSettings(this._network).subscribe(rewardEpochSettingsRes => {
                        this.rewardEpochSettings = rewardEpochSettingsRes;
                        this._titleService.setTitle(`Flare Base - ${this._network} - Vote power history`);
                    }, rewardEpochSettingsErr => {
                        this._uiNotificationsService.error(`Unable to initialize component`, rewardEpochSettingsErr);
                        return;
                    }).add(async () => {
                        this.request = new VotePowerHistoryRequest(null, this.selectedTimeRangeDefinition.getTimeRange().start, this.selectedTimeRangeDefinition.getTimeRange().end);
                        this._parseQueryParams();
                        this._route.queryParams.pipe(takeUntil(this._unsubscribeAll)).subscribe(queryParams => {
                            this._parseQueryParams();
                            this.refreshData(this.request);
                        });
                    })

                }
            });
    }
    submitForm(): void {
        this._updateQueryParams(this.request);
    }
    refreshData(request: VotePowerHistoryRequest): void {
        this.loading = true;
        this._cdr.detectChanges();
        this.request.pageSize = 1000;
        this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfo => {
            this.dataProvidersInfo = dataProvidersInfo;
            this.filteredDataProvidersInfo = dataProvidersInfo;
            this._votePowerService.getDelegatedVotePowerHistory(this._network, request).subscribe(votePowerHistory => {
                this.delegatedVotePowerHistory = votePowerHistory.results;
                this._titleService.setTitle(`Flare Base - ${this._network} - Vote power history - ${isEmpty(request.address) ? '' : dataProvidersInfo.find(dp => dp.address == request.address).name}`);
                if (votePowerHistory.results.length > 1) {
                    this.votePowerHistoryChange = DataProviderDelegationsComponent.getVotePowerAndDelegatorsChange(votePowerHistory.results, votePowerHistory.results.length - 1, this.rewardEpochSettings);
                    this._cdr.detectChanges();
                }
            }, votePowerHistoryErr => {
                this._uiNotificationsService.error('Unable to fetch vote power history', votePowerHistoryErr);
            }).add(() => {
                this.loading = false;
                this._cdr.detectChanges();
            });
        }, dataProvidersInfoErr => {
            this._uiNotificationsService.error('Unable to get data providers info', dataProvidersInfoErr);
        });
    }
    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.request.startTime = timeRange.start;
        this.request.endTime = timeRange.end;
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

    exportCsv(): void {
        this.loading = true;
        let startTime: string = this._datePipe.transform(this.request.startTime, 'YYYY-MM-dd _HH-mm-ss');
        let endTime: string = this._datePipe.transform(this.request.endTime, 'YYYY-MM-dd_HH-mm-ss');
        this._votePowerService.getDelegatedVotePowerHistoryCsv(this._network, this.request).subscribe(delegations => {
            saveAs(delegations, `${this._network}-VotePowerHistory-address_${this.request.address ? this.request.address : 'total'}-startTime_${startTime}-endTime_${endTime}.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export data provider delegations data', statsErr);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
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

    filterMyOptions(filter: string): void {
        this.filteredDataProvidersInfo = this.dataProvidersInfo.filter(dp => dp.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0 || dp.address.toLowerCase().indexOf(filter.toLowerCase()) >= 0);
    }
    getDataProviderInfo(address: string): DataProviderInfo {
        
        let dpInfo: DataProviderInfo = this.dataProvidersInfo.find(dpInfo => dpInfo.address == address);
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            return dpInfo;
        }
    }

    handleDataProviderChange(dataProviderAddress: MatSelectChange): void {
        this.request.address = dataProviderAddress.value;
        this._updateQueryParams(this.request).then();
    }
    
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }



}