import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FeedsRequest, FinalizedPricesFeedsRequest, RevealedPricesFeedsRequest, RewardsDistributedRequest } from 'app/model/feeds-request';
import { RewardsHistoryRequest } from 'app/model/rewards-history-request';
import { DataProviderRewardStatsDTO } from 'app/modules/data-providers-explorer/rewards-history/model/data-provider-reward-stats-dto';
import { plainToClass } from 'class-transformer';
import { isDefined, isNotEmpty } from 'class-validator';
import { Observable, catchError, map } from 'rxjs';
import { ActionResult, DataProviderExtendedInfo, DataProviderInfo, DataProviderRewardStats, HashSubmitted, HashSubmittedMatrix, PaginatedResult, PriceFinalized, PriceFinalizedMatrix, PriceRevealed, PriceRevealedMatrix, RealTimeFtsoData, RewardDistributed, RewardDistributedMatrix, RewardEpochSettings } from '../../../../../libs/commons/src';
import { DataProviderSubmissionStats } from '../../../../../libs/commons/src/model/ftso/data-provider-submission-stats';
import { Utils } from '../commons/utils';
import { PriceDataEpochRequest } from 'app/model/price-data-epoch-request';


@Injectable({
    providedIn: 'root'
})

export class FtsoService {
    private _dataProvidersInfo: { [network: string]: DataProviderInfo[] } = {};
    private _dataProvidersInfoByRewardEpoch: { [network: string]: { [rewardEpochId: number]: DataProviderInfo[] } } = {};
    constructor(private _http: HttpClient) { }


