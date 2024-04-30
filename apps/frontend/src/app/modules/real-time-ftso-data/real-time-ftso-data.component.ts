import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NgDatePickerModule } from "app/commons/ng-datetime-picker/public-api";
import { ShortNumberPipe } from "app/commons/pipes/short-number.pipe";
import { TimeDiffPipe } from "app/commons/pipes/time-diff.pipe";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { PriceDataEpochRequest, PriceDataEpochRequestSortEnum } from "app/model/price-data-epoch-request";
import { CounterComponent } from "app/modules/counter/counter.component";
import { EpochsService } from "app/services/epochs.service";
import { FtsoService } from "app/services/ftso.service";
import { isNotEmpty } from "class-validator";
import { isEmpty } from "lodash";
import { ApexOptions, ChartComponent, NgApexchartsModule } from "ng-apexcharts";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { MatomoTracker } from "ngx-matomo";
import { Socket } from "ngx-socket-io";
import { Observable, Subject, Subscription, firstValueFrom, forkJoin, takeUntil, timer } from "rxjs";
import { DataProviderInfo, HashSubmitted, HashSubmittedMatrix, HashSubmittedRealTimeData, IRealTimeData, NetworkEnum, PriceEpochSettings, PriceFinalized, PriceFinalizedRealTimeData, PriceRevealed, PriceRevealedRealTimeData, RealTimeDataTypeEnum, RealTimeFtsoData, RewardEpochSettings, WebsocketTopicsEnum } from "../../../../../../libs/commons/src";
import { CommonModule } from "@angular/common";


