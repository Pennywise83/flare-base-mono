import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatOptionModule } from "@angular/material/core";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { MatSortModule } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { DelegationsRequest } from "app/model/delegations-request";
import { DelegatorsRequest } from "app/model/delegators-request";
import { LoadingMap } from "app/model/loading-map";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { ChartCounterSparklineComponent } from "app/modules/chart-counter-sparkline/chart-counter-sparkline.component";
import { CounterComponent } from "app/modules/counter/counter.component";
import { DelegationsTableComponent } from "app/modules/delegations-table/delegations-table.component";
import { DelegatotionService } from "app/services/delegations.service";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { VotePowerService } from "app/services/votepower.service";
import { isDefined, isEmpty } from "class-validator";
import { MatomoTracker } from 'ngx-matomo';
import { Socket } from "ngx-socket-io";
import { Observable, Subject, forkJoin, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, DelegationDTO, DelegationsSortEnum, NetworkEnum, PaginatedResult, RewardEpochSettings, SortOrderEnum, VotePowerDTO } from "../../../../../../../libs/commons/src";
import { VotePowerDelegationsChangeTableComponent } from "./vote-power-delegations-table/vote-power-delegations-table.component";
import { VotePowerOverDelegationsChartComponent } from "./vote-power-over-delegations-chart/vote-power-over-delegations-chart.component";

