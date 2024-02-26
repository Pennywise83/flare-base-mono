import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppModule } from 'app/app.module';
import { isEmpty, isNotEmpty } from 'class-validator';
import { ApexAxisChartSeries, ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { ClaimedRewardDateHistogramElement, Commons, DataProviderInfo, RewardDTO } from '../../../../../../libs/commons/src';
import { animations } from 'app/commons/animations';
import { LoaderComponent } from 'app/commons/loader/loader.component';
import { NoDataComponent } from 'app/commons/no-data/no-data.component';

@Component({
    selector: 'flare-base-claimed-rewards-chart',
    templateUrl: './claimed-rewards-chart.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [AppModule, CommonModule, LoaderComponent, NoDataComponent,
        MatMenuModule, MatIconModule, MatTooltipModule, NgApexchartsModule, DecimalPipe
    ],
    providers: [DecimalPipe],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Default,
    animations: animations

})
export class ClaimedRewardsChartComponent implements OnInit, OnChanges {
    @Input() public claimedRewardsDateHistogramData: ClaimedRewardDateHistogramElement[] = null;
    @Input() public dataProvidersInfo: DataProviderInfo[] = [];
    @Input() public loading: boolean = false;
    @Input() public progress: number = 0;
    claimedRewardsChartData: ApexOptions;

    constructor(
        private _cdr: ChangeDetectorRef,
        private _decimalPipe: DecimalPipe
    ) {

    }
    ngOnInit(): void {
        this._prepareChartData();

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
        if (isNotEmpty(this.claimedRewardsChartData)) {
            try {

                let timestampMap: { [xAxis: number]: any } = {};
                let rewardEpochIdMap: { [xAxis: number]: any } = {};
                this.claimedRewardsDateHistogramData.map(claimedReward => {
                    if (!timestampMap[claimedReward.claimTimestamp]) { timestampMap[claimedReward.claimTimestamp] = {} }
                    if (!timestampMap[claimedReward.claimTimestamp][this.getDataProviderInfo(claimedReward.dataProvider).name]) {
                        timestampMap[claimedReward.claimTimestamp][this.getDataProviderInfo(claimedReward.dataProvider).name] = 0;
                    }
                    timestampMap[claimedReward.claimTimestamp][this.getDataProviderInfo(claimedReward.dataProvider).name] += claimedReward.amount;


                    if (!rewardEpochIdMap[claimedReward.rewardEpochId]) { rewardEpochIdMap[claimedReward.rewardEpochId] = {} }
                    if (!rewardEpochIdMap[claimedReward.rewardEpochId][this.getDataProviderInfo(claimedReward.dataProvider).name]) {
                        rewardEpochIdMap[claimedReward.rewardEpochId][this.getDataProviderInfo(claimedReward.dataProvider).name] = 0;
                    }
                    rewardEpochIdMap[claimedReward.rewardEpochId][this.getDataProviderInfo(claimedReward.dataProvider).name] += claimedReward.amount;
                });

                let xAxisElements: number[] = [];

                let series: ApexAxisChartSeries = [];

                for (let xAxisElement in timestampMap) {
                    xAxisElements.push(parseInt(xAxisElement));
                    for (let address in timestampMap[xAxisElement]) {
                        if (!series.find(serie => serie.name == address)) {
                            series.push({ name: address, data: [] });
                        }
                        let data: any = { y: timestampMap[xAxisElement][address], x: parseInt(xAxisElement) };
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
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 10,
                },
            },
            legend: {
                show: true,
                position: "top",
                horizontalAlign: 'right'
            },
            tooltip: {
                followCursor: true,
                shared: true,
                intersect: false,
                theme: 'dark',
                x: {
                    format: 'MMM dd, yyyy',
                },
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '100%'
                },
            },
            stroke: {
                width: 1,
                colors: ['transparent']
            },

            dataLabels: {
                enabled: false,
            },

            yaxis: {
                labels: {
                    style: {
                        colors: 'var(--fuse-text-secondary)',
                    },
                    formatter: (val) => {
                        return this._decimalPipe.transform(val)
                    }
                }
            },
            xaxis: {
                type:'datetime',
                axisBorder: {
                    show: true
                },
                axisTicks: {
                    show: true
                },
                labels: {
                    offsetY: 0,
                    style: {
                        colors: 'var(--fuse-text-secondary)',
                    },
                },
                tickPlacement: 'between',
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
                    }
                }
            }],
        }

    }

}


