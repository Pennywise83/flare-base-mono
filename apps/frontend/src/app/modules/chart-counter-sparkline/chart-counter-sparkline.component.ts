import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppModule } from 'app/app.module';
import { animations } from 'app/commons/animations';
import { LoaderComponent } from 'app/commons/loader/loader.component';
import { NoDataComponent } from 'app/commons/no-data/no-data.component';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';

@Component({
    selector: 'flare-base-chart-counter-sparkline',
    templateUrl: './chart-counter-sparkline.component.html',
    styleUrls: ['./chart-counter-sparkline.component.scss'],
    encapsulation: ViewEncapsulation.None,
    imports: [AppModule, CommonModule, LoaderComponent, NoDataComponent,
        MatMenuModule, MatIconModule, MatTooltipModule, NgApexchartsModule, DecimalPipe
    ],
    providers: [DecimalPipe],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations

})
export class ChartCounterSparklineComponent implements OnInit, OnChanges {
    @Input() public loading: boolean = false;
    @Input() public progress: number = 0;


    @Input() counterValue: number = 0;
    @Input() variationValue: number = null;
    @Input() variationLabel: string = null;
    @Input() chartColor: string = '#00c4e8';
    chartData: ApexOptions = {};
    @Input() chartSeries = null;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.chartSeries) {
            this.chartData.series = changes.chartSeries.currentValue;
        }
    }
    ngOnInit(): void {
        this.chartData = {
            chart: {
                animations: {
                    enabled: false,
                },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'area',
                sparkline: {
                    enabled: true,
                },
            },
            series: [],
            colors: [this.chartColor],
            fill: {
                colors: [this.chartColor],
                opacity: 0.5,
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            tooltip: {
                followCursor: false,
                theme: 'dark',
            },
            xaxis: {
                type: 'category',
                categories: []
            },
            yaxis: {
                labels: {
                    formatter: (val): string => val.toString(),
                },
            },
        };
    }

}