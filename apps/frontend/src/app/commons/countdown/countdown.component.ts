import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { AppModule } from "app/app.module";
import { Subject, Subscription, takeUntil } from "rxjs";
import { TimeDiffPipe } from "../pipes/time-diff.pipe";
import { Utils } from "../utils";
import { INTERVALS } from "../pipes/time-diff.pipe";

@Component({
    selector: 'flare-base-countdown',
    templateUrl: './countdown.component.html',
    imports: [AppModule, TimeDiffPipe,],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [TimeDiffPipe],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountdownComponent implements OnInit, OnDestroy {
    private _subscription: Subscription = new Subscription();
    private _unsubscribe: Subject<any> = new Subject<any>();
    @Input() inputTimestamp: number;
    @Input() displayUnits: number = 2;
    value: string;

    constructor(
        private _timeDiffPipe: TimeDiffPipe,
        private _cdr: ChangeDetectorRef
    ) {

    }

    ngOnDestroy(): void {
        this._unsubscribe.next(true);
        this._unsubscribe.complete();
    }
    ngOnInit(): void {
        const now: number = new Date().getTime();
        const intervals = INTERVALS;
        const diff: number = (now - this.inputTimestamp) > 0 ? (now - this.inputTimestamp) : -(now - this.inputTimestamp);
        let selectedIntervalLabel: string;
        let selectedInterval: number = null;
        let counter: number = 0;
        for (let label in intervals) {
            if (diff >= (intervals[label] * 1000)) {
                if (counter < this.displayUnits) {
                    selectedIntervalLabel = label;
                    selectedInterval = intervals[label] * 1000;
                    counter++;
                }
            }
        }
        Utils.countdownTimer(this.inputTimestamp, selectedInterval, selectedIntervalLabel, true, this._timeDiffPipe).
            pipe(takeUntil(this._unsubscribe)).subscribe(
                (countdownValue) => { this.value = countdownValue; this._cdr.detectChanges(); },
                (countdownErr) => console.error(countdownErr)
            );
    }


}