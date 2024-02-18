import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { ActionResult, DataProviderExtendedInfo, DataProviderInfo } from '../../../../../libs/commons/src';
import { Utils } from '../commons/utils';


@Injectable({
    providedIn: 'root'
})

export class FtsoService {
    private _dataProvidersInfo: { [network: string]: DataProviderInfo[] } = {};

    constructor(private _http: HttpClient) { }


    public getDataProvidersInfo(network: string): Observable<DataProviderInfo[]> {
        return new Observable<DataProviderInfo[]>(observer => {
            const dataUrl = `/api/ftso/getDataProvidersInfo/${network}`;
            const headers: HttpHeaders = new HttpHeaders()
                .set("Accept", "application/json")
                .set("Content-type", "application/json");
            if (!this._dataProvidersInfo[network]) {
                this._http.get<ActionResult<DataProviderInfo[]>>(dataUrl, { headers }).pipe(
                    map((res: ActionResult<DataProviderInfo[]>) => {
                        if (res.status === 'OK') {
                            this._dataProvidersInfo[network] = res.result;
                            observer.next(res.result);
                            observer.complete();
                        } else {
                            observer.error(res.message);
                        }
                    }),
                    catchError(error => {
                        return Utils.handleError(observer, error);
                    })
                ).subscribe(); // Aggiunta la chiamata a subscribe per innescare l'esecuzione dell'observable
            } else {
                observer.next(this._dataProvidersInfo[network]);
                observer.complete();
            }
        });
    }

    public getDataProviderInfoByAddress(network: string, address: string): Observable<DataProviderInfo> {
        return new Observable<DataProviderInfo>(observer => {
            const dataUrl = `/api/ftso/getDataProvidersInfo/${network}`;
            let result: DataProviderInfo = new DataProviderInfo();
            const headers: HttpHeaders = new HttpHeaders()
                .set("Accept", "application/json")
                .set("Content-type", "application/json");
            if (!this._dataProvidersInfo[network]) {
                this._http.get<ActionResult<DataProviderInfo[]>>(dataUrl, { headers }).pipe(
                    map((res: ActionResult<DataProviderInfo[]>) => {
                        if (res.status === 'OK') {
                            this._dataProvidersInfo[network] = res.result;
                            if (this._dataProvidersInfo[network].filter(dpInfo => dpInfo.address.toLowerCase() == address.toLowerCase()).length > 0) {
                                result = this._dataProvidersInfo[network].filter(dpInfo => dpInfo.address.toLowerCase() == address.toLowerCase())[0];
                            } else {
                                result.address = address.toLowerCase();
                                result.name = 'Unknown provider';
                                result.icon = 'assets/images/unknown.png';
                                result.description = null;
                            }
                            observer.next(result);
                            observer.complete();
                        } else {
                            observer.error(res.message);
                        }
                    }),
                    catchError(error => {
                        return Utils.handleError(observer, error);
                    })
                ).subscribe(); // Aggiunta la chiamata a subscribe per innescare l'esecuzione dell'observable
            } else {
                if (this._dataProvidersInfo[network].filter(dpInfo => dpInfo.address.toLowerCase() == address.toLowerCase()).length > 0) {
                    result = this._dataProvidersInfo[network].filter(dpInfo => dpInfo.address.toLowerCase() == address.toLowerCase())[0];
                } else {
                    result.address = address.toLowerCase();
                    result.name = 'Unknown provider';
                    result.icon = 'assets/images/unknown.png';
                    result.description = null;
                }
                observer.next(result);
                observer.complete();
            }
        });
    }



    public getDataProvidersData(network: string, epochId: number): Observable<ActionResult<DataProviderExtendedInfo[]>> {
        const dataUrl = `/api/ftso/getDataProvidersData/${network}?epochId=${epochId}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<ActionResult<DataProviderExtendedInfo[]>>(observer => {
            this._http.get<ActionResult<DataProviderExtendedInfo[]>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<DataProviderExtendedInfo[]>) => {
                    if (res.status === 'OK') {
                        observer.next(res);
                        observer.complete();
                    } else {
                        observer.error(res.message);
                    }
                }),
                catchError(error => {
                    return Utils.handleError(observer, error);
                })
            ).subscribe();
        });
    }
    public getDataProviderDelegationsStatsCsv(network: string, epochId: number): Observable<Blob> {
        const dataUrl = `/api/ftso/getDataProvidersData/${network}?epochId=${epochId}`;
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

