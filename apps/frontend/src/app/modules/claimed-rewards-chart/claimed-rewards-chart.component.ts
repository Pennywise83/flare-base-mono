import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppModule } from 'app/app.module';
import { animations } from 'app/commons/animations';
import { LoaderComponent } from 'app/commons/loader/loader.component';
import { NoDataComponent } from 'app/commons/no-data/no-data.component';
import { isEmpty, isNotEmpty } from 'class-validator';
import { ApexAxisChartSeries, ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { ClaimedRewardHistogramElement, ClaimedRewardsGroupByEnum, Commons, DataProviderInfo } from '../../../../../../libs/commons/src';

@Component({
    selector: 'flare-base-claimed-rewards-chart',
    templateUrl: './claimed-rewards-chart.component.html',
    styles: [`flare-base-claimed-rewards-chart {
        display: contents;
    }`],
    encapsulation: ViewEncapsulation.None,
    imports: [AppModule, CommonModule, LoaderComponent, NoDataComponent, MatMenuModule, MatIconModule, MatTooltipModule, NgApexchartsModule, DecimalPipe, DatePipe, MatButtonToggleModule, FormsModule],
    providers: [DecimalPipe, DatePipe],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Default,
    animations: animations

})
export class ClaimedRewardsChartComponent implements OnInit, OnChanges {
    @Input() public claimedRewardsDateHistogramData: ClaimedRewardHistogramElement[] = null;
    @Input() public dataProvidersInfo: DataProviderInfo[] = [];
    @Input() public loading: boolean = false;
    @Output() public groupByEvent: EventEmitter<ClaimedRewardsGroupByEnum> = new EventEmitter<ClaimedRewardsGroupByEnum>();
    @Input() public groupBy: ClaimedRewardsGroupByEnum = ClaimedRewardsGroupByEnum.rewardEpochId;
    claimedRewardsChartData: ApexOptions;
    claimedRewardsGroupByEnum = ClaimedRewardsGroupByEnum;

    constructor(
        private _cdr: ChangeDetectorRef,
        private _decimalPipe: DecimalPipe,
        private _datePipe: DatePipe
    ) {

    }

    ngOnInit(): void {
        this._prepareChartData();

    }
    emitGroupBy(groupBy: string) {
        this.groupBy = ClaimedRewardsGroupByEnum[groupBy];
        this.groupByEvent.emit(ClaimedRewardsGroupByEnum[groupBy]);
    }
    ngOnChanges(changes: SimpleChanges): void {
        if (changes.claimedRewardsDateHistogramData) {
            this.claimedRewardsDateHistogramData = changes.claimedRewardsDateHistogramData.currentValue;
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
        if (isNotEmpty(this.claimedRewardsDateHistogramData)) {
            try {
                let timestampMap: { [xAxis: number]: any } = {};
                this.claimedRewardsDateHistogramData.map(claimedReward => {
                    const mapKey: string = claimedReward.timestamp + '_' + (claimedReward.rewardEpochId ? claimedReward.rewardEpochId : '');
                    if (!timestampMap[mapKey]) { timestampMap[mapKey] = {} }
                    if (!timestampMap[mapKey][this.getDataProviderInfo(claimedReward.dataProvider).name]) {
                        timestampMap[mapKey][this.getDataProviderInfo(claimedReward.dataProvider).name] = 0;
                    }
                    timestampMap[mapKey][this.getDataProviderInfo(claimedReward.dataProvider).name] += claimedReward.amount;
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
                this.claimedRewardsChartData.xaxis.categories = xAxisElements;
                series.map(serie => {
                    serie.data.sort((a, b) => b.x - a.x);
                });
                (this.claimedRewardsChartData.yaxis as any).min = 0;
                this.claimedRewardsChartData.series = series;
            } catch (err) {
                console.error(err);
            }
        }
    }
    private _prepareChartData(): void {
        this.claimedRewardsChartData = {
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
            colors: ['#00c4e8', '#41d8b4', '#ce9887', '#f9c859', '#ff78f8', '#9f7efe', '#3691ff', '#ff936a', '#ff6480', '#7a82da'],
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'light',
                    type: "vertical",

                    shadeIntensity: 0.25,
                    opacityFrom: 0.75,
                    opacityTo: 0.95,
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
                horizontalAlign: 'right'
            },
            tooltip: {
                followCursor: false,
                shared: true,
                intersect: false,
                theme: 'dark',
                x: {
                    formatter: (value: number, opts: any) => {
                        let rewardEpochId: string = null;
                        this.claimedRewardsChartData.series.map(serie => {
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
                            return this._decimalPipe.transform(val, '1.3-3')
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


