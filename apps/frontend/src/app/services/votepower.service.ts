import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { VotePowerHistoryRequest } from 'app/model/votepower-history-request';
import { isNotEmpty } from 'class-validator';
import { Observable, catchError, map } from 'rxjs';
import { ActionResult, DelegationDTO, PaginatedResult, SortOrderEnum, VotePowerDTO, VotePowerSortEnum } from '../../../../../libs/commons/src';
import { Utils } from '../commons/utils';


@Injectable({
  providedIn: 'root'
})
export class VotePowerService {
  constructor(private _http: HttpClient) { }

  public getVotePower(network: string, epochId: number): Observable<VotePowerDTO> {
    const dataUrl = `api/votepower/getVotePower/${network}?epochId=${epochId}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = { headers: headers };
    return new Observable<VotePowerDTO>(observer => {
      this._http.get<ActionResult<VotePowerDTO>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<VotePowerDTO>) => {
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
      )
    });
  }
  public getDelegatedVotePowerHistory(network: string, request: VotePowerHistoryRequest): Observable<PaginatedResult<VotePowerDTO[]>> {
    const dataUrl = `api/votepower/getDelegatedVotePowerHistory/${network}?address=${isNotEmpty(request.address) ? request.address : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${VotePowerSortEnum[request.sortField]}&sortOrder=${SortOrderEnum[request.sortOrder]}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = { headers: headers };
    return new Observable<PaginatedResult<VotePowerDTO[]>>(observer => {
      this._http.get<ActionResult<PaginatedResult<VotePowerDTO[]>>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<PaginatedResult<VotePowerDTO[]>>) => {
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
      ).subscribe()
    });
  }

  public getDelegatedVotePowerHistoryCsv(network: string, request: VotePowerHistoryRequest): Observable<Blob> {
    const dataUrl = `api/votepower/getDelegatedVotePowerHistory/${network}?address=${isNotEmpty(request.address) ? request.address : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${VotePowerSortEnum[request.sortField]}&sortOrder=${SortOrderEnum[request.sortOrder]}`;
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

  public getTotalVotePowerHistory(network: string, request: VotePowerHistoryRequest): Observable<PaginatedResult<VotePowerDTO[]>> {
    const dataUrl = `api/votepower/getTotalVotePowerHistory/${network}?address=${isNotEmpty(request.address) ? request.address : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${VotePowerSortEnum[request.sortField]}&sortOrder=${SortOrderEnum[request.sortOrder]}`;
    const headers = new HttpHeaders().set('Accept', 'application/json');
    const requestOptions = { headers: headers };
    return new Observable<PaginatedResult<VotePowerDTO[]>>(observer => {
      this._http.get<ActionResult<PaginatedResult<VotePowerDTO[]>>>(dataUrl, requestOptions).pipe(
        map((res: ActionResult<PaginatedResult<VotePowerDTO[]>>) => {
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
      ).subscribe()
    });
  }
}


