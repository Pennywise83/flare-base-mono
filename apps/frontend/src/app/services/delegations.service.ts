import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isNotEmpty } from 'class-validator';
import { Observable, catchError, delay, map } from 'rxjs';
import { ActionResult, DelegationDTO, DelegationsSortEnum, PaginatedResult, SortOrderEnum } from '../../../../../libs/commons/src';
import { Utils } from '../commons/utils';
import { DelegationsRequest } from '../model/delegations-request';
import { DelegatorsRequest } from '../model/delegators-request';


@Injectable({
  providedIn: 'root'
})
export class DelegatotionService {
  constructor(private _http: HttpClient) { }

  public getDelegators(network: string, request: DelegatorsRequest): Observable<PaginatedResult<DelegationDTO[]>> {
    const dataUrl = `/api/delegations/getDelegatorsAt/${network}?address=${request.address}&epochId=${request.epochId}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = { headers: headers };

    return new Observable<PaginatedResult<DelegationDTO[]>>(observer => {
      this._http.get<ActionResult<PaginatedResult<DelegationDTO[]>>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<PaginatedResult<DelegationDTO[]>>) => {
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


  public getDelegations(network: string, request: DelegationsRequest): Observable<PaginatedResult<DelegationDTO[]>> {
    const dataUrl = `/api/delegations/getDelegations/${network}?from=${isNotEmpty(request.from) ? request.from : ''}&to=${isNotEmpty(request.to) ? request.to : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${DelegationsSortEnum[request.sortField]}&sortOrder=${SortOrderEnum[request.sortOrder]}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = { headers: headers };

    return new Observable<PaginatedResult<DelegationDTO[]>>(observer => {
      this._http.get<ActionResult<PaginatedResult<DelegationDTO[]>>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<PaginatedResult<DelegationDTO[]>>) => {
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

  public getDelegationsCsv(network: string, request: DelegationsRequest): Observable<Blob> {
    const dataUrl = `/api/delegations/getDelegations/${network}?from=${isNotEmpty(request.from) ? request.from : ''}&to=${isNotEmpty(request.to) ? request.to : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${DelegationsSortEnum[request.sortField]}&sortOrder=${SortOrderEnum[request.sortOrder]}`;
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


