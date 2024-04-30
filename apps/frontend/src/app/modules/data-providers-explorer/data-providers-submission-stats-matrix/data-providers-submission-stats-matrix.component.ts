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
import { CountdownComponent } from "app/commons/countdown/countdown.component";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { FeedsRequest } from "app/model/feeds-request";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { isEmpty, isNotEmpty } from "class-validator";
import { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions, NgApexchartsModule } from "ng-apexcharts";
import { MatomoTracker } from 'ngx-matomo';
import { Observable, Subject, forkJoin, takeUntil } from "rxjs";
import { Commons, DataProviderInfo, NetworkEnum, RewardEpochSettings } from "../../../../../../../libs/commons/src";
import { DataProviderSubmissionStats } from "../../../../../../../libs/commons/src/model/ftso/data-provider-submission-stats";

@Component({
    selector: 'flare-base-submission-stats-matrix',
    templateUrl: './data-providers-submission-stats-matrix.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, MatSelectModule, LoaderComponent, MatFormFieldModule, MatInputModule, MatButtonModule, MatMenuModule, CountdownComponent,
        NgApexchartsModule
    ],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProvidersSubmissionStatsMatrixComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    private _network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    rewardEpochSettings: RewardEpochSettings;
    selectedRewardEpoch: number = null;
    availableRewardEpochs: number[] = [];
    dataProvidersSubmissionStats: DataProviderSubmissionStats[] = [];
    loading: boolean;
    dataProvidersInfo: DataProviderInfo[];
    isNextRewardEpoch: boolean = false;
    chartOptions: ApexOptions = {};
    availableSymbols: string[];


    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _ftsoService: FtsoService,
        private _titleService: Title,
        private _matomoTracker: MatomoTracker
    ) {
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
                    let oldNetwork: NetworkEnum = this._network;
                    this._network = NetworkEnum[this._parentParams['network']];
                    await this._getRewardEpochSettings();
                    Commons.setPageTitle(`Flare base - ${this._network.charAt(0).toUpperCase() + this._network.slice(1)} - Data providers explorer - Reward epoch: ${this.selectedRewardEpoch}`, this._titleService, this._matomoTracker)
                    this._initializeChart();
                    await this.refreshData();
                }
            });
    }

    ngOnDestroy() {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    private async _getRewardEpochSettings(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.loading = true;
            this._epochsService.getRewardEpochSettings(this._network).subscribe(res => {
                this.rewardEpochSettings = res;
                this.availableRewardEpochs = [...this.rewardEpochSettings.getEpochIdsFromTimeRange(0, new Date().getTime())].sort((a, b) => b - a);
                this.availableRewardEpochs.splice(this.availableRewardEpochs.indexOf(0), 1);
                this.availableRewardEpochs.unshift(this.rewardEpochSettings.getNextEpochId());
                if (this._parentParams['rewardEpoch'] == 'current') {
                    // this.selectedRewardEpoch = this.rewardEpochSettings.getCurrentEpochId();
                    this.selectedRewardEpoch = 171;
                } else if (parseInt(this._parentParams['rewardEpoch']) > this.rewardEpochSettings.getNextEpochId()) {
                    this.selectedRewardEpoch = this.rewardEpochSettings.getNextEpochId();
                    this.isNextRewardEpoch = true;
                } else {
                    // this.selectedRewardEpoch = parseInt(this._parentParams['rewardEpoch']);
                    this.selectedRewardEpoch = 171;
                }
                /*  if (this.selectedRewardEpoch != parseInt(this._parentParams['rewardEpoch'])) {
                     this._router.navigate([this._network, 'data-providers', 'explorer', this.rewardEpochSettings.getCurrentEpochId()]);
                     resolve(false);
                 } else {
                     resolve(true);
                 } */
            }, err => {
                this._uiNotificationsService.error(`Unable to initialize component`, err);
                reject(err);
            }).add(() => {
                this.loading = false;
                resolve(false);
            })
        })
    }

    handleRewardEpochChange(rewardEpoch: MatSelectChange): void {
        this._router.navigate([this._network, 'delegations', 'explorer', rewardEpoch.value]);
    }
    getDataProviderInfo(address: string): DataProviderInfo {
        let dpInfo: DataProviderInfo = this.dataProvidersInfo.find(dpInfo => dpInfo.address == address);
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            dpInfo.name = address.toLowerCase();
            return dpInfo;
        }
    }
    refreshData(): Promise<void> {
        return new Promise<void>(resolve => {
            this.loading = true;
            this._cdr.detectChanges();
            const calls: Observable<void>[] = [
                this._getDataProvidersSubmissionStats(this.selectedRewardEpoch, '_getDataProvidersSubmissionStats'),
                this._getDataProvidersInfo('getDataProvidersInfo'),
                this._getAvailableSymbols()
            ];
            forkJoin(calls).subscribe(res => {
                this.parseChartData();
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
    private _getAvailableSymbols(): Observable<void> {
        return new Observable<void>(observer => {
            this.loading = true;
            let originalRequest = new FeedsRequest(null, null, null);
            originalRequest.startTime = this.rewardEpochSettings.getStartTimeForEpochId(172);
            originalRequest.endTime = this.rewardEpochSettings.getEndTimeForEpochId(172);
            originalRequest.symbol = 'all';
            this._ftsoService.getAvailableSymbols(this._network, originalRequest).subscribe(availableSymbols => {
                this.availableSymbols = availableSymbols;
                this._cdr.detectChanges();
                observer.next();
            }, availableSymbolsErr => {
                this._uiNotificationsService.error('Unable to get available symbols', availableSymbolsErr);
                observer.error(availableSymbolsErr);
            }).add(() => {
                this.loading = false;
                this._cdr.detectChanges();
                observer.complete();
            });
        })
    }

    private _getDataProvidersInfo(loaderId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.loading = true;
            this._ftsoService.getDataProvidersInfo(this._network).subscribe(dataProvidersInfo => {
                this.dataProvidersInfo = dataProvidersInfo;
                observer.next();
            }, err => {
                this._uiNotificationsService.error('Unable to get data providers info', err);
                observer.error(err);
            }).add(() => {
                this.loading = false;
                observer.complete();
            });
        });
    }
    private _getDataProvidersSubmissionStats(rewardEpoch: number, loaderId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.loading = true;
            let request: FeedsRequest = new FeedsRequest(null, null, null);
            request.symbol = 'all';
            this._ftsoService.getDataProviderSubmissionsStatsByRewardEpoch(this._network, request, rewardEpoch).subscribe(submissionStats => {
                this.dataProvidersSubmissionStats = submissionStats;
                observer.next();
            }, dataProvidersDataErr => {
                this._uiNotificationsService.error('Unable to fetch data providers submission stats', dataProvidersDataErr);
                observer.error(dataProvidersDataErr);
            }).add(() => {
                this.loading = false;
                observer.complete();
            });
        });
    }

    parseChartData() {
        if (this.dataProvidersSubmissionStats && this.dataProvidersSubmissionStats.length > 0) {
            let dpMap: { [dataProvider: string]: any[] } = {};
            this.dataProvidersSubmissionStats.map(stats => {
                if (!dpMap[stats.dataProvider]) { dpMap[stats.dataProvider] = [] }
            })
            for (let i in dpMap) {
                this.availableSymbols.sort((a, b) => a.localeCompare(b)).map(symbol => {
                    let found = this.dataProvidersSubmissionStats.find(dpStats => dpStats.symbol == symbol && dpStats.dataProvider == i);
                    if (found) {
                        dpMap[i].push({ x: symbol, y: found.successRatePct.toFixed(0) });
                    } else {
                        dpMap[i].push({ x: symbol, y: 0 });
                    }
                });
                /* let found = this.dataProvidersSubmissionStats.find(dpStats => dpStats.symbol == null && dpStats.dataProvider == i);
                if (found) {
                    dpMap[i].push({ x: 'All', y: found.successRatePct.toFixed(0) });
                } else {
                    dpMap[i].push({ x: 'All', y: 0 });
                } */
            }

            let chartSeries: any[] = [];
            for (let i in dpMap) {
                chartSeries.push({ name: this.getDataProviderInfo(i).name, data: dpMap[i] });
            }
            /*   chartSeries.forEach(item => {
                  item.data.sort((b, a) => (b.y + item.data.findIndex(item => item.x === b.x)) - (a.y + item.data.findIndex(item => item.x === a.x)));
              }); */
            /* chartSeries.forEach(item => {
                item.data.sort((a, b) => (b.y + item.data.findIndex(item => item.x === b.x)) - (a.y + item.data.findIndex(item => item.x === a.x)));
            }); */
            this.chartOptions.series = chartSeries;
            this._cdr.detectChanges();
        }

    }
    _initializeChart(): void {
        this.chartOptions = {
            series: [],
            
            chart: {
                
                height: '3000px',
                type: "heatmap",
                
            },
            dataLabels: {
                enabled: true
            },
            xaxis: { position: "top" },
            plotOptions: {
                heatmap: {
                    radius: 2,
                    
                    distributed: true,
                    shadeIntensity: 0.75,
                    reverseNegativeShade: false,
                    colorScale: {
                        inverse:true,
                        ranges: [
                            {
                                from: 60,
                                to: 100,
                                name: "high",
                                color: "#00A100"
                            },
                            {
                                from: 25,
                                to: 60,
                                name: "medium",
                                color: "#FFB200"
                            },
                            {
                                from: 0,
                                to: 25,
                                name: "low",
                                color: "#FF0000"
                            }
                        ]
                    }
                }
            }
        };
    }

}