import { ActivatedRoute, Params } from "@angular/router";
import { Observable, Subscriber, interval, map, switchMap, throwError } from "rxjs";
import { TimeDiffPipe } from "./pipes/time-diff.pipe";

export class Utils {
    static getParentParams(route: ActivatedRoute): Observable<Params> {
        if (route.parent) {
            return this.getParentParams(route.parent).pipe(
                switchMap((params: Params) => {
                    return route.params.pipe(
                        map((ownParams: any) => {

                            return { ...ownParams, ...params };
                        })
                    );
                })
            );
        } else {
            return route.params;
        }
    }

    static handleError(observer: Subscriber<any>, error: any) {
        if (error.error.message) {
            observer.error(error.error.message);
        } else if (error.message) {
            observer.error(error.message);
        } else {
            observer.error('Unhandled error');
        }
        return throwError(error);
    }

    static countdownTimer(inputTime: number, refreshInterval: number, displayUnit: string, html: boolean, timeDiffPipe: TimeDiffPipe): Observable<string> {
        return new Observable<string>(observer => {
            observer.next(timeDiffPipe.transform(inputTime, displayUnit, html));
            interval(refreshInterval).subscribe(() => {
                try {
                    observer.next(timeDiffPipe.transform(inputTime, displayUnit, html));
                } catch (e) {
                    observer.error(e.message);
                    observer.complete();
                }
            });
        });
    }

}