@Component({
    selector: 'flare-base-data-provider-delegations',
    templateUrl: './data-provider-delegations.component.html',
    styleUrls: ['./data-provider-delegations.component.scss'],
    imports: [AppModule, MatIconModule, FormsModule, MatSelectModule, RouterLink, RouterLinkActive, MatButtonModule,
        LoaderComponent, NoDataComponent, MatTooltipModule, MatOptionModule, ChartCounterSparklineComponent, DelegationsTableComponent,
        CounterComponent, DecimalPipe, MatTableModule, MatPaginatorModule, MatSortModule, VotePowerDelegationsChangeTableComponent, VotePowerOverDelegationsChartComponent

    ],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DecimalPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProviderDelegationsComponent implements OnInit, OnDestroy {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    address: string;
    rewardEpochSettings: RewardEpochSettings;
    dataProviderInfo: DataProviderInfo = null;
    availableRewardEpochs: number[] = [];
    loadingMap: LoadingMap;
    request: DelegatorsRequest = new DelegatorsRequest(null, null);
    progress: number = 0;
    selectedRewardEpoch: number;
    delegatedVotePower: VotePowerDTO = null;
    votePowerChange: number = 0;
    totalDelegatorsChange: number = 0;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    delegationsData: PaginatedResult<DelegationDTO[]> = null;
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    latestDelegations: PaginatedResult<DelegationDTO[]> = null;
    latestDelegationsTableColumns: string[] = ['timestamp', 'amount', 'from'];
    loading: boolean = false;
    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _socket: Socket,
        private _delegationsService: DelegatotionService,
        private _votePowerService: VotePowerService,
        private _epochsService: EpochsService,
        private _titleService: Title,
        private _dataProvidersService: FtsoService,
        private _matomoTracker: MatomoTracker
    ) {
        this.loadingMap = new LoadingMap(this._cdr);
    }

    ngOnInit(): void {
        Utils.getParentParams(this._route).pipe(takeUntil(this._unsubscribeAll)).subscribe(params => {
            this._parentParams = { ...this._parentParams, ...params };
            if (isEmpty(this._parentParams['network']) || isEmpty(this._parentParams['rewardEpoch'])) {
                this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                return;
            }
            if (this._parentParams['network'] != this._network || this._parentParams['address'] != this.address || parseInt(this._parentParams['rewardEpoch']) != this.selectedRewardEpoch) {
                this._network = NetworkEnum[this._parentParams['network']];
                this.address = this._parentParams['address'];
                this._epochsService.getRewardEpochSettings(this._network).subscribe(rewardEpochSettingsRes => {
                    this.rewardEpochSettings = rewardEpochSettingsRes;
                    this.availableRewardEpochs = [...this.rewardEpochSettings.getEpochIdsFromTimeRange(0, new Date().getTime())].sort((a, b) => b - a);
                    this.availableRewardEpochs.splice(this.availableRewardEpochs.indexOf(0), 1);
                    this.availableRewardEpochs.unshift(this.rewardEpochSettings.getNextEpochId());
                    if (this._parentParams['rewardEpoch'] == 'current') {
                        this.selectedRewardEpoch = this.rewardEpochSettings.getCurrentEpochId();
                    } else if (parseInt(this._parentParams['rewardEpoch']) > this.rewardEpochSettings.getNextEpochId()) {
                        this.selectedRewardEpoch = this.rewardEpochSettings.getNextEpochId();
                    } else {
                        this.selectedRewardEpoch = parseInt(this._parentParams['rewardEpoch']);
                    }
                    if (this.selectedRewardEpoch != parseInt(this._parentParams['rewardEpoch'])) {
                        this._router.navigate([this._network, 'delegations', 'explorer', this.rewardEpochSettings.getCurrentEpochId(), this.address]);
                    }
                    this.request = new DelegatorsRequest(this.address, this.selectedRewardEpoch);
                    this._parseQueryParams();
                }, rewardEpochSettingsErr => {
                    this._uiNotificationsService.error(`Unable to initialize component`, rewardEpochSettingsErr);
                    return;
                }).add(() => {
                    this.refreshData(this.request);
                });
            }
        });
    }
    selectDelegator(delegator: { value: string, targetRoute: string[] }): void {
        if (delegator.targetRoute.includes('delegations')) {
            this._router.navigate([this._network, ...delegator.targetRoute], { queryParams: { from: delegator.value } });
        } else if (delegator.targetRoute.includes('rewards')) {
            this._router.navigate([this._network, ...delegator.targetRoute], { queryParams: { whoClaimed: delegator.value } });
        }
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }




    handleRewardEpochChange(rewardEpoch: MatSelectChange): void {
        this._router.navigate([this._network, 'delegations', 'explorer', rewardEpoch.value == 0 ? 'live' : rewardEpoch.value, this.address], {
            queryParams: {
                page: this.request.page,
                pageSize: this.request.pageSize,
                sortField: this.request.sortField,
                sortOrder: this.request.sortOrder
            }
        });
    }

    handleRequestEvent(requestEvent: DelegatorsRequest): void {
        this.request = requestEvent;
        this._getDelegatorsAt(requestEvent).subscribe(res => {
            this.delegationsData = res;
            this.loadingMap.setLoading('getDelegatorsAt', false);
        });
    }

    private _getDelegatorsAt(request: DelegatorsRequest): Observable<PaginatedResult<DelegationDTO[]>> {
        return new Observable<PaginatedResult<DelegationDTO[]>>(observer => {
            this.loadingMap.setLoading('getDelegatorsAt', true);
            this._delegationsService.getDelegators(this._network, request).subscribe(delegatorsRes => {
                this._updateQueryParams(request.page, request.pageSize, request.sortField, request.sortOrder);
                this.delegationsData = delegatorsRes;
                observer.next(delegatorsRes);
            }, delegatorsErr => {
                this._uiNotificationsService.error('Unable to fetch delegations for the selected data provider ', delegatorsErr);
                observer.error(delegatorsErr);
            }).add(() => {
                this.loadingMap.setLoading('getDelegatorsAt', false);
                this._cdr.detectChanges();
                observer.complete();
            });
        });
    }

    private _getDataProvidersInfo(address: string): Observable<DataProviderInfo> {
        return new Observable<DataProviderInfo>(observer => {
            this.loadingMap.setLoading('getDataProviderInfo', true);
            this._dataProvidersService.getDataProviderInfoByAddress(this._network, address).subscribe(res => {
                this.dataProviderInfo = res;
                observer.next(res);
            }, err => {
                this._uiNotificationsService.error('Unable to get data provider info', err);
                observer.error(err);
            }).add(() => {
                this.loadingMap.setLoading('getDataProviderInfo', false);
                observer.complete();
            });
        });
    }
    private _getLatestDelegations(address: string, startTime: number, endTime: number, size: number): Observable<PaginatedResult<DelegationDTO[]>> {
        return new Observable<PaginatedResult<DelegationDTO[]>>(observer => {
            this.loadingMap.setLoading('getLatestDelegations', true);
            const request: DelegationsRequest = new DelegationsRequest(null, address, startTime, endTime);
            request.pageSize = size;
            this.latestDelegations = null;
            this._delegationsService.getDelegations(this._network, request).subscribe(latestDelegations => {
                this.latestDelegations = latestDelegations;
                this._cdr.detectChanges();
                observer.next(latestDelegations);
            }, latestDelegationsErr => {
                this._uiNotificationsService.error('Unable to fetch latest delegations', latestDelegationsErr);
                observer.error(latestDelegationsErr);
            }).add(() => {
                this.loadingMap.setLoading('getLatestDelegations', false);
                observer.complete();
            });
        });
    }
    refreshData(request: DelegatorsRequest): void {
        const startTime: number = this.rewardEpochSettings.getStartTimeForEpochId(this.selectedRewardEpoch - 60);
        const endTime: number = this.rewardEpochSettings.getEndTimeForEpochId(this.selectedRewardEpoch);
        this.loading = true;
        const calls: Observable<PaginatedResult<DelegationDTO[]> | DataProviderInfo | VotePowerDTO[] | PaginatedResult<DelegationDTO[]>>[] = [
            this._getDelegatorsAt(request),
            this._getDataProvidersInfo(this.address),
            this._getDelegatedVotePowerHistory(startTime, endTime),
            this._getLatestDelegations(this.address, startTime, endTime, 250)
        ];
        forkJoin(calls).subscribe(res => {
            Commons.setPageTitle(`Flare base - ${this._network.charAt(0).toUpperCase() + this._network.slice(1)} - Delegations explorer - ${this.dataProviderInfo.name} (${this.selectedRewardEpoch})`, this._titleService,this._matomoTracker)
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }
    static getVotePowerAndDelegatorsChange(votePowerHistory: VotePowerDTO[], size: number, rewardEpochSettings: RewardEpochSettings): VotePowerDelegatorsChange[] {
        let results: VotePowerDelegatorsChange[] = [];
        votePowerHistory.sort((a, b) => b.rewardEpochId - a.rewardEpochId).map((vpHistory, idx) => {
            if (idx < size) {
                let tmpObj: VotePowerDelegatorsChange = new VotePowerDelegatorsChange();
                tmpObj.rewardEpoch = vpHistory.rewardEpochId;
                tmpObj.rewardEpochEndTime = rewardEpochSettings.getEndTimeForEpochId(vpHistory.rewardEpochId);
                tmpObj.rewardEpochStartTime = rewardEpochSettings.getStartTimeForEpochId(vpHistory.rewardEpochId);
                tmpObj.votePower = vpHistory.amount;
                tmpObj.delegatorsCount = vpHistory.delegators;
                tmpObj.votePowerChange = (((vpHistory.amount * 100) / votePowerHistory[idx + 1].amount) - 100);
                tmpObj.delegatorsCountChange = (((vpHistory.delegators * 100) / votePowerHistory[idx + 1].delegators) - 100);
                results.push(tmpObj);
            }
        });
        return results;
    }


    private parseVPHistoryData() {
        this.delegatedVotePower = { address: null, amount: 0, delegations: 0, delegators: 0, timestamp: 0, rewardEpochId: 0 };
        this.votePowerChange = null;
        this.totalDelegatorsChange = null;
        if (this.delegatedVotePowerHistory.length > 0) {
            this.delegatedVotePower = this.delegatedVotePowerHistory.filter(ds => ds.rewardEpochId == this.selectedRewardEpoch)[0];
            this.votePowerChange = (((this.delegatedVotePower.amount * 100) / this.delegatedVotePowerHistory[1].amount) - 100);
            this.totalDelegatorsChange = (((this.delegatedVotePower.delegators * 100) / this.delegatedVotePowerHistory[1].delegators) - 100);
        }
    }

    private _getDelegatedVotePowerHistory(startTime: number, endTime: number): Observable<VotePowerDTO[]> {
        return new Observable<VotePowerDTO[]>(observer => {
            this.loadingMap.setLoading('getDelegatedVotePowerHistory', true);
            let request: VotePowerHistoryRequest = new VotePowerHistoryRequest(this.address, startTime, endTime);
            request.pageSize = 60;
            this._votePowerService.getDelegatedVotePowerHistory(this._network, request).subscribe(votePowerHistory => {
                if (votePowerHistory.results.length > 0) {
                    this.delegatedVotePowerHistory = votePowerHistory.results;
                    this.votePowerHistoryChange = DataProviderDelegationsComponent.getVotePowerAndDelegatorsChange(votePowerHistory.results, votePowerHistory.results.length - 1, this.rewardEpochSettings);
                    this.parseVPHistoryData();
                    observer.next(votePowerHistory.results);
                }
            }, votePowerHistoryErr => {
                this._uiNotificationsService.error('Unable to get delegated vote power history for the selected data provider', votePowerHistoryErr);
                observer.error(votePowerHistoryErr);
            }).add(() => {
                this.loadingMap.setLoading('getDelegatedVotePowerHistory', false);
                observer.complete();
            });
        });
    }

    trackByFn(index: number, item: any): any {
        return item.address || index;
    }

    private _parseQueryParams(): void {
        this.request.page = isNaN(parseInt(this._route.snapshot.queryParamMap.get('page'))) ? 1 : parseInt(this._route.snapshot.queryParamMap.get('page'));
        this.request.pageSize = isNaN(parseInt(this._route.snapshot.queryParamMap.get('pageSize'))) ? 25 : parseInt(this._route.snapshot.queryParamMap.get('pageSize'));
        this.request.sortField = (isDefined(this._route.snapshot.queryParamMap.get('sortField')) && isDefined(DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')])) ? DelegationsSortEnum[this._route.snapshot.queryParamMap.get('sortField')] : DelegationsSortEnum.timestamp;
        this.request.sortOrder = (isDefined(this._route.snapshot.queryParamMap.get('sortOrder')) && isDefined(SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')])) ? SortOrderEnum[this._route.snapshot.queryParamMap.get('sortOrder')] : SortOrderEnum.desc;
        //this._updateQueryParams(this.request.page, this.request.pageSize, this.request.sortField, this.request.sortOrder);
    }



    private _updateQueryParams(page: number, pageSize: number, sortField: DelegationsSortEnum, sortOrder: SortOrderEnum) {
        this._cdr.detectChanges();
        const currentParams = { ...this._route.snapshot.queryParams };
        currentParams['page'] = page;
        currentParams['pageSize'] = pageSize;
        currentParams['sortField'] = sortField;
        currentParams['sortOrder'] = sortOrder;
        this._cdr.detectChanges();
        this._router.navigate([], {
            relativeTo: this._route,
            queryParams: currentParams,
            preserveFragment: true,
            queryParamsHandling: 'merge', // Mantieni gli altri queryParams
        });
    }
    showVotePowerHistory(): void {
        this._router.navigate([this._network, 'delegations', 'votepower-history'], { queryParams: { address: this.address } });
    }
    showDelegations(): void {
        this._router.navigate([this._network, 'delegations', 'search'], { queryParams: { to: this.address } });
    }
}


export class VotePowerDelegatorsChange {
    rewardEpoch: number;
    rewardEpochStartTime: number;
    rewardEpochEndTime: number;
    votePower: number;
    votePowerChange: number;
    delegatorsCount: number;
    delegatorsCountChange: number;
}