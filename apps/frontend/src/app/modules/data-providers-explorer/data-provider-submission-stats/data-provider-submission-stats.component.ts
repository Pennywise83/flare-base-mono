import { DatePipe, DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, Renderer2, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { isNotEmpty } from "class-validator";
import { ApexOptions, ChartComponent, NgApexchartsModule } from "ng-apexcharts";
import { timer } from "rxjs";
import { DataProviderInfo, NetworkEnum, PriceFinalized, PriceRevealed, RewardDistributed } from "../../../../../../../libs/commons/src";
import { DataProviderSubmissionStats } from "../../../../../../../libs/commons/src/model/ftso/data-provider-submission-stats";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { Utils } from "app/commons/utils";

@Component({
    selector: 'flare-base-data-provider-submission-stats',
    templateUrl: './data-provider-submission-stats.component.html',
    styles: [`flare-base-data-provider-submission-stats {
        display: contents;
    }`],
    imports: [AppModule, LoaderComponent, NoDataComponent, NgApexchartsModule, DecimalPipe, DatePipe, MatButtonModule, MatIconModule, AddressTrimPipe],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DecimalPipe, DatePipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProviderSubmissionStatsComponent implements OnInit, OnDestroy, OnChanges {
    @Input() loading: boolean;
    @ViewChild("dpStatsChart") chart: ChartComponent;
    @Input() pricesData: { finalizedPrices: PriceFinalized[], revealedPrices: PriceRevealed[], submissionStats: DataProviderSubmissionStats[], distributedRewards: RewardDistributed[] } = { finalizedPrices: [], revealedPrices: [], submissionStats: [], distributedRewards: [] };
    @Input() availableSymbols: string[];
    @Input() type: SubmissionStatsChartType
    @Input() dataProvidersInfoMap: Record<string, DataProviderInfo>;
    @Input() network: NetworkEnum;
    chartOptions: ApexOptions = {};
    isFullScreen: boolean = false;
    submissionStatsTypes = SubmissionStatsChartType;
    isCompareMode: boolean = false;
    successRateCompareMode: 'global' | 'iqr' | 'pct' = 'global';
    rewardsCompareMode: 'rate' | 'delegators' | 'provider' = 'rate';
    statsByDataProvider: Record<string, Record<string, any>> = {};
    symbol: string;
    constructor(
        private renderer: Renderer2,
        private _decimalPipe: DecimalPipe,
        private _addressTrimPipe: AddressTrimPipe,
        private _uiNotificationsService: UiNotificationsService,
    ) {

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
        this.parseChartData(this.type);
    }
    ngOnChanges(changes: SimpleChanges): void {
        if (changes.pricesData && JSON.stringify(changes.pricesData.currentValue) != JSON.stringify(changes.pricesData.previousValue)) {
            this.pricesData = changes.pricesData.currentValue;
        }
        if (changes.loading && changes.loading.currentValue == false) {
            this.parseChartData(this.type);
        }
    }
    parseChartData(type: SubmissionStatsChartType) {
        try {
            this.statsByDataProvider = {};
            if (this.network && this.pricesData && this.pricesData.submissionStats && this.pricesData.submissionStats.length > 0) {
                this.symbol = Utils.getChainDefinition(this.network).nativeCurrency.symbol;

                let chartSeries: any = [];
                let chartColors: string[] = [];
                let chartLabels: string[] = [];
                let dataProviders: string[] = Array.from(new Set(this.pricesData.submissionStats.map(stat => stat.dataProvider)));
                this.isCompareMode = dataProviders.length > 1 ? true : false;
                switch (type) {
                    case SubmissionStatsChartType.bar:
                        if (dataProviders.length > 0) {
                            let colors: string[] = Utils.getColors(0.65);
                            dataProviders.map((dataProviderAddress, dataProviderIdx) => {
                                if (!this.statsByDataProvider[dataProviderAddress]) {
                                    this.statsByDataProvider[dataProviderAddress] = {};
                                    this.statsByDataProvider[dataProviderAddress]['delegatorRewards'] = 0;
                                    this.statsByDataProvider[dataProviderAddress]['providerRewards'] = 0;
                                    this.statsByDataProvider[dataProviderAddress]['rewardsCount'] = 0;
                                    this.statsByDataProvider[dataProviderAddress]['totalCases'] = 0;
                                    this.statsByDataProvider[dataProviderAddress]['rewardRate'] = 0;
                                    this.pricesData.submissionStats.filter(stats => stats.symbol == null && stats.dataProvider == dataProviderAddress).map(stats => {
                                        this.statsByDataProvider[dataProviderAddress]['global'] = parseFloat(this._decimalPipe.transform(stats.successRate, '1.2-2'));
                                        this.statsByDataProvider[dataProviderAddress]['iqr'] = parseFloat(this._decimalPipe.transform(stats.successRateIQR, '1.2-2'));
                                        this.statsByDataProvider[dataProviderAddress]['pct'] = parseFloat(this._decimalPipe.transform(stats.successRatePct, '1.2-2'));
                                        this.statsByDataProvider[dataProviderAddress]['availability'] = parseFloat(this._decimalPipe.transform(stats.availability, '1.2-2'));
                                        this.statsByDataProvider[dataProviderAddress]['totalCases'] = stats.numberOfCases / this.pricesData.submissionStats.filter(stat => stat.dataProvider == dataProviderAddress && stat.symbol != null).length;
                                        this.statsByDataProvider[dataProviderAddress]['color'] = colors[dataProviderIdx];
                                    });

                                    this.pricesData.distributedRewards.map(distributedReward => {
                                        if (distributedReward.dataProvider == dataProviderAddress) {
                                            this.statsByDataProvider[dataProviderAddress]['delegatorRewards'] += distributedReward.reward;
                                            this.statsByDataProvider[dataProviderAddress]['providerRewards'] += distributedReward.providerReward;
                                            this.statsByDataProvider[dataProviderAddress]['rewardsCount'] += 1;
                                        }
                                    });
                                    this.statsByDataProvider[dataProviderAddress]['rewardRate'] = ((this.statsByDataProvider[dataProviderAddress]['rewardsCount'] * 100) / this.statsByDataProvider[dataProviderAddress]['totalCases']).toFixed(2);
                                }
                            });
                        }

                        break;
                    case SubmissionStatsChartType.radar:
                        let colors: string[] = Utils.getColors();
                        let dataProviderSubmissionStats: Map<string, any> = new Map();
                        if (dataProviders.length == 1) {
                            let symbols: Set<string> = new Set<string>();
                            this.pricesData.submissionStats.filter(stats => stats.symbol != null).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(stats => {
                                symbols.add(stats.symbol);
                                if (!dataProviderSubmissionStats.has('Pct')) {
                                    dataProviderSubmissionStats.set('Pct', { name: 'Pct', data: [] });
                                }
                                dataProviderSubmissionStats.get('Pct').data.push(this._decimalPipe.transform(stats.successRatePct, '1.2-2'));
                                if (!dataProviderSubmissionStats.has('IQR')) {
                                    dataProviderSubmissionStats.set('IQR', { name: 'IQR', data: [] });
                                }
                                dataProviderSubmissionStats.get('IQR').data.push(this._decimalPipe.transform(stats.successRateIQR, '1.2-2'));
                                if (!dataProviderSubmissionStats.has('Global')) {
                                    dataProviderSubmissionStats.set('Global', { name: 'Global', data: [] });
                                }
                                dataProviderSubmissionStats.get('Global').data.push(this._decimalPipe.transform(stats.successRate, '1.2-2'));
                            });

                            chartSeries.push(dataProviderSubmissionStats.get('Global'), dataProviderSubmissionStats.get('IQR'), dataProviderSubmissionStats.get('Pct'));
                            chartSeries.map((serie, serieIdx) => {
                                this.chartOptions.colors.push(serie.name == 'Pct' ? colors[3] : colors[serieIdx]);
                                this.chartOptions.markers.colors.push(serie.name == 'Pct' ? colors[3] : colors[serieIdx]);
                                (this.chartOptions.markers.strokeColors as string[]).push('var(--ui-bg-card)');
                            })
                            this.chartOptions.xaxis.categories = Array.from(symbols).sort((a, b) => a.localeCompare(b));
                        } else {
                            let symbols: Set<string> = new Set<string>();
                            this.pricesData.submissionStats.filter(stats => stats.symbol != null).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(stats => {
                                symbols.add(stats.symbol);
                                dataProviders.map(dataProviderAddress => {
                                    if (!dataProviderSubmissionStats.has(dataProviderAddress)) {
                                        dataProviderSubmissionStats.set(dataProviderAddress, { name: this.dataProvidersInfoMap[dataProviderAddress].name, data: [] });
                                    }
                                    if (stats.dataProvider == dataProviderAddress) {
                                        switch (this.successRateCompareMode) {
                                            case 'global':
                                                dataProviderSubmissionStats.get(dataProviderAddress).data.push(this._decimalPipe.transform(stats.successRate, '1.2-2'))
                                                break;
                                            case 'iqr':
                                                dataProviderSubmissionStats.get(dataProviderAddress).data.push(this._decimalPipe.transform(stats.successRateIQR, '1.2-2'))
                                                break;
                                            case 'pct':
                                                dataProviderSubmissionStats.get(dataProviderAddress).data.push(this._decimalPipe.transform(stats.successRatePct, '1.2-2'))
                                                break;
                                        }
                                    }
                                });
                            });
                            dataProviders.map((dataProviderAddress, serieIdx) => {
                                chartSeries.push(dataProviderSubmissionStats.get(dataProviderAddress));
                                this.chartOptions.colors.push(colors[serieIdx]);
                                this.chartOptions.markers.colors.push(colors[serieIdx]);
                                (this.chartOptions.markers.strokeColors as string[]).push('var(--ui-bg-card)');
                            });
                            this.chartOptions.xaxis.categories = Array.from(symbols).sort((a, b) => a.localeCompare(b));
                        }
                        this.chartOptions.series = chartSeries;
                        break;
                }
            }
        } catch (err) {
            this._uiNotificationsService.error(`Unable to submissions stats chart`, err.message);
        }
    }




    _initializeChart(type: SubmissionStatsChartType): void {
        switch (type) {
            case SubmissionStatsChartType.radar:
                this.chartOptions = {
                    chart: {
                        height: '100%',
                        type: "radar",
                        toolbar: {
                            show: false
                        }
                    },
                    colors: [],
                    markers: {
                        colors: [],
                        strokeColors: [],
                        strokeWidth: 1,
                        size: 3,
                        hover: {
                            sizeOffset: 4,
                        }

                    },
                    tooltip: {
                        theme: 'dark',
                        style: {
                            fontFamily: 'inherit'
                        }
                    },
                    plotOptions: {
                        radar: {
                            polygons: {
                                strokeColors: 'rgba(var(--ui-text-secondary-rgb), 0.25)',
                                connectorColors: 'rgba(var(--ui-text-secondary-rgb), 0.25)',
                                fill: {
                                    colors: ['var(--ui-bg-card)', 'var(--ui-border)']
                                }
                            }
                        }
                    },
                    legend: {
                        show: true,
                        offsetY: -8,
                        labels: {
                            colors: 'rgba(--ui-text-secondary-rgb)',
                        },
                    },
                    stroke: {
                        width: 1
                    },
                    fill: {
                        opacity: 0.25
                    },
                    series: [],
                    xaxis: {
                        categories: [],
                    },
                    yaxis: {
                        tickAmount: 5,
                        min: 0,
                        max: 100,
                        labels: {
                            style: {
                                fontFamily: 'inherit',
                                colors: 'rgba(var(--ui-text-secondary-rgb), 0.9)'
                            }
                        }
                    }
                };
                break;
        }
    }


    ngOnInit(): void {
        this._initializeChart(this.type);
    }
    ngOnDestroy(): void {
    }

}
export enum SubmissionStatsChartType {
    radar, bar
}