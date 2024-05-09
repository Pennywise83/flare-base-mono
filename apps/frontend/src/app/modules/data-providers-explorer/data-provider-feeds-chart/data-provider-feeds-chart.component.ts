import { DatePipe, DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Renderer2, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { isNotEmpty } from "class-validator";
import { ApexOptions, ChartComponent, NgApexchartsModule } from "ng-apexcharts";
import { timer } from "rxjs";
import { Commons, DataProviderInfo, NetworkEnum, PriceEpochSettings, PriceFinalized, PriceRevealed, RewardDistributed } from "../../../../../../../libs/commons/src";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { DataProviderSubmissionStats } from "../../../../../../../libs/commons/src/model/ftso/data-provider-submission-stats";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { Utils } from "app/commons/utils";

@Component({
    selector: 'flare-base-data-provider-feeds-chart',
    templateUrl: './data-provider-feeds-chart.component.html',
    styles: [`flare-base-data-provider-feeds-chart-chart {
        display: contents;
    }`],
    imports: [AppModule, LoaderComponent, NoDataComponent, NgApexchartsModule, DecimalPipe, DatePipe, MatButtonModule, MatIconModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DecimalPipe, DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProviderFeedsChartComponent implements OnInit, OnDestroy, OnChanges {
    private _network: NetworkEnum;
    @Input() loading: boolean;
    @ViewChild("dpFeedsChart") chart: ChartComponent;
    @Input() pricesData: { finalizedPrices: PriceFinalized[], revealedPrices: PriceRevealed[], submissionStats: DataProviderSubmissionStats[], distributedRewards: RewardDistributed[] } = { finalizedPrices: [], revealedPrices: [], submissionStats: [], distributedRewards: [] };
    @Input() dataProvidersInfoMap: Record<string, DataProviderInfo>;
    @Input() availableSymbols: string[];
    chartOptions: ApexOptions = {};
    @Input() priceEpochSettings: PriceEpochSettings;
    isFullScreen: boolean = false;
    isZoomed: boolean = false;
    @Input() isRelativeView: boolean = false;

    constructor(
        private renderer: Renderer2,
        private _cdr: ChangeDetectorRef,
        private _uiNotificationsService: UiNotificationsService,
        private _datePipe: DatePipe,
        private _decimalPipe: DecimalPipe) {

    }
    fullScreen() {
        this.isFullScreen = !this.isFullScreen;
        const action = this.isFullScreen ? 'addClass' : 'removeClass';
        let zoomableElement: ElementRef = (this.chart as any).chartElement.nativeElement.closest('.zoomable');
        this.renderer[action](zoomableElement, 'fixed');
        this.renderer[action](zoomableElement, 'max-h-screen');
        this.renderer[action](zoomableElement, 'inset-5');
        this.renderer[action](zoomableElement, 'z-50');
        this.renderer[action](zoomableElement, 'shadow-xl');
        this.parseChartData();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.pricesData && JSON.stringify(changes.pricesData.currentValue) != JSON.stringify(changes.pricesData.previousValue)) {
            this.pricesData = changes.pricesData.currentValue;
        }
        if (changes.loading && changes.loading.currentValue == false) {
            this.parseChartData();
        }
        if (changes.isRelativeView && changes.isRelativeView.currentValue != changes.isRelativeView.previousValue) {
            this.parseChartData();
        }
    }

    resetZoom() {
        this.isZoomed = false;
        if (this.chart) {
            this.chart.resetSeries();
        }
        this._cdr.detectChanges();
    }


    parseChartData() {
        try {
            if (this.pricesData.revealedPrices && this.pricesData.revealedPrices.length > 0 && this.pricesData.finalizedPrices && this.pricesData.finalizedPrices.length > 0) {
                const revealedEpochIds: number[] = [... new Set(this.pricesData.revealedPrices.map(revealedPrice => revealedPrice.epochId))];
                let epochIdsTimestampMap: Record<number, number> = {};
                revealedEpochIds.map(epochId => !epochIdsTimestampMap[epochId] ? epochIdsTimestampMap[epochId] = this.priceEpochSettings.getEndTimeForEpochId(epochId) : false);
                let addresses: string[] = Array.from(new Set(this.pricesData.revealedPrices.map(rp => rp.dataProvider)));
                let dataProvidersInfo: Record<string, DataProviderInfo> = {};
                addresses.map(address => {
                    if (!dataProvidersInfo[address]) {
                        dataProvidersInfo[address] = this.dataProvidersInfoMap[address];
                    }
                });
                let colors: string[] = Utils.getColors();
                let colorsRgb: string[] = [];
                colors.map(colorHex => {
                    colorsRgb.push(Utils.hexToRgb(colorHex));
                })
                let chartSeries: any[] = [];
                let chartColors: Array<string> = [];
                let chartStrokeSizes: Array<number> = [];
                let chartMarkerSizes: Array<number> = [];
                let chartYAxis: any[] = [];
                let xAxisAnnotations: any[] = [];
                let pointsAnnotations: any[] = [];
                let revealedSeries: Record<string, any> = {};
                let discreteMarkers: any[] = [];

                addresses.map(address => {
                    if (!revealedSeries[address]) {
                        revealedSeries[address] = { id: 'revealedSerie', type: 'line', name: dataProvidersInfo[address] ? dataProvidersInfo[address].name : 'Unknown', data: [], originalData: [] };
                    }
                });
                let ftsoRangeSerie: any = { id: 'ftsoRangeSerie', type: 'rangeArea', name: "Reward band IQR", data: [], originalData: [] };
                let ftsoElasticRangeSerie: any = { id: 'ftsoElasticRangeSerie', type: 'rangeArea', name: "Reward band Pct", data: [], originalData: [] };
                let ftsoSerie: any = { id: 'ftsoSerie', type: 'line', name: "Ftso price", data: [], originalData: [] };
                let rewardedFtsoLines: any[] = [];
                let winningRevealedPoints: any[] = [];
                let rewardedRevealedPoints: any[] = [];
                if (this.pricesData.finalizedPrices && this.pricesData.finalizedPrices.length > 0) {
                    this.pricesData.finalizedPrices.map(ftsoPrice => {
                        if (this.isRelativeView) {
                            ftsoRangeSerie.isRelative = true;
                            ftsoRangeSerie.data.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [((ftsoPrice.lowIQRRewardPrice * 100) / ftsoPrice.value).toFixed(5), ((ftsoPrice.highIQRRewardPrice * 100) / ftsoPrice.value).toFixed(5)], epochId: ftsoPrice.epochId })
                            ftsoRangeSerie.originalData.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [ftsoPrice.lowIQRRewardPrice, ftsoPrice.highIQRRewardPrice], epochId: ftsoPrice.epochId })

                            if (ftsoPrice.highPctRewardPrice > 0 && ftsoPrice.lowPctRewardPrice > 0) {
                                ftsoElasticRangeSerie.isRelative = true;
                                ftsoElasticRangeSerie.data.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [((ftsoPrice.lowPctRewardPrice * 100) / ftsoPrice.value).toFixed(5), ((ftsoPrice.highPctRewardPrice * 100) / ftsoPrice.value).toFixed(5)], epochId: ftsoPrice.epochId })
                                ftsoElasticRangeSerie.originalData.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [ftsoPrice.lowPctRewardPrice, ftsoPrice.highPctRewardPrice], epochId: ftsoPrice.epochId })

                            }
                            ftsoSerie.isRelative = true;
                            ftsoSerie.data.push({ x: epochIdsTimestampMap[ftsoPrice.epochId], y: 100 });
                            ftsoSerie.originalData.push({ x: epochIdsTimestampMap[ftsoPrice.epochId], y: ftsoPrice.value });
                        } else {
                            ftsoRangeSerie.data.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [ftsoPrice.lowIQRRewardPrice, ftsoPrice.highIQRRewardPrice], epochId: ftsoPrice.epochId })
                            if (ftsoPrice.highPctRewardPrice > 0 && ftsoPrice.lowPctRewardPrice > 0) {
                                ftsoElasticRangeSerie.data.push({ zIndex: 1, x: epochIdsTimestampMap[ftsoPrice.epochId], y: [ftsoPrice.lowPctRewardPrice, ftsoPrice.highPctRewardPrice], epochId: ftsoPrice.epochId })
                            }
                            ftsoSerie.data.push({ x: epochIdsTimestampMap[ftsoPrice.epochId], y: ftsoPrice.value });
                        }
                        if (ftsoPrice.rewardedSymbol) {
                            rewardedFtsoLines.push({ x: epochIdsTimestampMap[ftsoPrice.epochId], label: `Rewarded` });
                        }
                    });
                }

                if (this.pricesData.revealedPrices && this.pricesData.revealedPrices.length > 0) {
                    this.pricesData.revealedPrices.map((revealedPrice) => {
                        if (this.isRelativeView) {

                            revealedSeries[revealedPrice.dataProvider].isRelative = true;
                            revealedSeries[revealedPrice.dataProvider].data.push({ zIndex: 50, x: epochIdsTimestampMap[revealedPrice.epochId], y: ((revealedPrice.value * 100) / this.pricesData.finalizedPrices.find(finalizedPrice => finalizedPrice.epochId == revealedPrice.epochId).value).toFixed(5) });
                            revealedSeries[revealedPrice.dataProvider].originalData.push({ zIndex: 50, x: epochIdsTimestampMap[revealedPrice.epochId], y: revealedPrice.value });

                        } else {
                            revealedSeries[revealedPrice.dataProvider].data.push({ zIndex: 50, x: epochIdsTimestampMap[revealedPrice.epochId], y: revealedPrice.value });

                        }
                        let reward: RewardDistributed = this.pricesData.distributedRewards.find(reward => reward.priceEpochId == revealedPrice.epochId && reward.symbol == revealedPrice.symbol);
                        if (reward && revealedPrice.isWinning) {
                            rewardedRevealedPoints.push({ dataProviderName: dataProvidersInfo[revealedPrice.dataProvider].name, dataProvider: revealedPrice.dataProvider, x: epochIdsTimestampMap[revealedPrice.epochId], y: revealedPrice.value, label: 'Reward received' })
                        }
                        if (revealedPrice.isWinning && !reward) {
                            winningRevealedPoints.push({ dataProviderName: dataProvidersInfo[revealedPrice.dataProvider].name, dataProvider: revealedPrice.dataProvider, x: epochIdsTimestampMap[revealedPrice.epochId], y: revealedPrice.value, label: 'Winner' })
                        }
                    });
                }
                let allValues: number[] = [];
                for (let address in revealedSeries) {
                    allValues.push(...revealedSeries[address].data.map(d => d.y));
                }
                allValues.push(...ftsoSerie.data.map(d => d.y), ...ftsoRangeSerie.data.map(d => d.y[0]), ...ftsoRangeSerie.data.map(d => d.y[1]));

                let allMin: number = Math.min(...allValues) - (Math.min(...allValues) / 100) * (this.isRelativeView ? 0.001 : 0.05);
                let allMax: number = Math.max(...allValues) + (Math.max(...allValues) / 100) * (this.isRelativeView ? 0.001 : 0.1);
                let counter: number = 0;
                for (let address in revealedSeries) {
                    if (revealedSeries[address].data.length > 0) {
                        chartSeries.push(revealedSeries[address]);
                        chartColors.push(colors[counter]);

                        chartStrokeSizes.push(2);
                        chartMarkerSizes.push(0);
                        if (counter == 0) {
                            chartYAxis.push({
                                min: allMin,
                                max: allMax,
                                tickAmount: 5,
                                labels: {
                                    offsetY: 0,
                                    style: {
                                        fontFamily: 'inherit',
                                        colors: 'rgba(var(--ui-text-secondary-rgb), 0.6)',
                                    }
                                },
                                axisTicks: {
                                    show: false
                                },
                                axisBorder: {
                                    show: false
                                },
                                show: true,
                                tooltip: {
                                    enabled: false
                                },
                            });
                        }
                        counter++;
                    }
                }

                if (ftsoRangeSerie.data.length > 0) {
                    chartSeries.push(ftsoRangeSerie);
                    chartColors.push('rgba(var(--ui-text-secondary-rgb),0.2)');
                    chartStrokeSizes.push(1);
                    chartMarkerSizes.push(0);
                    chartYAxis.push({
                        min: allMin,
                        max: allMax,
                        show: false
                    });
                }
                if (ftsoElasticRangeSerie.data.length > 0) {
                    chartSeries.push(ftsoElasticRangeSerie);
                    chartColors.push('rgba(var(--ui-text-secondary-rgb),0.1)');
                    chartStrokeSizes.push(1);
                    chartMarkerSizes.push(0);
                    chartYAxis.push({
                        min: allMin,
                        max: allMax,
                        show: false
                    });
                }
                if (ftsoSerie.data.length > 0) {
                    chartSeries.push(ftsoSerie);
                    chartColors.push('rgba(var(--ui-text-secondary-rgb),0.5)');
                    chartStrokeSizes.push(1);
                    chartMarkerSizes.push(0);
                    chartYAxis.push({
                        min: allMin,
                        max: allMax,
                        show: false
                    });
                }
                if (rewardedFtsoLines.length > 0) {
                    rewardedFtsoLines.filter(rs => rs != null).map(rs => {
                        xAxisAnnotations.push({
                            x: rs.x,
                            strokeDashArray: 4,
                            borderColor: "#9f7efe"
                        });
                    });
                }
                let timestamps: Array<number> = [];
                chartSeries.map(serie => {
                    serie.data.map(singleData => {
                        timestamps.push(singleData.x);
                    })
                })
                timestamps = [... new Set(timestamps)].sort();

                timestamps.map(timestamp => {
                    chartSeries.filter(serie => serie.id == 'revealedSerie').map(serie => {
                        if (serie.data.filter(d => d.x == timestamp).length == 0) {
                            let dataCopy: any = Commons.clone(serie.data[0]);
                            dataCopy.x = timestamp;
                            if (dataCopy.y != null && dataCopy.y.length > 1) {
                                dataCopy.y = [null, null]
                            } else {
                                dataCopy.y = null;
                            }
                            serie.data.push(dataCopy);
                        }
                        if (serie.data.filter(d => d.x == timestamp).length > 1) {
                            serie.data.filter(d => d.x == timestamp).map((d, dIdx) => {
                                if (dIdx != 0) {
                                    serie.data.splice(serie.data.indexOf(d), 1)
                                }
                            });
                        }
                    });
                });
                chartSeries.filter(serie => serie.id == 'revealedSerie').map(serie => {
                    serie.data = serie.data.sort((a, b) => a.x - b.x);
                });

                if (rewardedRevealedPoints.length > 0) {
                    rewardedRevealedPoints.filter(rs => rs != null).map(rs => {
                        const serie = chartSeries.find(serie => serie.id == 'revealedSerie' && serie.name == rs.dataProviderName);
                        const serieIdx = chartSeries.indexOf(chartSeries.find(serie => serie.id == 'revealedSerie' && serie.name == rs.dataProviderName));
                        const dataPointIdx = serie.data.indexOf(serie.data.find(dataPoint => dataPoint.x == rs.x));
                        if (serieIdx >= 0 && dataPointIdx >= 0) {
                            discreteMarkers.push({
                                seriesIndex: serieIdx,
                                dataPointIndex: dataPointIdx,
                                fillColor: Utils.getColors(1)[serieIdx],
                                strokeColor: 'var(--ui-bg-card)',
                                size: 7,
                                shape: "square"
                            })
                        }
                    });
                }
                if (winningRevealedPoints.length > 0) {
                    winningRevealedPoints.filter(ws => ws != null).map(ws => {
                        const serie = chartSeries.find(serie => serie.id == 'revealedSerie' && serie.name == ws.dataProviderName);
                        const serieIdx = chartSeries.indexOf(chartSeries.find(serie => serie.id == 'revealedSerie' && serie.name == ws.dataProviderName));
                        const dataPointIdx = serie.data.indexOf(serie.data.find(dataPoint => dataPoint.x == ws.x));
                        if (serieIdx >= 0 && dataPointIdx >= 0) {
                            discreteMarkers.push({
                                seriesIndex: serieIdx,
                                dataPointIndex: dataPointIdx,
                                fillColor: Utils.getColors(0.8)[serieIdx],
                                strokeColor: 'var(--ui-bg-card)',
                                size: 4,
                                shape: "circle"
                            })
                        }
                    });
                }

                chartSeries.filter(serie => serie.id == 'winningSerie').map(serie => {
                    serie.data.filter(d => d.y == null).map(d => { d.y = 0 });
                });
                chartSeries.map(serie => {
                    serie.data = serie.data.sort((a, b) => a.x - b.x);
                });

                this.chartOptions.series = chartSeries;

                this.chartOptions.stroke = {
                    curve: 'straight',
                    width: chartStrokeSizes
                };
                this.chartOptions.markers = {
                    size: chartMarkerSizes,
                    hover: {
                        sizeOffset: 5
                    }
                };
                if (addresses.length > 1) {
                    (this.chartOptions.legend.markers.width as any) = [];
                    this.chartOptions.legend.show = true;
                    for (let i = 1; i <= chartSeries.length; i++) {
                        if (i <= addresses.length) {
                            (this.chartOptions.legend.markers.width as any).push(10);
                        } else {
                            (this.chartOptions.legend.markers.width as any).push(0);
                        }
                    }

                } else {
                    this.chartOptions.legend.show = false;
                }
                if (discreteMarkers.length > 0) {
                    this.chartOptions.markers.discrete = discreteMarkers;
                }
                this.chartOptions.colors = chartColors;
                this.chartOptions.yaxis = chartYAxis;
                this.chartOptions.annotations = {
                    xaxis: xAxisAnnotations,
                    points: pointsAnnotations
                };
                this._cdr.detectChanges();
                timer(50).subscribe(() => {
                    if (this.chart) {
                        let zoomableElement: ElementRef = (this.chart as any).chartElement.nativeElement.closest('.zoomable');
                        this.chartOptions.chart.height = zoomableElement ? ((zoomableElement as any).offsetHeight - 4) + 'px' : '100%';
                        this.chart.updateOptions(this.chartOptions);
                        this._cdr.detectChanges();
                    }
                });
            }
        } catch (err) {
            this._uiNotificationsService.error(`Unable to draw ftso prices chart`, err.message);
            this._initializeChart();
        }
    }


    public onRangeSelection(): void {
        this.isZoomed = true;
        this._cdr.detectChanges();
    }
    _initializeChart(): void {
        let chartSeries: any[] = [];
        let chartColors: Array<string> = [];
        let chartStrokeSizes: Array<number> = [];
        let chartMarkerSizes: Array<number> = [];
        let chartYAxis: any[] = [
            {
                show: false,
            },
            {
                show: false,
            },
            {
                show: false,
            },
            {
                show: false,
            }
        ];
        this.chartOptions = {
            series: chartSeries,
            theme: {
                mode: 'dark'
            },
            chart: {
                type: "rangeArea",
                height: 'auto',
                events: {
                    beforeZoom: (ctx, opt) => {
                        let values: Array<number> = [];
                        let originalYAxis: any = ctx.w.config.yaxis;
                        let newMin: number = 0;
                        let newMax: number = 0;
                        if (ctx.w && ctx.w.config && ctx.w.config.series && ctx.w.config.series.length > 0) {
                            ctx.w.config.series.map(serie => {
                                serie.data.map(data => {
                                    if (data.y != null && data.y.length > 2) {
                                        if (data.x >= opt.xaxis.min && data.x <= opt.xaxis.max) {
                                            values.push(data.y);
                                        }

                                    } else if (data.y != null && data.y.length == 2) {
                                        if (data.x >= opt.xaxis.min && data.x <= opt.xaxis.max && data.y[0] != null && data.y[1] != null) {
                                            values.push(data.y[0], data.y[1]);
                                        }
                                    }
                                })
                            })
                        }
                        newMin = Math.min(...values);
                        newMax = Math.max(...values);

                        originalYAxis.map(yAxis => {
                            yAxis.min = newMin - (newMin / 100) * (this.isRelativeView ? 0.001 : 0.05);
                            yAxis.max = newMax + (newMax / 100) * (this.isRelativeView ? 0.001 : 0.1);
                        })
                        timer(25).subscribe(() => this.onRangeSelection())
                        return { yaxis: originalYAxis }
                    }
                },
                zoom: {
                    enabled: true,
                    type: 'x',
                    autoScaleYaxis: false
                },

                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 300,
                    animateGradually: {
                        enabled: false
                    },
                    dynamicAnimation: {
                        enabled: true,
                        speed: 300
                    }
                },
                toolbar: {
                    show: false
                },
            },
            grid: {
                show: true,
                borderColor: 'rgba(var(--ui-text-secondary-rgb), 0.15)',

                padding: {
                    top: 0,
                    bottom: 0,
                    left: 20,
                    right: 20
                },
                position: 'back',
                xaxis: {
                    lines: {
                        show: false
                    }
                },
                yaxis: {
                    lines: {
                        show: true
                    }
                }
            },
            tooltip: {
                enabled: true,
                shared: true,
                followCursor: false,
                theme: 'dark',
                style: {
                    fontFamily: 'inherit'
                },
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    let result: string = '';
                    try {
                        let revealedSeries: any[] = [];

                        let ftsoRangePrice = null;
                        let ftsoRangePriceLabel = null;

                        let ftsoElasticRangePrice = null;
                        let ftsoElasticRangePriceLabel = null;

                        let ftsoPrice = null;
                        let ftsoPriceLabel = null;
                        let ftsoPriceTimestamp = null;

                        if (w.globals.initialSeries && w.globals.initialSeries.length > 0) {
                            w.globals.initialSeries.map((serie, serieIdx) => {
                                if (serie.id == 'revealedSerie') {
                                    if (!revealedSeries[serie.name]) { revealedSeries[serie.name] = {} }
                                    if (serie.isRelative) {
                                        revealedSeries[serie.name].revealedPrice = serie.originalData[dataPointIndex];
                                    } else {
                                        revealedSeries[serie.name].revealedPrice = serie.data[dataPointIndex];
                                    }
                                    revealedSeries[serie.name].revealedPriceColor = w.config.colors[serieIdx];
                                    revealedSeries[serie.name].revealedPriceLabel = serie.name;
                                } else if (serie.name == 'Reward band IQR') {
                                    if (serie.isRelative) {
                                        ftsoRangePrice = serie.originalData[dataPointIndex];
                                    } else {
                                        ftsoRangePrice = serie.data[dataPointIndex];
                                    }
                                    ftsoRangePriceLabel = serie.name;

                                } else if (serie.name == 'Reward band Pct') {
                                    if (serie.isRelative) {
                                        ftsoElasticRangePrice = serie.originalData[dataPointIndex];
                                    } else {
                                        ftsoElasticRangePrice = serie.data[dataPointIndex];
                                    }
                                    ftsoElasticRangePriceLabel = serie.name;

                                } else if (serie.name.indexOf('Ftso price') >= 0) {
                                    if (serie.isRelative) {
                                        ftsoPrice = serie.originalData[dataPointIndex];
                                    } else {
                                        ftsoPrice = serie.data[dataPointIndex];
                                    }
                                    ftsoPriceTimestamp = serie.data[dataPointIndex].x;
                                    ftsoPriceLabel = serie.name;
                                }
                            });
                        }
                        result = '<div class="p-2">';

                        result += `<div class="flex justify-between  text-md  mb-0 p-0">
                <strong class="mr-2">Epoch ID</strong><span>${ftsoRangePrice.epochId}</span>
                  </div>`;
                        result += `<div class="flex justify-between text-md  mb-0 p-0 pb-2">
                  <strong class="mr-2">Date</strong><span>${this._datePipe.transform(ftsoPriceTimestamp, 'YYYY-MM-dd HH:mm:ss')}</span>
                    </div>`;
                        if (ftsoRangePrice && ftsoRangePrice.y && ftsoRangePrice.y.length > 0 && ftsoPrice && ftsoPrice.y.toFixed(5)) {
                            if (ftsoElasticRangePrice && ftsoElasticRangePrice.y && ftsoElasticRangePrice.y.length > 0) {
                                result += `
                  <div class="border-t border-gray-400 flex justify-between  text-md  mb-0 p-0 pt-2">
                  <strong class="mr-2">${ftsoElasticRangePriceLabel} High</strong><span>${ftsoElasticRangePrice.y[1].toFixed(5)}</span>
                  </div>
                  `;
                            }
                            result += `
                  <div class="flex justify-between  text-md  mb-0 p-0">
                  <strong class="mr-2">${ftsoRangePriceLabel} High</strong><span>${ftsoRangePrice.y[1].toFixed(5)}</span>
                  </div>
                <div class="flex justify-between  text-md  mb-0 p-0">
                  <strong class="mr-2">${ftsoPriceLabel}:</strong><span>${ftsoPrice.y}</span>
                </div>
                <div class="flex justify-between  text-md mb-0 p-0">
                  <strong class="mr-2">${ftsoRangePriceLabel} Low</strong><span>${ftsoRangePrice.y[0].toFixed(5)}</span>
                </div>`;
                            if (ftsoElasticRangePrice && ftsoElasticRangePrice.y && ftsoElasticRangePrice.y.length > 0) {
                                result += `
                <div class="flex justify-between  text-md  mb-0 p-0">
                <strong  class="mr-2">${ftsoElasticRangePriceLabel} Low</strong><span>${ftsoElasticRangePrice.y[0].toFixed(5)}</span>
                </div>
                `;
                            }
                        } else {
                            if (ftsoElasticRangePrice && ftsoElasticRangePrice.y && ftsoElasticRangePrice.y.length > 0) {
                                result += `
                  <div class="flex justify-between  text-md  mb-0 p-0">
                  <strong  class="mr-2">${ftsoElasticRangePriceLabel} High</strong><span>${ftsoElasticRangePrice.y[1].toFixed(5)}</span>
                  </div>
                  `;
                            }
                            result += `
                <div class="flex justify-between  text-md  mb-0 p-0">
                  <strong class="mr-2">${ftsoPriceLabel}</strong><span>-</span>
                </div>
                <div class="flex justify-between  text-md  mb-0 p-0">
                  <strong  class="mr-2">${ftsoRangePriceLabel} High</strong><span>-</span>
                </div>
                <div class="flex justify-between  text-md mb-0 p-0">
                  <strong  class="mr-2">${ftsoRangePriceLabel} Low</strong><span>-</span>
                </div>`;
                            if (ftsoElasticRangePrice && ftsoElasticRangePrice.y && ftsoElasticRangePrice.y.length > 0) {
                                result += `
                <div class="flex justify-between  text-md  mb-0 p-0 pb-2">
                <strong  class="mr-2">${ftsoElasticRangePriceLabel} High</strong><span>${ftsoElasticRangePrice.y[1].toFixed(5)}</span>
                </div>
                `;
                            }
                        }
                        if (revealedSeries && Object.keys(revealedSeries).length > 0) {
                            Object.keys(revealedSeries).map((serieName, idx) => {
                                const revealedSerie = revealedSeries[serieName];
                                if (revealedSerie && revealedSerie.revealedPrice.y) {
                                    result += `<div class="flex justify-between  text-md  mb-0 p-0   border-gray-400 ${idx == 0 ? 'border-t pt-2' : ''}">
                        <strong style="color: ${revealedSerie.revealedPriceColor}" class="mr-2">${revealedSerie.revealedPriceLabel}</strong><span>${revealedSerie.revealedPrice.y.toFixed(5)}</span>
                    </div>`;
                                } else {
                                    result += `<div class="flex justify-between  text-md  mb-0 p-0">
                        <strong style="color: ${revealedSerie.revealedPriceColor}" class="mr-2">${revealedSerie.revealedPriceLabel}</strong><span>-</span>
                    </div>`;
                                }
                            });
                        }

                        result += `</div>`;
                    } catch (tooltipError) {
                        console.error("Tooltip error: " + tooltipError);
                    }
                    return result;
                }
            },
            colors: [chartColors],
            dataLabels: {
                enabled: false
            },
            fill: {
                type: 'solid'
            },
            stroke: {
                curve: "straight",
                width: chartStrokeSizes

            },
            legend: {
                show: false,
                labels: {
                    useSeriesColors: true
                },
                floating: true,
                fontFamily: 'inherit',
                formatter: (seriesName, opts) => {
                    if (seriesName == 'Ftso price' || seriesName == 'Reward band IQR' || seriesName == 'Reward band Pct') {
                        return null;
                    } else {
                        return seriesName;
                    }
                },
                itemMargin: {
                    vertical: 5
                },
                markers: {
                    width: 10,
                    height: 10,
                    strokeWidth: 0,
                    radius: 2,
                },
                position: 'top'

            },
            xaxis: {
                tooltip: {
                    enabled: false
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                },

                labels: {
                    offsetY: 0,
                    style: {
                        fontFamily: 'inherit',
                        colors: 'rgba(var(--ui-text-secondary-rgb), 0.6)',
                    },
                    datetimeUTC: false,
                },
                type: 'datetime'
            },
            yaxis: {},
            markers: {
                size: chartMarkerSizes,
                discrete: [],
                hover: {
                    size: 10,
                    sizeOffset: 0
                }
            },
            annotations: {
                xaxis: [],
                points: []
            }
        }
        this._cdr.detectChanges();
    }
    ngOnInit(): void {
        this._initializeChart();
    }
    ngOnDestroy(): void {
    }

}