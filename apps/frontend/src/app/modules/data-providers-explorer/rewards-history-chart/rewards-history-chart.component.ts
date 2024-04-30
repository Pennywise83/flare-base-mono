import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnInit, Renderer2, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppModule } from 'app/app.module';
import { animations } from 'app/commons/animations';
import { LoaderComponent } from 'app/commons/loader/loader.component';
import { NoDataComponent } from 'app/commons/no-data/no-data.component';
import { Utils } from 'app/commons/utils';
import { isEmpty, isNotEmpty } from 'class-validator';
import { ApexAxisChartSeries, ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { Commons, DataProviderInfo } from '../../../../../../../libs/commons/src';
import { DataProviderRewardStatsDTO } from '../rewards-history/model/data-provider-reward-stats-dto';
import { timer } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'flare-base-rewards-history-chart',
    templateUrl: './rewards-history-chart.component.html',
    styles: [`flare-base-claimed-rewards-chart {
        display: contents;
    }`],
    encapsulation: ViewEncapsulation.None,
    imports: [AppModule, CommonModule, LoaderComponent, NoDataComponent, MatMenuModule, MatIconModule, MatTooltipModule, NgApexchartsModule, DecimalPipe, DatePipe, MatButtonToggleModule, MatButtonModule],
    providers: [DecimalPipe, DatePipe],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Default,
    animations: animations

})
export class RewardsHistoryChartComponent implements OnInit, OnChanges {
    @Input() public rewardsHistoryData: DataProviderRewardStatsDTO[] = null;
    @Input() public dataProvidersInfo: DataProviderInfo[] = [];
    @Input() public loading: boolean = false;
    @ViewChild("rewardsHistoryChart") chart: ChartComponent;
    chartOptions: ApexOptions;
    isFullScreen: boolean = false;

    constructor(
        private renderer: Renderer2,
        private _cdr: ChangeDetectorRef,
        private _decimalPipe: DecimalPipe,
        private _datePipe: DatePipe
    ) {

    }