@Component({
    selector: 'flare-base-real-time-ftso-data',
    templateUrl: './real-time-ftso-data.component.html',
    imports: [AppModule, CommonModule, MatIconModule, RouterModule, FormsModule, MatSelectModule,
        LoaderComponent, MatFormFieldModule, MatInputModule, ShortNumberPipe, TimeDiffPipe,
        NgxMatSelectSearchModule, NgDatePickerModule, MatSlideToggleModule, CounterComponent,
        NgApexchartsModule,
        MatButtonModule, MatMenuModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [ShortNumberPipe, TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class RealTimeFtsoDataComponent implements OnInit, OnDestroy, OnChanges {
    private _parentParams: { [param: string]: string };
    network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @ViewChild("realTimeFtsoChart") chart: ChartComponent;
    rewardEpochSettings: RewardEpochSettings;
    priceEpochSettings: PriceEpochSettings;
    dataProviderInfo: DataProviderInfo[];
    loading: boolean;
    selectedPriceEpochId: number;
    request: PriceDataEpochRequest;
    dataProvidersInfoMap: Record<string, DataProviderInfo> = {};
    revealedPrices: PriceRevealed[];
    finalizedPrices: PriceFinalized[];
    submittedHashes: HashSubmitted[];
    chartOptions: ApexOptions;
    realTimeDataTypes = RealTimeDataTypeEnum;
    private _realTimeFtsoDataSubscription: Subscription = new Subscription();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _epochsService: EpochsService,
        private _ftsoService: FtsoService,
        private _socket: Socket,
        private _titleService: Title,
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
                this.network = NetworkEnum[this._parentParams['network']];

                let calls: Observable<RewardEpochSettings | PriceEpochSettings | DataProviderInfo[]>[] = [];
                calls.push(this._epochsService.getRewardEpochSettings(this.network));
                calls.push(this._epochsService.getPriceEpochSettings(this.network));
                calls.push(this._ftsoService.getDataProvidersInfo(this.network));
                forkJoin(calls).subscribe(async res => {
                    this.rewardEpochSettings = res[0] as RewardEpochSettings;
                    this.priceEpochSettings = res[1] as PriceEpochSettings;
                    this.dataProviderInfo = res[2] as DataProviderInfo[];
                    if (isNotEmpty(this.dataProviderInfo)) {
                        this.dataProviderInfo.map(dpInfo => {
                            this.dataProvidersInfoMap[dpInfo.address] = this.getDataProviderInfo(dpInfo.address);
                        });
                    }
                    /* this._initializeChart(); */
                    if (this._parentParams['priceEpoch'] == 'current') {
                        this.selectedPriceEpochId = this.priceEpochSettings.getCurrentEpochId();
                        let realTimeData = await firstValueFrom(this._ftsoService.getRealTimeFtsoData(this.network));
                        this.parseRealTimeData(realTimeData);
                        this._socket.connect()
                        this._realTimeFtsoDataSubscription = this._socket.fromEvent(`${WebsocketTopicsEnum.REAL_TIME_FTSO_DATA.toString()}_${this.network}`).
                            pipe(takeUntil(this._unsubscribeAll)).subscribe((realTimeData: IRealTimeData) => {
                                this.parseWsRealTimeData(realTimeData);
                            });
                    } else if (parseInt(this._parentParams['priceEpoch']) > this.priceEpochSettings.getCurrentEpochId()) {
                        this.selectedPriceEpochId = this.priceEpochSettings.getCurrentEpochId();
                    } else {
                        this.selectedPriceEpochId = parseInt(this._parentParams['priceEpoch']);
                        this.request = new PriceDataEpochRequest(this.selectedPriceEpochId);
                        await this.refreshData();
                    }

                    this.loading = false;

                    this._cdr.detectChanges();
                });
            })
    }
    epochIds: number[];
    parseRealTimeData(realTimeData: RealTimeFtsoData) {
        if (realTimeData.hashSubmitted && realTimeData.hashSubmitted.length > 0) {
            realTimeData.hashSubmitted.map(hashSubmitted => {
                if (!this.realTimeDataMap[hashSubmitted.epochId]) { this.realTimeDataMap[hashSubmitted.epochId] = [] }
                this.realTimeDataMap[hashSubmitted.epochId].push(hashSubmitted);
            })
        }
        if (realTimeData.revealedPrices && realTimeData.revealedPrices.length > 0) {
            realTimeData.revealedPrices.map(revealedPrice => {
                if (!this.realTimeDataMap[revealedPrice.epochId]) { this.realTimeDataMap[revealedPrice.epochId] = [] }
                this.realTimeDataMap[revealedPrice.epochId].push(revealedPrice as any);
            })
        }
        if (realTimeData.finalizedPrices && realTimeData.finalizedPrices.length > 0) {
            realTimeData.finalizedPrices.map(finalizedPrice => {
                if (!this.realTimeDataMap[finalizedPrice.epochId]) { this.realTimeDataMap[finalizedPrice.epochId] = [] }
                this.realTimeDataMap[finalizedPrice.epochId].push(finalizedPrice as any);
            })
        }
        this.epochIds = (Array.from(new Set(Object.keys(this.realTimeDataMap))).sort((a, b) => parseInt(b) - parseInt(a))) as any;
        this.epochIds.map(epochId => {
            this.realTimeDataMap[epochId] = this.realTimeDataMap[epochId].sort((a, b) => b.timestamp - a.timestamp);
        })
        this._cdr.detectChanges();
        this._cdr.detectChanges();
    }

    realTimeDataMap: Record<number, IRealTimeData[]> = {};
    private parseWsRealTimeData(data: IRealTimeData) {
        switch (data.type) {
            case RealTimeDataTypeEnum.hashSubmitted:
                if (!this.realTimeDataMap[this.asHashSubmitted(data).epochId]) { this.realTimeDataMap[this.asHashSubmitted(data).epochId] = [] }
                this.realTimeDataMap[this.asHashSubmitted(data).epochId].push(data);
                break;
                break;

            case RealTimeDataTypeEnum.finalizedPrice:
                if (!this.realTimeDataMap[this.asPriceFinalized(data).epochId]) { this.realTimeDataMap[this.asPriceFinalized(data).epochId] = [] }
                this.realTimeDataMap[this.asPriceFinalized(data).epochId].push(data);
                break;

            case RealTimeDataTypeEnum.revealedPrice:
                if (!this.realTimeDataMap[this.asPriceRevealed(data).epochId]) { this.realTimeDataMap[this.asPriceRevealed(data).epochId] = [] }
                this.realTimeDataMap[this.asPriceRevealed(data).epochId].push(data);

                break;
        }
        this.epochIds = (Array.from(new Set(Object.keys(this.realTimeDataMap))).sort((a, b) => parseInt(b) - parseInt(a))) as any;
        this.epochIds.map(epochId => {
            this.realTimeDataMap[epochId] = this.realTimeDataMap[epochId].sort((a, b) => b.timestamp - a.timestamp);
        })
        this._cdr.detectChanges();
    }

    async refreshData(): Promise<void> {
        this.request.sortField = PriceDataEpochRequestSortEnum.epochId;
        this.revealedPrices = (await firstValueFrom(this._ftsoService.getRevealedPricesByEpochId(this.network, this.request))).results;
        this.finalizedPrices = (await firstValueFrom(this._ftsoService.getFinalizedPricesByEpochId(this.network, this.request))).results;
        this.submittedHashes = (await firstValueFrom(this._ftsoService.getSubmittedHashesByEpochId(this.network, this.request))).results;
        /* this._parseChartData(); */
        this._cdr.detectChanges();
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
    ngOnChanges(changes: SimpleChanges): void {
    }
    private _parseChartData() {
        let addresses: string[] = Array.from(new Set(this.revealedPrices.map(sh => sh.dataProvider)));
        let dataProvidersInfo: Record<string, DataProviderInfo> = {};
        addresses.map(address => {
            if (!dataProvidersInfo[address]) {
                dataProvidersInfo[address] = this.dataProvidersInfoMap[address];
            }
        });
        let colors: string[] = Utils.getColors();
        let colorsLight: string[] = Utils.getColors(0.7);
        let xAxisAnnotations: any[] = [];

        this.chartOptions.xaxis.min = this.priceEpochSettings.getStartTimeForEpochId(this.selectedPriceEpochId) - 5000;
        this.chartOptions.xaxis.max = this.priceEpochSettings.getRevealEndTimeForEpochId(this.selectedPriceEpochId) + 5000;
        xAxisAnnotations.push({
            x: this.priceEpochSettings.getStartTimeForEpochId(this.selectedPriceEpochId),
            strokeDashArray: 2,
            borderColor: colors[0],
            label: {
                borderColor: colors[0],
                style: {
                    color: '#fff',
                    background: colorsLight[0]
                },
                text: 'Submit phase'
            }
        },
            {
                x: this.priceEpochSettings.getEndTimeForEpochId(this.selectedPriceEpochId),
                strokeDashArray: 2,
                borderColor: colors[0],
                label: {
                    borderColor: colors[0],
                    style: {
                        color: '#fff',
                        background: colorsLight[0]
                    },
                    text: 'Reveal phase'
                }
            }
            ,
            {
                x: this.priceEpochSettings.getRevealEndTimeForEpochId(this.selectedPriceEpochId),
                strokeDashArray: 2,
                borderColor: colors[0],
                label: {
                    borderColor: colors[0],
                    style: {
                        color: '#fff',
                        background: colorsLight[0]
                    },
                    text: 'Price finalization'
                }
            },
            {
                x: this.priceEpochSettings.getStartTimeForEpochId(this.selectedPriceEpochId),
                strokeDashArray: 2,
                borderColor: colors[4],
            });

        this.chartOptions.annotations = {
            xaxis: xAxisAnnotations
        }

        this.chartOptions.yaxis = {
            show: false
        }
        let submittedHashesSerie: any = { id: 'submittedHashesSerie', type: 'scatter', name: "Submitted hashes", data: [] };
        if (this.submittedHashes && this.submittedHashes.length > 0) {
            this.submittedHashes.map((submittedHash, idx) => {
                submittedHashesSerie.data.push({ x: submittedHash.timestamp, y: 1, name: dataProvidersInfo[submittedHash.submitter].name });
            })
        }
        let revealedSerie: any = { id: 'revealedSerie', type: 'scatter', name: "Revealed prices", data: [] };
        let revealedValues: number[] = [];
        if (this.revealedPrices && this.revealedPrices.length > 0) {
            this.revealedPrices.filter(revealedPrice => revealedPrice.symbol == 'BTC').map((revealedPrice, idx) => {
                revealedSerie.data.push({ x: revealedPrice.timestamp, y: revealedPrice.value, name: dataProvidersInfo[revealedPrice.dataProvider].name });
                revealedValues.push(revealedPrice.value);
            })
        }

        let yAxisAnnotations: any[] = [];


        if (this.finalizedPrices && this.finalizedPrices.length > 0) {
            this.finalizedPrices.filter(finalizedPrice => finalizedPrice.symbol == 'BTC').map((finalizedPrice, idx) => {
                timer(3000).subscribe(() => {


                    (this.chartOptions.yaxis as any).min = finalizedPrice.lowPctRewardPrice + ((finalizedPrice.lowPctRewardPrice / 100) * 0.05);
                    (this.chartOptions.yaxis as any).max = finalizedPrice.highPctRewardPrice + ((finalizedPrice.highPctRewardPrice / 100) * 0.05);
                    yAxisAnnotations = [
                        {
                            y: finalizedPrice.highPctRewardPrice,
                            strokeDashArray: 2,
                            borderColor: colors[3]
                        }, {
                            y: finalizedPrice.highIQRRewardPrice,
                            strokeDashArray: 2,
                            borderColor: colors[3],
                        }, {
                            y: finalizedPrice.value,
                            strokeDashArray: 2,
                            borderColor: colors[3],
                        }, {
                            y: finalizedPrice.lowIQRRewardPrice,
                            strokeDashArray: 2,
                            borderColor: colors[3],
                        }, {
                            y: finalizedPrice.lowIQRRewardPrice,
                            strokeDashArray: 2,
                            borderColor: colors[3]
                        }
                    ]
                    this.chartOptions.annotations = {
                        yaxis: yAxisAnnotations
                    }
                    this.chart.updateOptions(this.chartOptions);
                });

            });
        }


        this.chartOptions.series = [submittedHashesSerie];
        this._cdr.detectChanges();
        /*   interval(1000).subscribe(() => {
              this.chartOptions.annotations.xaxis[3].x = (this.chartOptions.annotations.xaxis[3] as any).x + 1000;
              this.chart.updateOptions(this.chartOptions);
              this._cdr.detectChanges();
          }); */
        timer(2000).subscribe(() => {
            let revealedMin: number = Math.min(...revealedValues);
            let revealedMax: number = Math.max(...revealedValues);
            (this.chartOptions.yaxis as any).min = revealedMin;
            (this.chartOptions.yaxis as any).max = revealedMax;
            (submittedHashesSerie as any).data.map(hash => hash.y = ((revealedMin + revealedMax) / 2));
            this.chartOptions.series = [submittedHashesSerie, revealedSerie];
            this.chart.updateOptions(this.chartOptions);
            this._cdr.detectChanges();
        })
    }
    private _initializeChart(): void {
        this.chartOptions = {
            series: [
                {
                    name: "TEAM 1",
                    data: [[1486771200000, 47], [1486857600000, 13], [1486944000000, 49], [1487030400000, 53], [1487116800000, 56], [1487203200000, 22], [1487289600000, 53], [1487376000000, 59], [1487462400000, 33], [1487548800000, 43], [1487635200000, 18], [1487721600000, 25], [1487808000000, 45], [1487894400000, 13], [1487980800000, 45], [1488067200000, 47], [1488153600000, 41], [1488240000000, 19], [1488326400000, 31], [1488412800000, 45]]
                }
            ],
            chart: {
                animations: {
                    enabled: false
                },
                height: 350,
                type: "scatter",
                toolbar: {
                    show: false
                },
                zoom: {
                    type: "xy"
                }
            },
            dataLabels: {
                enabled: false
            },
            grid: {
                xaxis: {
                    lines: {
                        show: true
                    }
                },
                yaxis: {
                    lines: {
                        show: true
                    },
                }
            },
            xaxis: {
                type: "datetime"
            },
            yaxis: {
            }
        };
    }

    getDataProviderInfo(address: string): DataProviderInfo {
        let dpInfo: DataProviderInfo = this.dataProviderInfo.find(dpInfo => dpInfo.address == address.toLowerCase());
        if (isNotEmpty(dpInfo)) {
            return dpInfo;
        } else {
            dpInfo = new DataProviderInfo();
            dpInfo.address = address.toLowerCase();
            return dpInfo;
        }
    }

    asHashSubmitted(data: IRealTimeData): HashSubmittedRealTimeData {
        return data as HashSubmittedRealTimeData;
    }
    asPriceRevealed(data: IRealTimeData): PriceRevealedRealTimeData {
        return data as PriceRevealedRealTimeData;
    }
    asPriceFinalized(data: IRealTimeData): PriceFinalizedRealTimeData {
        return data as PriceFinalizedRealTimeData;
    }


}