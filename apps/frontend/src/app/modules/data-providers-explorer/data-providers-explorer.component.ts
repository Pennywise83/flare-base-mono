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
import { CountdownComponent } from "app/commons/countdown/countdown.component";
import { DataProviderSearchFilter } from "app/model/data-provider-search-filter";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { VotePowerService } from "app/services/votepower.service";
import { isEmpty } from "class-validator";
import { saveAs } from 'file-saver';
import { MatomoTracker } from 'ngx-matomo';
import { Observable, Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from "rxjs";
import { Commons, DataProviderExtendedInfo, DataProviderInfo, NetworkEnum, RewardEpochSettings, VotePowerDTO } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { ShortNumberPipe } from "../../commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "../../commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "../../commons/ui-notifications/ui-notifications.service";
import { Utils } from "../../commons/utils";
import { LoadingMap } from "../../model/loading-map";
import { EpochsService } from "../../services/epochs.service";
import { FtsoService } from "../../services/ftso.service";
import { CounterComponent } from "../counter/counter.component";
import { DataProvidersComponent } from "../data-providers/data-providers.component";
import { DataProviderDelegationsComponent, VotePowerDelegatorsChange } from "../delegations-explorer/data-provider-delegations/data-provider-delegations.component";
import { DelegationsTableComponent } from "../delegations-table/delegations-table.component";



@Component({
    selector: 'flare-base-delegations-explorer',
    templateUrl: './data-providers-explorer.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, CounterComponent,
        LoaderComponent, DataProvidersComponent, MatFormFieldModule, MatInputModule, DelegationsTableComponent, ShortNumberPipe, TimeDiffPipe,
        MatButtonModule, MatMenuModule, CountdownComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProvidersExplorerComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    loadingMap: LoadingMap;
    rewardEpochSettings: RewardEpochSettings;
    selectedRewardEpoch: number = null;
    availableRewardEpochs: number[] = [];
    dataProvidersData: DataProviderExtendedInfo[] = [];
    loading: boolean;
    searchFilter$ = new Subject<any>();
    searchFilter: DataProviderSearchFilter = { nameOrAddress: '', whitelisted: true, listed: true };
    dataProvidersInfo: DataProviderInfo[];
    isCurrentRewardEpoch: boolean = false;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    votePowerChange: number = 0;
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    activeDataProvidersSum: number;


    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _votePowerService: VotePowerService,
        private _ftsoService: FtsoService,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker
    ) {
        this.loadingMap = new LoadingMap(this._cdr);
    }

    ngOnInit(): void {
        Utils.getParentParams(this._route).pipe(
            takeUntil(this._unsubscribeAll))
            .subscribe(async params => {
                this._parentParams = { ...this._parentParams, ...params };
                if (isEmpty(this._parentParams['network']) || isEmpty(this._parentParams['rewardEpoch'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    this.loading = false;
                    return;
                }
                if (this.selectedRewardEpoch != parseInt(this._parentParams['rewardEpoch']) || this._network != this._parentParams['network']) {
                    this._network = NetworkEnum[this._parentParams['network']];
                    await this._getRewardEpochSettings();
                    Commons.setPageTitle(`Flare base - ${this._network.charAt(0).toUpperCase() + this._network.slice(1)} - Data providers explorer - Reward epoch: ${this.selectedRewardEpoch}`, this._titleService, this._matomoTracker)
                    await this.refreshData();
                }
            });
        this.searchFilter$.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(250),
            distinctUntilChanged()
        ).subscribe((filterValue: any) => {
            this.searchFilter = filterValue;
            this._cdr.detectChanges();
        });
    }

    getNameFilter(searchFilter: string): string {
        return searchFilter.split(';;;')[0];
    }
    ngOnDestroy() {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    private async _getRewardEpochSettings(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.loadingMap.setLoading('getRewardEpochSettings', true);
            this._epochsService.getRewardEpochSettings(this._network).subscribe(res => {
                this.rewardEpochSettings = res;
                this.availableRewardEpochs = [...this.rewardEpochSettings.getEpochIdsFromTimeRange(0, new Date().getTime())].sort((a, b) => b - a);
                this.availableRewardEpochs.splice(this.availableRewardEpochs.indexOf(0), 1);
                if (this._parentParams['rewardEpoch'] == 'current') {
                    this.selectedRewardEpoch = this.rewardEpochSettings.getCurrentEpochId();
                    this.isCurrentRewardEpoch = true;
                } else if (parseInt(this._parentParams['rewardEpoch']) > this.rewardEpochSettings.getCurrentEpochId()) {
                    this.selectedRewardEpoch = this.rewardEpochSettings.getCurrentEpochId();
                } else {
                    this.selectedRewardEpoch = parseInt(this._parentParams['rewardEpoch']);
                    if (this.selectedRewardEpoch == this.rewardEpochSettings.getCurrentEpochId()) {
                        this.isCurrentRewardEpoch = true;
                    } else {
                        this.isCurrentRewardEpoch = false;
                    }
                }
            }, err => {
                this._uiNotificationsService.error(`Unable to initialize component`, err);
                reject(err);
            }).add(() => {
                this.loadingMap.setLoading('getRewardEpochSettings', false);
                resolve(false);
            })
        })
    }

    handleRewardEpochChange(rewardEpoch: MatSelectChange): void {

        this._router.navigate([this._network, 'ftso', 'data-providers-explorer', rewardEpoch.value]);
    }

    refreshData(): Promise<void> {
        return new Promise<void>(resolve => {
            this.loading = true;
            this._cdr.detectChanges();
            const calls: Observable<void>[] = [
                this._getDataProvidersData(this.selectedRewardEpoch, 'getDataProvidersData'),
                this._getDataProvidersInfo('getDataProvidersInfo'),
                this._getVotePowerHistory(this.rewardEpochSettings.getStartTimeForEpochId(this.selectedRewardEpoch - 2), this.rewardEpochSettings.getEndTimeForEpochId(this.selectedRewardEpoch), 'getVotePowerHistory'),
            ];
            forkJoin(calls).subscribe(res => {
            }, err => {
                this._uiNotificationsService.error(`Unable to get delegations info`, err);
                resolve();
            }).add(() => {
                this.loading = false;
                this._cdr.detectChanges();
                resolve();
            });
        });
    }
    private _getVotePowerHistory(startTime: number, endTime: number, loaderId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.loadingMap.setLoading(loaderId, true);
            let request: VotePowerHistoryRequest = new VotePowerHistoryRequest(null, startTime, endTime);
            request.pageSize = 60;
            this._votePowerService.getDelegatedVotePowerHistory(this._network, request).subscribe(votePowerHistory => {
                this.delegatedVotePowerHistory = votePowerHistory.results;
                if (votePowerHistory.results.length > 1) {
                    this.votePowerChange = (((votePowerHistory.results[0].amount * 100) / votePowerHistory.results[1].amount) - 100);
                    this.votePowerHistoryChange = DataProviderDelegationsComponent.getVotePowerAndDelegatorsChange(votePowerHistory.results, votePowerHistory.results.length - 1, this.rewardEpochSettings);
                    this._cdr.detectChanges();
                } else {
                    this.votePowerChange = 0;
                }
                observer.next();
            }, votePowerHistoryErr => {
                this._uiNotificationsService.error('Unable to fetch vote power history', votePowerHistoryErr);
                observer.error(votePowerHistoryErr);
            }).add(() => {
                this.loadingMap.setLoading(loaderId, false);
                observer.complete();
            });
        });
    }

    private _getDataProvidersInfo(loaderId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.loadingMap.setLoading(loaderId, true);
            this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfo => {
                this.dataProvidersInfo = dataProvidersInfo;
                observer.next();
            }, err => {
                this._uiNotificationsService.error('Unable to get data providers info', err);
                observer.error(err);
            }).add(() => {
                this.loadingMap.setLoading(loaderId, false);
                observer.complete();
            });
        });
    }
    private _getDataProvidersData(rewardEpoch: number, loaderId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.loadingMap.setLoading(loaderId, true);
            this._ftsoService.getDataProvidersData(this._network, rewardEpoch).subscribe(dataProvidersData => {
                this.dataProvidersData = dataProvidersData.result.filter(dp => dp.availabilityRewardEpoch > 0);
                let activeDataProvidersSum: number = 0;
                dataProvidersData.result.filter(dpData => dpData.availabilityRewardEpoch > 0).map(dpData => activeDataProvidersSum += 1);
                this.activeDataProvidersSum = activeDataProvidersSum;

                observer.next();
            }, dataProvidersDataErr => {
                this._uiNotificationsService.error('Unable to fetch data providers data', dataProvidersDataErr);
                observer.error(dataProvidersDataErr);
            }).add(() => {
                this.loadingMap.setLoading(loaderId, false);
                observer.complete();
            });
        });
    }
    showVotePowerHistory(): void {
        this._router.navigate([this._network, 'data-providers', 'votepower-history']);
    }
    showLatestDelegations(): void {
        this._router.navigate([this._network, 'delegations', 'search']);
    }


    exportDataProviderData(): void {
        this.loading = true;
        this._ftsoService.getDataProviderDelegationsStatsCsv(this._network, this.selectedRewardEpoch).subscribe(dataProviderDelegationsStats => {
            saveAs(dataProviderDelegationsStats, `${this._network}-${this.selectedRewardEpoch}-Data_providers_delegations_data.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export data provider delegations data', statsErr);
        }).add(() => {
            this.loading = false;
        });
    }

    handleSelectedDataProvider(address: string) {
        let startTime: number;
        let endTime: number;
        if (this.selectedRewardEpoch == this.rewardEpochSettings.getCurrentEpochId()) {
            startTime = new Date().getTime() - (60 * 60 * 1000);
            endTime = new Date().getTime()-10000;
        } else {
            startTime = this.rewardEpochSettings.getEndTimeForEpochId(this.selectedRewardEpoch) - (60 * 60 * 1000);
            endTime = this.rewardEpochSettings.getEndTimeForEpochId(this.selectedRewardEpoch)-10000;
        }
        this._router.navigate([this._network, 'ftso', 'data-providers', 'feeds'], { queryParams: { address: address, startTime: startTime, endTime: endTime } });
    }
    selectDelegator(delegator: { value: string, targetRoute: string[] }): void {
        if (delegator.targetRoute.includes('delegations')) {
            this._router.navigate([this._network, ...delegator.targetRoute], { queryParams: { from: delegator.value } });
        } else if (delegator.targetRoute.includes('rewards')) {
            this._router.navigate([this._network, ...delegator.targetRoute], { queryParams: { whoClaimed: delegator.value } });
        }

    }
    selectDataProvider(dataProvider: { value: string, targetRoute: string[] }): void {
        if (dataProvider.targetRoute.includes('delegations')) {
            if (dataProvider.targetRoute.includes('explorer')) {
                dataProvider.targetRoute[2] = this.selectedRewardEpoch.toString();
                this._router.navigate([this._network, ...dataProvider.targetRoute]);

            } else {
                this._router.navigate([this._network, ...dataProvider.targetRoute], { queryParams: { to: dataProvider.value } });

            }
        } else if (dataProvider.targetRoute.includes('rewards')) {
            this._router.navigate([this._network, ...dataProvider.targetRoute], { queryParams: { dataProvider: dataProvider.value } });
        }
    }

}