    ngOnInit(): void {
        this._initializeChart();

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
        if (changes.rewardsHistoryData && !changes.rewardsHistoryData.isFirstChange() && JSON.stringify(changes.rewardsHistoryData.currentValue) != JSON.stringify(changes.rewardsHistoryData.previousValue)) {
            this.rewardsHistoryData = changes.rewardsHistoryData.currentValue;
            this.parseChartData()
            this._cdr.detectChanges();
        }
    }
    getDataProviderInfo(providerAddress: string): DataProviderInfo {
        let dataProviderInfo: DataProviderInfo = this.dataProvidersInfo.find(element => element.address == providerAddress);
        if (isEmpty(dataProviderInfo)) {
            dataProviderInfo = new DataProviderInfo();
            if (isEmpty(providerAddress)) {
                dataProviderInfo.name = 'Others';
            } else {
                dataProviderInfo.name = providerAddress;
            }
        }
        return dataProviderInfo;
    }
    parseChartData() {
        if (isNotEmpty(this.rewardsHistoryData)) {
            try {
                let timestampMap: { [xAxis: number]: any } = {};
                this.rewardsHistoryData.map(rewardsStats => {
                    const mapKey: string = rewardsStats.timestamp + '_' + (rewardsStats.epochId ? rewardsStats.epochId : '');
                    if (!timestampMap[mapKey]) { timestampMap[mapKey] = {} }
                    if (!timestampMap[mapKey]['Provider rewards']) {
                        timestampMap[mapKey]['Provider rewards'] = 0;
                    }
                    if (!timestampMap[mapKey]['Delegators rewards']) {
                        timestampMap[mapKey]['Delegators rewards'] = 0;
                    }
                    timestampMap[mapKey]['Provider rewards'] += rewardsStats.providerReward;
                    timestampMap[mapKey]['Delegators rewards'] += rewardsStats.delegatorsReward;
                });

                let xAxisElements: number[] = [];
                let series: ApexAxisChartSeries = [];
                for (let xAxisElement in timestampMap) {
                    xAxisElements.push(parseInt(xAxisElement.split('_')[0]));
                    for (let address in timestampMap[xAxisElement]) {
                        if (!series.find(serie => serie.name == address)) {
                            series.push({ name: address, data: [] });
                        }
                        let data: any = { y: timestampMap[xAxisElement][address], x: parseInt(xAxisElement), rewardEpochId: xAxisElement.split('_')[1] };
                        series.find(serie => serie.name == address).data.push(data);
                    }
                }
                xAxisElements = [... new Set(xAxisElements)].sort((a, b) => b - a);
                xAxisElements.map(timestamp => {
                    series.map(serie => {
                        if ((serie.data as any[]).filter(d => d.x == timestamp).length == 0) {
                            let dataCopy: any = Commons.clone(serie.data[0]);
                            dataCopy.x = timestamp;
                            dataCopy.y = null;
                            serie.data.push(dataCopy);
                        }
                    });
                });
                this.chartOptions.xaxis.categories = xAxisElements;
                series.map(serie => {
                    serie.data.sort((a, b) => b.x - a.x);
                });
                (this.chartOptions.yaxis as any).min = 0;
                this.chartOptions.series = series;
                timer(50).subscribe(() => {
                    let zoomableElement: ElementRef = (this.chart as any).chartElement.nativeElement.closest('.zoomable');
                    this.chartOptions.chart.height = zoomableElement ? ((zoomableElement as any).offsetHeight) + 'px' : '100%';
                    this.chart.updateOptions(this.chartOptions);
                    this._cdr.detectChanges();
                });
            } catch (err) {
                console.error(err);
            }
        }
    }
    private _initializeChart(): void {
        this.chartOptions = {
            chart: {
                type: 'bar',
                animations: {
                    enabled: true,
                    dynamicAnimation: { enabled: false }
                },
                stacked: true,
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                toolbar: {
                    show: false,
                },
                zoom: {
                    enabled: false,
                },
            },
            series: [],
            colors: Utils.getColors(),
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: "vertical",

                    shadeIntensity: 0.25,
                    opacityFrom: 0.80,
                    opacityTo: 0.90,
                    stops: [0, 100]
                }
            },
            grid: {
                show: false,
                padding: {
                    top: 20,
                    bottom: 0,
                    left: 10,
                    right: 10,
                },
            },
            legend: {
                show: true,
                position: "top",
                floating: true,
                offsetY: 10,
                horizontalAlign: 'center'
            },
            tooltip: {
                followCursor: false,
                shared: true,
                intersect: false,
                theme: 'dark',
                x: {
                    formatter: (value: number, opts: any) => {
                        let rewardEpochId: string = null;
                        this.chartOptions.series.map(serie => {
                            if (rewardEpochId == null) {
                                rewardEpochId = serie.data.find(singleData => singleData.x == value).rewardEpochId;
                            }
                        });
                        if (isNotEmpty(rewardEpochId)) {
                            return `Reward epoch: ${rewardEpochId} - ${this._datePipe.transform(value, 'MMM dd, yyyy HH:mm:ss')}`;
                        } else {
                            return this._datePipe.transform(value, 'MMM dd, yyyy');
                        }
                    }
                }
            },
            dataLabels: {
                enabled: false,
            },
            yaxis: {
                labels: {
                    style: {
                        colors: 'rgba(var(--ui-text-secondary-rgb), var(--tw-text-opacity))',
                    },
                    formatter: (val) => {
                        if (val < 1000) {
                            return this._decimalPipe.transform(val, '1.2-2')
                        } else {
                            return this._decimalPipe.transform(val, '1.0-0')
                        }

                    }
                }
            },
            xaxis: {
                type: 'datetime',
                axisBorder: {
                    show: true
                },
                axisTicks: {
                    show: true,
                },
                labels: {
                    offsetY: 0,
                    style: {
                        colors: 'rgba(var(--ui-text-secondary-rgb), var(--tw-text-opacity))',
                    },
                },
                tooltip: {
                    enabled: false,
                }
            },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: {
                    },
                    yaxis: {
                        show: false
                    },
                    legend: {
                        show: false
                    },
                    grid: {
                        padding: {
                            top: 0,
                            bottom: 0,
                            left: 5,
                            right: 5,
                        },
                    }
                }
            }],
        }
    }
}