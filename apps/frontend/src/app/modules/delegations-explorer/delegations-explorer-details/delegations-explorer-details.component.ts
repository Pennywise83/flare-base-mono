import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { DelegatorsRequest } from "app/model/delegators-request";
import { LoadingMap } from "app/model/loading-map";
import { CounterComponent } from "app/modules/counter/counter.component";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { isEmpty } from "lodash";
import { MatomoTracker } from "ngx-matomo";
import { Observable, Subject, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, DelegationDTO, NetworkEnum, PaginatedResult, RewardEpochSettings, VotePowerDTO } from "../../../../../../../libs/commons/src";
import { DataProviderDelegationsComponent, VotePowerDelegatorsChange } from "../data-provider-delegations/data-provider-delegations.component";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: 'flare-base-delegations-explorer-details',
    templateUrl: './delegations-explorer-details.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, CounterComponent, MatButtonModule,
        LoaderComponent, MatFormFieldModule, MatInputModule, ShortNumberPipe, TimeDiffPipe,
        DataProviderDelegationsComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DelegationsExplorerDetailsComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    rewardEpochSettings: RewardEpochSettings;
    dataProviderInfo: DataProviderInfo = null;
    availableRewardEpochs: number[] = [];
    loadingMap: LoadingMap;
    request: DelegatorsRequest;
    progress: number = 0;
    delegatedVotePower: VotePowerDTO = null;
    votePowerChange: number = 0;
    totalDelegatorsChange: number = 0;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    delegationsData: PaginatedResult<DelegationDTO[]> = null;
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    latestDelegations: PaginatedResult<DelegationDTO[]> = null;
    latestDelegationsTableColumns: string[] = ['timestamp', 'amount', 'from'];
    loading: boolean = false;
    refreshTimestamp: number;
    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _dataProvidersService: FtsoService,
        private _titleService: Title,
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
            if (this._parentParams['network'] != this.network || this._parentParams['address'] != this.request.address || parseInt(this._parentParams['rewardEpoch']) != this.request.epochId) {
                this.network = NetworkEnum[this._parentParams['network']];
                this.request = new DelegatorsRequest(this._parentParams['address'], null);
                this._epochsService.getRewardEpochSettings(this.network).subscribe(rewardEpochSettingsRes => {
                    this.rewardEpochSettings = rewardEpochSettingsRes;
                    this.availableRewardEpochs = [...this.rewardEpochSettings.getEpochIdsFromTimeRange(0, new Date().getTime())].sort((a, b) => b - a);
                    this.availableRewardEpochs.splice(this.availableRewardEpochs.indexOf(0), 1);
                    this.availableRewardEpochs.unshift(this.rewardEpochSettings.getNextEpochId());
                    if (this._parentParams['rewardEpoch'] == 'current') {
                        this.request.epochId = this.rewardEpochSettings.getCurrentEpochId();
                    } else if (parseInt(this._parentParams['rewardEpoch']) > this.rewardEpochSettings.getNextEpochId()) {
                        this.request.epochId = this.rewardEpochSettings.getNextEpochId();
                    } else {
                        this.request.epochId = parseInt(this._parentParams['rewardEpoch']);
                    }
                    this.request = new DelegatorsRequest(this.request.address, this.request.epochId);
                    this._getDataProvidersInfo(this.request.address).subscribe(dataProviderInfo => {
                        this.dataProviderInfo = dataProviderInfo;
                        Commons.setPageTitle(`Flare base - ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} - Delegations explorer - ${this.dataProviderInfo.name} (${this.request.epochId})`, this._titleService, this._matomoTracker)
                    })
                }, rewardEpochSettingsErr => {
                    this._uiNotificationsService.error(`Unable to initialize component`, rewardEpochSettingsErr);
                    return;
                });
            }
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }




    handleRewardEpochChange(rewardEpoch: MatSelectChange): void {
        this._router.navigate([this.network, 'delegations', 'explorer', rewardEpoch.value == 0 ? 'live' : rewardEpoch.value, this.request.address], {
            queryParams: {
                address: this.request.address,
                page: this.request.page,
                pageSize: this.request.pageSize,
                sortField: this.request.sortField,
                sortOrder: this.request.sortOrder
            }
        });
        this.request.epochId = rewardEpoch.value;
        this.refreshData();
    }
    private _getDataProvidersInfo(address: string): Observable<DataProviderInfo> {
        return new Observable<DataProviderInfo>(observer => {
            this.loadingMap.setLoading('getDataProviderInfo', true);
            this._dataProvidersService.getDataProviderInfoByAddress(this.network, address).subscribe(res => {
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
    refreshData() {
        this.refreshTimestamp = new Date().getTime();
        this._cdr.detectChanges();
    }
}
