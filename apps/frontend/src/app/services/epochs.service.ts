import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, delay, map, throwError } from 'rxjs';
import { ActionResult, PriceEpochSettings, RewardEpochSettings } from '../../../../../libs/commons/src';
import { Utils } from '../commons/utils';


@Injectable({
  providedIn: 'root'
})
export class EpochsService {
  private _rewardEpochSettings: { [network: string]: RewardEpochSettings } = {};
  private _priceEpochSettings: { [network: string]: PriceEpochSettings } = {};


  constructor(private _http: HttpClient) { }

  public getPriceEpochSettings(network: string): Observable<PriceEpochSettings> {
    return new Observable<PriceEpochSettings>(observer => {
      const dataUrl = `/api/epochs/getPriceEpochSettings/${network}`;
      const headers: HttpHeaders = new HttpHeaders()
        .set("Accept", "application/json")
        .set("Content-type", "application/json");

      if (!this._priceEpochSettings[network]) {
        this._http.get<ActionResult<PriceEpochSettings>>(dataUrl, { headers }).pipe(
          map((res: ActionResult<PriceEpochSettings>) => {
            if (res.status === 'OK') {
              const result = this.plainToClass(PriceEpochSettings, res.result);
              this._priceEpochSettings[network] = result;
              observer.next(result);
              observer.complete();
            } else {
              observer.error(res.message);
            }
          }),
          catchError(error => throwError(error))
        ).subscribe(); // Aggiunta la chiamata a subscribe per innescare l'esecuzione dell'observable
      } else {
        observer.next(this._priceEpochSettings[network]);
        observer.complete();
      }
    });
  }


  public getRewardEpochSettings(network: string): Observable<RewardEpochSettings> {
    return new Observable<RewardEpochSettings>(observer => {


        const dataUrl = `/api/epochs/getRewardEpochSettings/${network}`;
        const headers: HttpHeaders = new HttpHeaders()
          .set("Accept", "application/json")
          .set("Content-type", "application/json");
        if (!this._rewardEpochSettings[network]) {
          this._http.get<ActionResult<RewardEpochSettings>>(dataUrl, { headers }).pipe(
            map((res: ActionResult<RewardEpochSettings>) => {
              if (res.status === 'OK') {
                const result = this.plainToClass(RewardEpochSettings, res.result);
                this._rewardEpochSettings[network] = result;
                observer.next(result);
                observer.complete();
              } else {
                observer.error(res.message);
              }
            }),
            catchError(error => {
              return Utils.handleError(observer, error);
            })
          ).subscribe();
        } else {
          observer.next(this._rewardEpochSettings[network]);
          observer.complete();
        }
    });
  }



  plainToClass<T>(classType: { new(): T }, plainObject: Partial<T>): T {
    const instance = new classType();

    for (const key in plainObject) {
      if (plainObject.hasOwnProperty(key)) {
        instance[key] = plainObject[key];
      }
    }

    return instance;
  }
}

