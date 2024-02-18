import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgApexchartsModule } from 'ng-apexcharts';
import { AppModule } from '../../app.module';
import { animations } from '../../commons/animations';
import { LoaderComponent } from '../../commons/loader/loader.component';
import { NoDataComponent } from '../../commons/no-data/no-data.component';
import { CountdownComponent } from 'app/commons/countdown/countdown.component';

@Component({
    selector: 'flare-base-counter',
    templateUrl: './counter.component.html',
    styles: [`flare-base-counter {
        display: contents;
    }`],
    encapsulation: ViewEncapsulation.None,
    imports: [AppModule, CommonModule, LoaderComponent, NoDataComponent,
        MatMenuModule, MatIconModule, MatTooltipModule, NgApexchartsModule, DecimalPipe, CountdownComponent
    ],
    providers: [DecimalPipe],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations

})
export class CounterComponent {
    @Input() public loading: boolean = false;
    @Input() public progress: number = 0;
    @Input() counterValue: number | string = 0;
    @Input() countdownValue: number;
    @Input() label: any = null;
    @Input() variationValue: number = null;
    @Input() variationLabel: string = null;

}