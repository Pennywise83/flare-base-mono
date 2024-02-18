import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { Subscription, timer } from "rxjs";
import { AppModule } from "../../app.module";
import { animations } from "../animations";

@Component({
    selector: 'flare-base-loader',
    templateUrl: './loader.component.html',
    styleUrls: ['./loader.component.scss'],
    imports: [AppModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class LoaderComponent implements OnChanges, OnDestroy {
    @Input() loading: boolean = true;
    @Input() progress: number;
    @Input() label: string = 'Loading data...';
    @Input() delay: number = 250;
    @Input() skeletonType: 'text' | 'table' | 'chart' = 'text';
    @Input() overlay: boolean = false;
    showLoader: boolean = false;
    showSkeleton: boolean = false;
    lastLoadingChangeTime: number = new Date().getTime();
    loadingTimeout: any;
    subscription: Subscription = new Subscription();

    constructor(private _cdr: ChangeDetectorRef) { }




    ngOnChanges(changes: SimpleChanges): void {
        if (typeof changes.loading != 'undefined' && changes.loading.isFirstChange()) {
            this.showSkeleton = true;
            if (typeof changes.loading.currentValue != 'undefined') {
                this.showSkeleton = changes.loading.currentValue;
            }
            this.loading = changes.loading.currentValue;
            this._cdr.detectChanges();
        } else {
            if (typeof changes.loading != 'undefined' && (changes.loading.currentValue !== changes.loading.previousValue)) {
                if (this.subscription && changes.loading.currentValue == false) {
                    this.showLoader = false;
                    this.showSkeleton = false;
                    this._cdr.detectChanges();
                    this.subscription.unsubscribe();
                } else {
                    if (this.showSkeleton == false) {
                        this.subscription = timer(this.delay).subscribe(() => {
                            this.showLoader = true;
                            this.showSkeleton = !this.overlay;
                            this._cdr.detectChanges();
                        });
                    }
                }
            }
        }
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

}
