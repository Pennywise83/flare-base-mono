import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { Subscription, timer } from "rxjs";
import { AppModule } from "../../app.module";
import { AlertComponent } from "../alert";
import { animations } from "../animations";

@Component({
    selector: 'flare-base-no-data',
    templateUrl: './no-data.component.html',
    imports: [AppModule, MatIconModule, AlertComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class NoDataComponent implements OnInit, OnDestroy {
    showNoData: boolean = false;
    subscription: Subscription = new Subscription();
    constructor(private _cdr: ChangeDetectorRef) { }
    ngOnInit(): void {
        this.subscription = timer(500).subscribe(() => {
            this.showNoData = true;
            this._cdr.detectChanges();
        });
    }
    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    @Input() label: string = 'No data found'
    @Input() skeletonType: 'text' | 'table' | 'chart' = 'text';
}