    public getDataProvidersInfo(network: string, rewardEpochId?: number): Observable<DataProviderInfo[]> {
        return new Observable<DataProviderInfo[]>(observer => {
            let dataUrl: string;
            if (isDefined(rewardEpochId)) {
                dataUrl = `/api/ftso/getDataProvidersInfo/${network}?epochId=${isDefined(rewardEpochId) ? rewardEpochId : ''}`;
            } else {
                dataUrl = `/api/ftso/getDataProvidersInfo/${network}`;
            }
            const headers: HttpHeaders = new HttpHeaders()
                .set("Accept", "application/json")
                .set("Content-type", "application/json");
            if (isDefined(rewardEpochId)) {
                if (!this._dataProvidersInfoByRewardEpoch[network] || (this._dataProvidersInfoByRewardEpoch[network] && !this._dataProvidersInfoByRewardEpoch[network][rewardEpochId])) {
                    this._http.get<ActionResult<DataProviderInfo[]>>(dataUrl, { headers }).pipe(
                        map((res: ActionResult<DataProviderInfo[]>) => {
                            if (res.status === 'OK') {
                                if (!this._dataProvidersInfoByRewardEpoch[network]) { this._dataProvidersInfoByRewardEpoch[network] = {} }
                                if (!this._dataProvidersInfoByRewardEpoch[network][rewardEpochId]) { this._dataProvidersInfoByRewardEpoch[network][rewardEpochId] = [] };
                                this._dataProvidersInfoByRewardEpoch[network][rewardEpochId] = res.result;
                                observer.next(res.result);
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
                    observer.next(this._dataProvidersInfoByRewardEpoch[network][rewardEpochId]);
                    observer.complete();
                }
            } else {
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
    public getRevealedPrices(network: string, request: RevealedPricesFeedsRequest): Observable<PaginatedResult<PriceRevealed[]>> {
        const dataUrl = `/api/ftso/getRevealedPrices/${network}?dataProvider=${isNotEmpty(request.address) ? request.addressList.join(',') : ''}&symbol=${isNotEmpty(request.symbol) ? request.symbol : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<PriceRevealed[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<PriceRevealedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<PriceRevealedMatrix>>) => {
                    if (res.status === 'OK') {
                        const pricesRevealed: PriceRevealed[] = new PriceRevealedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<PriceRevealed[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, pricesRevealed);
                        observer.next(ar.result);
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
    public getRevealedPricesByEpochId(network: string, request: PriceDataEpochRequest): Observable<PaginatedResult<PriceRevealed[]>> {
        const dataUrl = `/api/ftso/getRevealedPricesByEpochId/${network}?epochId=${isNotEmpty(request.epochId) ? request.epochId : ''}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<PriceRevealed[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<PriceRevealedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<PriceRevealedMatrix>>) => {
                    if (res.status === 'OK') {
                        const pricesRevealed: PriceRevealed[] = new PriceRevealedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<PriceRevealed[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, pricesRevealed);
                        observer.next(ar.result);
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
    public getFinalizedPrices(network: string, request: FinalizedPricesFeedsRequest): Observable<PaginatedResult<PriceFinalized[]>> {
        const dataUrl = `/api/ftso/getFinalizedPrices/${network}?symbol=${isNotEmpty(request.symbol) ? request.symbol : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<PriceFinalized[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<PriceFinalizedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<PriceFinalizedMatrix>>) => {
                    if (res.status === 'OK') {
                        const pricesRevealed: PriceFinalized[] = new PriceFinalizedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<PriceFinalized[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, pricesRevealed);
                        observer.next(ar.result);
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

    public getFinalizedPricesByEpochId(network: string, request: PriceDataEpochRequest): Observable<PaginatedResult<PriceFinalized[]>> {
        const dataUrl = `/api/ftso/getFinalizedPricesByEpochId/${network}?epochId=${isNotEmpty(request.epochId) ? request.epochId : ''}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<PriceFinalized[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<PriceFinalizedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<PriceFinalizedMatrix>>) => {
                    if (res.status === 'OK') {
                        const pricesRevealed: PriceFinalized[] = new PriceFinalizedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<PriceFinalized[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, pricesRevealed);
                        observer.next(ar.result);
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
    public getSubmittedHashesByEpochId(network: string, request: PriceDataEpochRequest): Observable<PaginatedResult<HashSubmitted[]>> {
        const dataUrl = `/api/ftso/getSubmittedHashesByEpochId/${network}?epochId=${isNotEmpty(request.epochId) ? request.epochId : ''}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<HashSubmitted[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<HashSubmittedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<HashSubmittedMatrix>>) => {
                    if (res.status === 'OK') {
                        const pricesRevealed: HashSubmitted[] = new HashSubmittedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<HashSubmitted[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, pricesRevealed);
                        observer.next(ar.result);
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
    public getDataProviderSubmissionStats(network: string, request: FeedsRequest): Observable<DataProviderSubmissionStats[]> {
        const dataUrl = `/api/ftso/getDataProviderSubmissionStats/${network}?dataProvider=${isNotEmpty(request.address) ? request.addressList.join(',') : ''}&symbol=${isNotEmpty(request.symbol) ? request.symbol : ''}&startTime=${request.startTime}&endTime=${request.endTime}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<DataProviderSubmissionStats[]>(observer => {
            this._http.get<ActionResult<DataProviderSubmissionStats[]>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<DataProviderSubmissionStats[]>) => {
                    if (res.status === 'OK') {
                        let results: DataProviderSubmissionStats[] = [];
                        res.result.forEach(submissionStat => {
                            results.push(plainToClass(DataProviderSubmissionStats, submissionStat));
                        });
                        res.result = results;
                        observer.next(res.result);
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
    public getDataProviderSubmissionsStatsByRewardEpoch(network: string, request: FeedsRequest, rewardEpochId: number): Observable<DataProviderSubmissionStats[]> {
        const dataUrl = `/api/ftso/getDataProviderSubmissionsStatsByRewardEpoch/${network}?dataProvider=${isNotEmpty(request.address) ? request.addressList.join(',') : ''}&symbol=${isNotEmpty(request.symbol) ? request.symbol : ''}&epochId=${rewardEpochId}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<DataProviderSubmissionStats[]>(observer => {
            this._http.get<ActionResult<DataProviderSubmissionStats[]>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<DataProviderSubmissionStats[]>) => {
                    if (res.status === 'OK') {
                        observer.next(res.result);
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
    public getDataProviderRewardStatsHistory(network: string, rewardEpochSettings: RewardEpochSettings, request: RewardsHistoryRequest): Observable<PaginatedResult<DataProviderRewardStatsDTO[]>> {
        const dataUrl = `/api/ftso/getDataProviderRewardStatsHistory/${network}?dataProvider=${isNotEmpty(request.address) ? request.address : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<DataProviderRewardStatsDTO[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<DataProviderRewardStats[]>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<DataProviderRewardStats[]>>) => {
                    if (res.status === 'OK') {
                        let resultsDto: DataProviderRewardStatsDTO[] = [];
                        let ar: ActionResult<PaginatedResult<DataProviderRewardStatsDTO[]>> = new ActionResult();
                        res.result.results.forEach(singleResult => {
                            resultsDto.push(new DataProviderRewardStatsDTO(singleResult, rewardEpochSettings));
                        })
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, resultsDto);
                        observer.next(ar.result);
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
    public getDataProviderRewardStats(network: string, request: FeedsRequest): Observable<DataProviderRewardStats[]> {
        const dataUrl = `/api/ftso/getDataProviderRewardStats/${network}?dataProvider=${isNotEmpty(request.address) ? request.addressList.join(',') : ''}&startTime=${request.startTime}&endTime=${request.endTime}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<DataProviderRewardStats[]>(observer => {
            this._http.get<ActionResult<DataProviderRewardStats[]>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<DataProviderRewardStats[]>) => {
                    if (res.status === 'OK') {
                        observer.next(res.result);
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
    public getDataProviderRewardsDistributed(network: string, request: RewardsDistributedRequest): Observable<PaginatedResult<RewardDistributed[]>> {
        const dataUrl = `/api/ftso/getRewardsDistributed/${network}?dataProvider=${isNotEmpty(request.address) ? request.addressList.join(',') : ''}&symbol=${isNotEmpty(request.symbol) ? request.symbol : ''}&startTime=${request.startTime}&endTime=${request.endTime}&page=${request.page}&pageSize=${request.pageSize}&sortField=${request.sortField}&sortOrder=${request.sortOrder}`;
        const headers = new HttpHeaders().set('Accept', 'application/vnd.flare.base+json');
        const requestOptions = { headers: headers };
        return new Observable<PaginatedResult<RewardDistributed[]>>(observer => {
            this._http.get<ActionResult<PaginatedResult<RewardDistributedMatrix>>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<PaginatedResult<RewardDistributedMatrix>>) => {
                    if (res.status === 'OK') {
                        const rewardsDistributed: RewardDistributed[] = new RewardDistributedMatrix().toObject(res.result.results);
                        let ar = new ActionResult<PaginatedResult<RewardDistributed[]>>();
                        ar.result = new PaginatedResult(res.result.page, res.result.pageSize, res.result.sortField, res.result.sortOrder, res.result.numResults, rewardsDistributed);
                        observer.next(ar.result);
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
    public getAvailableSymbols(network: string, request: FeedsRequest): Observable<string[]> {
        const dataUrl = `/api/ftso/getAvailableSymbols/${network}?startTime=${request.startTime}&endTime=${request.endTime}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<string[]>(observer => {
            this._http.get<ActionResult<string[]>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<string[]>) => {
                    if (res.status === 'OK') {
                        observer.next(res.result);
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

    public getRealTimeFtsoData(network: string): Observable<RealTimeFtsoData> {
        const dataUrl = `/api/ftso/getRealTimeFtsoData/${network}`;
        const headers = new HttpHeaders().set('Accept', 'application/json');
        const requestOptions = { headers: headers };
        return new Observable<RealTimeFtsoData>(observer => {
            this._http.get<ActionResult<RealTimeFtsoData>>(dataUrl, requestOptions).pipe(
                map((res: ActionResult<RealTimeFtsoData>) => {
                    if (res.status === 'OK') {
                        observer.next(res.result);
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
}

