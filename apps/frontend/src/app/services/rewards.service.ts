import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, concatMap, map, throwError } from 'rxjs';
import { ActionResult, ClaimedRewardStats, NetworkEnum, PaginatedResult, RewardDTO, RewardEpochSettings, RewardResponse } from '../../../../../libs/commons/src';
import { ClaimedRewardsRequest } from '../model/claimed-rewards-request';
import { ProgressResult } from '../model/progress-result';
import { isNotEmpty } from 'class-validator';
import { Utils } from 'app/commons/utils';


@Injectable({
  providedIn: 'root'
})
export class RewardsService {

  constructor(private _http: HttpClient) { }

  public getClaimedRewards(network: string, request: ClaimedRewardsRequest): Observable<PaginatedResult<RewardDTO[]>> {
    const dataUrl = `/api/rewards/getClaimedRewards/${network}?whoClaimed=${isNotEmpty(request.whoClaimed) ? request.whoClaimed : ''}&dataProvider=${isNotEmpty(request.dataProvider) ? request.dataProvider : ''}&sentTo=${isNotEmpty(request.sentTo) ? request.sentTo : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = {
      headers: headers,
    };
    return new Observable<PaginatedResult<RewardDTO[]>>(observer => {
      this._http.get<ActionResult<PaginatedResult<RewardDTO[]>>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<PaginatedResult<RewardDTO[]>>) => {
          if (res.status == 'OK') {
            observer.next(res.result);
            observer.complete();
          } else {
            throw res.message;
          }
        }),
        catchError(error => {
          return Utils.handleError(observer, error);
        })
      ).subscribe();
    });
  }
  public getClaimedRewardsCsv(network: string, request: ClaimedRewardsRequest): Observable<Blob> {
    const dataUrl = `/api/rewards/getClaimedRewards/${network}?whoClaimed=${isNotEmpty(request.whoClaimed) ? request.whoClaimed : ''}&dataProvider=${isNotEmpty(request.dataProvider) ? request.dataProvider : ''}&sentTo=${isNotEmpty(request.sentTo) ? request.sentTo : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
    const headers = new HttpHeaders().set('Accept', 'text/csv');
    const requestOptions = { headers: headers, responseType: 'blob' as 'json' };
    return new Observable<Blob>(observer => {
      this._http.get<Blob>(dataUrl, requestOptions).pipe(
        map((res: Blob) => {
          observer.next(res);
          observer.complete();
        }),
        catchError(error => {
          return Utils.handleError(observer, error);
        })
      ).subscribe();
    });
  }
}

