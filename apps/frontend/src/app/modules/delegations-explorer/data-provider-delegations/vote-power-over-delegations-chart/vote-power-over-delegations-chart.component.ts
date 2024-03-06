import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { ApexAxisChartSeries, ApexOptions, ChartComponent, NgApexchartsModule } from "ng-apexcharts";
import { NetworkEnum, RewardEpochSettings, VotePowerDTO } from "../../../../../../../../libs/commons/src";

@Component({
    selector: 'flare-base-vote-power-over-delegations-chart',
    templateUrl: './vote-power-over-delegations-chart.component.html',
    styles: [`flare-base-vote-power-over-delegations-chart {
        display: contents;
    }`],
    imports: [AppModule,
        LoaderComponent, NoDataComponent, NgApexchartsModule, DecimalPipe

    ],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DecimalPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class VotePowerOverDelegationsChartComponent implements OnInit, OnDestroy, OnChanges {
    private _network: NetworkEnum;
    chartOptions: ApexOptions = {};
    @ViewChild("vpOverDelegationsChart") chart: ChartComponent;
    @Input() votePowerHistory: VotePowerDTO[] = [];
    @Input() loading: boolean;
    @Input() rewardEpochSettings: RewardEpochSettings;

    constructor(
        private _cdr: ChangeDetectorRef,
        private _decimalPipe: DecimalPipe) {

    }
    ngOnChanges(changes: SimpleChanges): void {
        if (this.rewardEpochSettings && ((changes.loading && changes.loading.currentValue == false) || (changes.votePowerHistory && changes.votePowerHistory.currentValue != changes.votePowerHistory.previousValue))) {
            this.parseChartData();
        }
    }

    parseChartData() {
        if (this.votePowerHistory.length > 0) {
            let votePowerChartSeries: ApexAxisChartSeries = [{ name: 'Vote power', data: [] }];
            let totalDelegatorsChartSeries: ApexAxisChartSeries = [{ name: 'Total delegators', data: [] }];
            this.votePowerHistory.map(r => {
                votePowerChartSeries[0].data.push({ x: this.rewardEpochSettings.getEndTimeForEpochId(r.rewardEpochId), y: Math.round(r.amount), rewardEpoch: r.rewardEpochId } as any);
                totalDelegatorsChartSeries[0].data.push({ x: this.rewardEpochSettings.getEndTimeForEpochId(r.rewardEpochId), y: r.delegators, rewardEpoch: r.rewardEpochId } as any);
            });
            votePowerChartSeries[0].data.sort((a, b) => a.x - b.x);
            totalDelegatorsChartSeries[0].data.sort((a, b) => a.x - b.x);
            const vpMin: number = Math.min(...votePowerChartSeries[0].data.map(d => d.y));
            const vpMax: number = Math.max(...votePowerChartSeries[0].data.map(d => d.y));
            let tdMin: number = Math.min(...totalDelegatorsChartSeries[0].data.map(d => d.y));
            let tdMax: number = Math.max(...totalDelegatorsChartSeries[0].data.map(d => d.y));

            tdMin < 10 ? tdMin = tdMin - 1 : tdMin;
            tdMin > 10 && tdMin < 20 ? tdMin = tdMin - 2 : tdMin;

            this.chartOptions.yaxis[0].min = vpMin - ((vpMax - vpMin) / 4.5);
            this.chartOptions.yaxis[0].max = vpMax;
            this.chartOptions.yaxis[1].min = tdMin - ((tdMax - tdMin) / 4.5);
            this.chartOptions.yaxis[1].max = tdMax;
            if (tdMax == 0) {
                totalDelegatorsChartSeries[0].data = [];
            }
            if (this.chart) {
                this.chartOptions.series = [votePowerChartSeries[0], totalDelegatorsChartSeries[0]];
                this.chart.updateSeries(this.chartOptions.series);
                this.chart.updateOptions(this.chartOptions, true, false);
                this._cdr.detectChanges();
            }
            this._cdr.detectChanges();
        } else {
            this._initializeChart();
        }
    }
    _initializeChart(): void {
        this.chartOptions = {
            chart: {
                animations: {
                    enabled: true,
                    dynamicAnimation: { enabled: false }
                },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',

                type: 'area',
                stacked: false,
                toolbar: {
                    show: false,
                },
                zoom: {
                    enabled: false,
                },
            },
            colors: ['#00c4e8', '#41d8b4'],
            dataLabels: {
                enabled: false,
            },
            fill: {
                colors: ['#00c4e8', '#41d8b4'],
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.9,
                    stops: [0, 90, 100]
                }
            },
            grid: {
                show: false,
                padding: {
                    top: 0,
                    bottom: -40,
                    left: 0,
                    right: 0,
                },
            },
            legend: {
                show: true,
                position: "top",
                horizontalAlign: 'right'
            },
            series: [],
            stroke: {
                curve: 'straight',
                width: 2,
            },
            tooltip: {
                followCursor: true,
                theme: 'dark',
                x: {
                    format: 'MMM dd, yyyy',
                },
            },

            xaxis: {
                axisBorder: {
                    show: false,
                },
                axisTicks: {
                    show: false
                },
                labels: {
                    offsetY: -20,
                    style: {
                        colors: 'rgba(var(--ui-text-secondary-rgb), var(--tw-text-opacity))',
                    },
                },
                tickPlacement: 'between',
                type: 'datetime',
                tooltip: {
                    enabled: false,
                }

            },
            yaxis: [{
                labels: {
                    formatter: (value) => {
                        return this._decimalPipe.transform(value, '1.0-0');
                    }
                },
                show: false
            }, {
                labels: {
                    formatter: (value) => {
                        return this._decimalPipe.transform(value, '1.0-0');
                    }
                },
                show: false
            }],
        }
    }
    ngOnInit(): void {
        this._initializeChart();
    }
    ngOnDestroy(): void {
    }

}