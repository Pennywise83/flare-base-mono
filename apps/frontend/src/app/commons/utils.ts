import { ActivatedRoute, Params } from "@angular/router";
import { Observable, Subscriber, interval, map, switchMap, throwError } from "rxjs";
import { TimeDiffPipe } from "./pipes/time-diff.pipe";
import { NetworkEnum } from "../../../../../libs/commons/src";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";

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


    static getChainDefinition(network: NetworkEnum): IChainDefinition {
        return availableChains.find(chain => chain.network == network);
    }
    static hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        let rgb = {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        };
        let rgbString = `${rgb.r},${rgb.g},${rgb.b}`;
        return rgbString;
    }

    static getColors(opacity?: number): string[] {
        let colors: string[] = ['#00c4e8', '#00E396', '#FF4560', '#FEB019', '#775DD0'];
        let result: string[] = [];
        function addAlpha(color, opacity) {
            // coerce values so it is between 0 and 1.
            var _opacity = Math.round(Math.min(Math.max(opacity ?? 1, 0), 1) * 255);
            return color + _opacity.toString(16).toUpperCase();
        }
        if (opacity) {
            colors.map(color => {
                result.push(addAlpha(color, opacity));
            })
        } else {
            result = colors;
        }
        return result;
    }
}