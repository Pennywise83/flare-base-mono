import { Client } from "@elastic/elasticsearch";
import { Balance, BalanceSortEnum, ClaimedRewardDateHistogramElement, ClaimedRewardsSortEnum, Commons, DataProviderInfo, Delegation, DelegationSnapshot, DelegationsSortEnum, PaginatedResult, PriceEpoch, PriceEpochSettings, Reward, RewardEpoch, RewardEpochSettings, VotePower, VoterWhitelist, WrappedBalance } from "@flare-base/commons";
import { Process } from '@nestjs/bull';
import { Logger } from "@nestjs/common";
import { PersistenceDaoConfig } from "apps/backend/src/model/app-config/persistence-dao-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { Job, Queue } from 'bull';
import { plainToClass } from "class-transformer";
import { isEmpty, isNotEmpty } from "class-validator";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { interval } from "rxjs";
import { ICacheDao } from "../../cache/i-cache-dao.service";
import { IPersistenceDao } from "../i-persistence-dao.service";
import { EpochStats } from "./model/epoch-stats";
import { PersistenceConstants } from "./model/persistence-constants";
import { PersistenceMetadata, PersistenceMetadataType } from "./model/persistence-metadata";

export abstract class PersistenceDaoImpl implements IPersistenceDao {

    logger: Logger;
    _persistenceDaoQueue: Queue;
    _cacheDao: ICacheDao;
    status: ServiceStatusEnum;
    config: PersistenceDaoConfig;
    elasticsearchClient: Client;
    indicesMapping: { [indexName: string]: any } = {};
    indicesList: { [indexType: string]: Array<string> } = {};
    rewardEpochSettings: RewardEpochSettings;
    priceEpochSettings: PriceEpochSettings;
    abstract _network: string;

    abstract getIndex(indexType: string): string;

    abstract initializeIndicesMappings(): void;

    private maxResultsLimit: number;




    initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let members: Array<string> = this.config.members;
            members = [...new Set(members)];
            this.logger.log(`Inititializing ElasticSearch client: ${members}`);
            this.elasticsearchClient = new Client({ node: members });
            this.elasticsearchClient.nodes.info().then(res => {
                this.logger.log(`All Persistence DAO members are available`);
                this.initializeIndicesMappings();
                this._initializeIndices().then(async () => {
                    await this._getIndicesList();
                    this.maxResultsLimit = await this.getResultsLimit();
                    this.status = ServiceStatusEnum.STARTED;
                    await this.persistenceMetadataCleaner();
                    this._startPersistenceMetadataCleaner();
                    resolve();
                });
            }).catch(err => {
                this.status = ServiceStatusEnum.STOPPED;
                reject(new Error(`Unable to initialize ElasticSearch clients: ${err.message}`));
            });
        });
    }


    private _startPersistenceMetadataCleaner(): void {
        interval(this.config.persistenceMetadataCleanTimeMinutes * 60 * 1000).subscribe(async () => {
            await this.persistenceMetadataCleaner();
        });
    }
    private async persistenceMetadataCleaner(): Promise<void> {
        try {
            let index: string = this.getIndex(PersistenceConstants.METADATA_INDEX);
            this.logger.log(`Optimizing persistence metadata...`);
            for (let i in PersistenceMetadataType) {
                if (PersistenceMetadataType[i] != PersistenceMetadataType.DelegationSnapshot) {
                    const persistenceMetadata: PersistenceMetadata[] = await this.getPersistenceMetadata(PersistenceMetadataType[i], 'all', 0, null);
                    await this.optimizePersistenceMetadata(PersistenceMetadataType[i], persistenceMetadata);
                }
            }
            this.logger.log(`Cleaning persistence metadata...`);
            for (let i in PersistenceMetadataType) {
                if (isNotEmpty(index)) {
                    const deleted: number = await this._deleteByQuery(index, `type: ${i} AND delete:true`);
                    if (deleted > 0) {
                        this.logger.log(`Deleted ${deleted} ${i} persistence metadata elements`);
                    }
                }
            }
        } catch (err) {
            this.logger.error(`Error cleaning persistence metadata index:`, err.message);
        }
    }
    async truncate(): Promise<boolean> {
        try {
            const response = await this.elasticsearchClient.indices.delete({
                index: '*' + this.config.prefix + '*',
            });
            await this._initializeIndices();
            return true;
        } catch (e) {
            await this._initializeIndices();
            return true;
        }
    }
    private _initializeIndices(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let calls: Array<Promise<boolean>> = [];
            Object.keys(this.indicesMapping).map((indexPrefix, idx) => {
                calls.push(this._indexExists(`${indexPrefix}_*`));
            });
            try {
                Promise.all(calls).then(indexExistsResponses => {
                    let createCalls: Array<Promise<string>> = [];
                    indexExistsResponses.map((indexExists, idx) => {
                        if (!indexExists) {
                            let indexPrefix: string = Object.keys(this.indicesMapping)[idx];
                            let indexMapping: any = this.indicesMapping[indexPrefix];
                            let indexName: string = `${indexPrefix}_${new Date().getTime()}`;
                            createCalls.push(this._createIndex(indexName, indexMapping));
                        }
                    });
                    if (createCalls.length > 0) {
                        Promise.all(createCalls).then(createResponses => {
                            resolve();
                        }).catch(createErr => {
                            reject(new Error(`Unable to create Persistence index: ${createErr.message}`));
                        })
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(new Error(`Unable to initialize Persistence indices: ${err.message}`));
            }
        });

    }
    private async _indexExists(indexName: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const { body: indexList } = await this.elasticsearchClient.cat.indices({ index: indexName, format: 'json' });
                resolve(Array.isArray(indexList) && indexList.length > 0)
            } catch (err) {
                if (isNotEmpty(err.body.error.type)) {
                    resolve(false);
                } else {
                    this.logger.error(`Error while checking if index ${indexName} exists:`, err.message);
                    reject(`Error while checking if index ${indexName} exists:${err.message}`);
                }

            }
        });
    }
    private async getResultsLimit(): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                const { body } = await this.elasticsearchClient.cluster.getSettings();
                if (body && body.defaults && body.defaults.index && body.defaults.index.max_result_window) {
                    resolve(body.defaults.index.max_result_window);
                } else {
                    resolve(10000);
                }
            } catch (error) {
                this.logger.error(`Error while checking cluster results limit:`, error.message);
                reject(`Error while checking cluster results limit: ${error.message}`);
            }
        });
    }
    private async _createIndex(indexName: string, indexMapping: any): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                this.logger.log(`IndexRollManager - Creating '${indexName}' index...`);
                let parsedBody = {
                    settings: {
                        number_of_shards: this.config.shard,
                        number_of_replicas: this.config.replica
                    },
                    mappings: indexMapping
                };
                let res = await this.elasticsearchClient.indices.create({
                    index: indexName,
                    body: parsedBody
                });
                this.logger.log(`IndexRollManager - Elasticsearch index '${indexName}' succesfully created.`);
                resolve(indexName);
            } catch (createErr) {
                if (JSON.stringify(createErr).indexOf('already exists') >= 0) {
                    this.logger.log(`IndexRollManager - Index '${indexName}' already exists.`);
                    resolve(indexName);
                } else {
                    this.logger.error(`IndexRollManager - Unable to create Elasticsearch index '${indexName}'`, createErr.message);
                    reject(new Error(createErr.message));
                }
            }
        });
    }
    private async _getIndicesList(): Promise<void> {
        this.logger.log(`Getting indices list...`);
        let listIndicesCalls: Array<Promise<Array<string>>> = [];
        Object.keys(this.indicesMapping).map(indexPrefix => {
            listIndicesCalls.push(this._listIndices(indexPrefix));
        });
        Promise.all(listIndicesCalls).then((listIndicesResponses) => {
            listIndicesResponses.map((indicesList, idx) => {
                this.indicesList[Object.keys(this.indicesMapping)[idx]] = indicesList;
            });
        }).then(() => {
            return;
        });
    }
    private async _listIndices(prefix: string): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            try {
                const response = await this.elasticsearchClient.cat.indices({ index: `${prefix}_*`, format: 'json' });
                const indices = response.body.map((indexInfo: any) => indexInfo.index);
                indices.sort((a, b) => {
                    const timestampA = parseInt(a.substring(prefix.length + 1));
                    const timestampB = parseInt(b.substring(prefix.length + 1));
                    return timestampB - timestampA;
                });
                resolve(indices);
            } catch (err) {
                this.logger.error(`IndexRollManager - Unable to list indices by prefix '${prefix}'`, err.message);
                reject(new Error(err.message));
            }
        })
    }
    async getIndexDocumentCount(indexName: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                const response = await this.elasticsearchClient.count({ index: indexName });
                resolve(response.body.count)
            } catch (err) {
                this.logger.error(`IndexRollManager - Unable to count documents on index '${indexName}'`, err.message);
                reject(new Error(err.message));
            }
        })
    }
    private async _bulkLoad<T>(dataset: Array<T>, indexName: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let start: number = new Date().getTime();
            this.logger.verbose(`Indexing ${dataset.length} elements into ${indexName} index...`);
            if (dataset.length > 0) {
                const chunks: Array<Array<T>> = Commons.chunkIt<T>(dataset, 10000);
                let failedCount: number = 0;
                let successCount: number = 0;

                for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                    const chunk = chunks[chunkIdx];
                    let objs = {};
                    let objs2 = [];
                    const body = chunk.flatMap(doc => {
                        const objId = Commons.sha256Hash((doc as any).objId.toString());
                        objs2.push(objId);
                        objs[objId] = objId;
                        delete (doc as any).objId;
                        return [{ index: { _index: indexName, _id: objId } }, doc];
                    });
                    try {
                        const res = await this.elasticsearchClient.bulk({ refresh: chunkIdx < (chunks.length - 1) ? false : 'wait_for', body });

                        if (res.body.errors) {
                            res.body.items.forEach(singleItem => {
                                if (typeof singleItem.index.error !== 'undefined' && singleItem.index.error !== null) {
                                    failedCount++;
                                } else {
                                    successCount++;
                                }
                            });
                        } else {
                            res.body.items.forEach(singleItem => {
                                if (typeof singleItem.index.error === 'undefined' || singleItem.index.error === null) {
                                    successCount++;
                                } else {
                                    failedCount++;
                                }
                            });
                        }
                    } catch (err) {
                        this.logger.error(`Error loading elements into ${indexName} index: ` + err);
                        reject(new Error(`Error loading elements into ${indexName} index: ` + err));
                        return;
                    }
                }

                this.logger.verbose(`Indexed ${successCount}/${dataset.length} elements (${parseFloat(((successCount * 100) / (dataset.length)).toString()).toFixed(1)}%). Failed: ${failedCount}/${dataset.length} (${parseFloat(((failedCount * 100) / (dataset.length)).toString()).toFixed(1)}%) - Duration: ${(new Date().getTime() - start) / 1000}s`);
                resolve(successCount);
            } else {
                resolve(0);
            }
        });
    }

    private async _countDocuments(indexName: string, query: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.elasticsearchClient.count({
                index: indexName,
                body: `{"query":{"query_string":{"query":"${query}"}}}`,
            }).then(response => {
                if (response && response.body && response.body.count) {
                    const documentCount = response.body.count;
                    resolve(documentCount);
                } else {
                    resolve(0);
                }
            }).catch(err => {
                reject(new Error(`Count error: ` + err.message));
            });
        });
    }
    private _search<T>(indexName: string, query: string, size: number, sort?: any): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            this.elasticsearchClient.search({
                index: indexName,
                size: size,
                body: `{"query":{"query_string":{"query":"${query}"}}}`,
                sort: (sort ? sort : [])

            }).then(response => {
                let result: any[] = [];
                if (response && response.body && response.body.hits && response.body.hits.hits) {
                    response.body.hits.hits.forEach(hit => {
                        result.push(hit._source);
                    });
                }
                result.map(r => delete r.objId);
                resolve(result);
            }).catch(err => {
                reject(new Error(`Search error: ` + err.message))
            });
        });
    }
    private _paginatedSearch<T>(index: string, queryString: string, page: number, pageSize: number, sort?: any): Promise<PaginatedResult<T[]>> {
        return new Promise<PaginatedResult<T[]>>(async (resolve, reject) => {
            let pResult: PaginatedResult<T[]> = new PaginatedResult(page, pageSize, null, null, 0, []);
            const from = (page - 1) * pageSize;
            if (page * pageSize > this.maxResultsLimit) {
                const count: number = await this._countDocuments(index, queryString);
                if (page * pageSize <= count) {
                    const job = await this._persistenceDaoQueue.add('fullScanProcessor', { index, queryString });
                    const results: T[] = await job.finished() as T[];
                    resolve(Commons.parsePaginatedResults(results, page, pageSize, (isNotEmpty(sort) ? sort.split(':')[0] : null), (isNotEmpty(sort) ? sort.split(':')[1] : null)));
                } else {
                    pResult.numResults = count;
                    resolve(pResult);
                }
            } else {
                this.elasticsearchClient.search({
                    index: index,
                    size: pageSize,
                    from: from,
                    body: `{"query":{"query_string":{"query":"${queryString}"}}}`,
                    sort: (sort ? sort : [])

                }).then(async response => {
                    let result: any[] = [];
                    if (response && response.body && response.body.hits && response.body.hits.hits) {
                        response.body.hits.hits.forEach(hit => {
                            result.push(hit._source);
                        });
                    }
                    if (response && response.body && response.body.hits && response.body.hits.total) {
                        if (response.body.hits.total.value > this.maxResultsLimit) {
                            pResult.numResults = await this._countDocuments(index, queryString);
                        } else {
                            pResult.numResults = response.body.hits.total.value;
                        }
                    }
                    result.map(r => delete r.objId);
                    if (pResult.numResults == this.maxResultsLimit) {
                        const { body } = await this.elasticsearchClient.count({
                            index: index,
                            body: `{"query":{"query_string":{"query":"${queryString}"}}}`,
                        });
                        pResult.numResults = body.count;

                    }
                    pResult.results = result;
                    resolve(pResult);
                }).catch(err => {
                    reject(new Error(`Search error: ` + err.message))
                });
            }

        });
    }

    private async _fullScan<T>(indexName: string, query: string, sort?: any): Promise<T[]> {
        return new Promise<Array<T>>(async (resolve, reject) => {
            const cacheData: T[] = await this._cacheDao.getFullScanCache(indexName, query);
            if (isNotEmpty(cacheData)) {
                resolve(cacheData);
                return;
            }


            this.elasticsearchClient.search({
                index: indexName,
                scroll: '10s', // Imposta la scorrimento per ottenere tutti i risultati
                body: `{"query":{"query_string":{"query":"${query}"}}}`,
                sort: (sort ? sort : []),
                size: this.maxResultsLimit
            }).then(async (response) => {
                let result: Array<any> = [];
                const scrollId = response.body._scroll_id;
                while (true) {
                    if (response && response.body && response.body.hits && response.body.hits.hits) {
                        response.body.hits.hits.forEach((hit) => {
                            result.push(hit._source);
                        });
                    }
                    const scrollResponse = await this.elasticsearchClient.scroll({
                        scroll_id: scrollId,
                        scroll: '10s',
                    });
                    if (scrollResponse.body.hits.hits.length === 0) {
                        await this.elasticsearchClient.clearScroll({
                            scroll_id: scrollId // Passa lo scrollId per rimuovere lo scroll corrispondente
                        });
                        break;
                    }
                    response = scrollResponse;
                }
                result.map((r) => delete r.objId);
                await this._cacheDao.setFullScanCache(indexName, query, result, new Date().getTime() + (60 * 10 * 1000));
                resolve(result);
            }).catch((err) => {
                reject(new Error(`Search error: ` + err.message));
            });
        });
    }
    private _get<T>(indexName: string, id: string): Promise<T> {
        return new Promise<any>((resolve, reject) => {
            this.elasticsearchClient.get({
                index: indexName,
                id: Commons.sha256Hash(id.toString()),
                _source: 'true'
            }).then(response => {
                let result: Array<any> = [];
                resolve(response.body._source)
            }).catch(err => {
                if (err.statusCode == 404) {
                    resolve(null);
                } else {
                    reject(new Error(`Get error: ` + err.message))
                }
            });
        });
    }
    private _deleteByQuery(indexName: string, query: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.elasticsearchClient.deleteByQuery({
                index: indexName,
                refresh: true,
                body: {
                    query: {
                        query_string: {
                            query: query,
                        },
                    },
                },
            }).then(response => {
                if (response && response.body) {
                    const deletedCount = response.body.deleted;
                    resolve(deletedCount);
                } else {
                    reject(new Error(`Delete by query failed: No response body`));
                }
            }).catch(err => {
                if (err.message.indexOf('version conflict') > 0) {
                    this.logger.warn(`Error while deleting data: version conflict`);
                    resolve(0);
                    return;
                } else {
                    reject(new Error(`Error while deleting data: ${err.message}`));
                    return;
                }
            });
        });
    }
    private _getBuckets = (aggregation: any) => aggregation?.buckets || [];



    private _getSource = (hit: any) => hit?._source;

    getCurrentRewardEpoch(): Promise<RewardEpoch> {
        return new Promise<RewardEpoch>(async (resolve, reject) => {
            let queryString: string = `*`;
            let result: RewardEpoch[] = await this._search<RewardEpoch>(this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX), queryString, 1, 'id:desc');
            if (result.length > 0) {
                resolve(result[0]);
            } else {
                resolve(null);
            }
        });
    }


    getRewardEpochs(startEpoch: number, endEpoch: number, page: number, pageSize: number, sortField: EpochSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<RewardEpoch[]>> {
        return new Promise<PaginatedResult<RewardEpoch[]>>(async (resolve, reject) => {
            const sortClause = `${sortField}:${sortOrder}`;
            const queryString: string = `id: [${startEpoch} TO ${endEpoch}]`;
            const results: PaginatedResult<RewardEpoch[]> = await this._paginatedSearch<RewardEpoch>(this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX), queryString, page, pageSize, sortClause);
            resolve(results);
        });
    }

    storeRewardEpochs(blockchainData: RewardEpoch[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(rewardEpoch => {
                (rewardEpoch as any).objId = rewardEpoch.id;
            });
            let storedObjectCount: number = await this._bulkLoad<RewardEpoch>(blockchainData, this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX));
            resolve(storedObjectCount);
        });
    }

    getPriceEpochs(startEpoch: number, endEpoch: number, page: number, pageSize: number, sortField: EpochSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<PriceEpoch[]>> {
        return new Promise<PaginatedResult<PriceEpoch[]>>(async (resolve, reject) => {
            const sortClause = `${sortField}:${sortOrder}`;
            const queryString: string = `id: [${startEpoch} TO ${endEpoch}]`;
            const results: PaginatedResult<PriceEpoch[]> = await this._paginatedSearch<PriceEpoch>(this.getIndex(PersistenceConstants.PRICE_EPOCHS_INDEX), queryString, page, pageSize, sortClause);
            resolve(results);
        });
    }
    storePriceEpoch(blockchainData: PriceEpoch[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(priceEpoch => {
                (priceEpoch as any).objId = priceEpoch.id;
            });

            let storedObjectCount: number = await this._bulkLoad<PriceEpoch>(blockchainData, this.getIndex(PersistenceConstants.PRICE_EPOCHS_INDEX));
            resolve(storedObjectCount);
        });
    }




    storeRewardEpochSettings(blockchainData: RewardEpochSettings): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let obj: RewardEpochSettings = Commons.clone(blockchainData);
            (obj as any).objId = 'RewardEpochSettings';
            let storedObjectCount: number = await this._bulkLoad<RewardEpochSettings>([obj], this.getIndex(PersistenceConstants.CONSTANTS_INDEX));
            resolve(storedObjectCount);
        });
    }
    getRewardEpochSettings(): Promise<RewardEpochSettings> {
        return new Promise<RewardEpochSettings>(async (resolve, reject) => {
            if (isEmpty(this.rewardEpochSettings)) {
                let result: RewardEpochSettings = await this._get<RewardEpochSettings>(this.getIndex(PersistenceConstants.CONSTANTS_INDEX), 'RewardEpochSettings');
                if (isNotEmpty(result)) {
                    this.rewardEpochSettings = plainToClass(RewardEpochSettings, result);
                    resolve(this.rewardEpochSettings);
                } else {
                    resolve(null);
                }

            } else {
                resolve(this.rewardEpochSettings);
            }
        });
    }
    getRewardEpochStats(startEpochId: number, endEpochId: number): Promise<EpochStats> {
        return new Promise<EpochStats>(async (resolve, reject) => {
            resolve(await this.getEpochStats(startEpochId, endEpochId, this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX)));
        });
    }

    storePriceEpochSettings(blockchainData: PriceEpochSettings): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let obj: PriceEpochSettings = Commons.clone(blockchainData);
            (obj as any).objId = 'PriceEpochSettings';
            let storedObjectCount: number = await this._bulkLoad<PriceEpochSettings>([obj], this.getIndex(PersistenceConstants.CONSTANTS_INDEX));
            resolve(storedObjectCount);
        });
    }
    getPriceEpochSettings(): Promise<PriceEpochSettings> {
        return new Promise<PriceEpochSettings>(async (resolve, reject) => {
            if (isEmpty(this.priceEpochSettings)) {
                let result: PriceEpochSettings = await this._get<PriceEpochSettings>(this.getIndex(PersistenceConstants.CONSTANTS_INDEX), 'PriceEpochSettings');
                if (isNotEmpty(result)) {
                    this.priceEpochSettings = plainToClass(PriceEpochSettings, result);
                    resolve(this.priceEpochSettings);
                } else {
                    resolve(null);
                }
            } else {
                resolve(this.priceEpochSettings);
            }
        });
    }
    getPriceEpochStats(startEpochId: number, endEpochId: number): Promise<EpochStats> {
        return new Promise<EpochStats>(async (resolve, reject) => {
            resolve(await this.getEpochStats(startEpochId, endEpochId, this.getIndex(PersistenceConstants.PRICE_EPOCHS_INDEX)));
        });
    }

    private getEpochStats(startEpochId: number, endEpochId: number, index: string): Promise<EpochStats> {
        return new Promise<EpochStats>((resolve, reject) => {
            const body: any = {
                "size": 0,
                "query": {
                    "query_string": {
                        "query": "id: [ " + startEpochId + " TO " + endEpochId + "]"
                    }
                },
                "aggs": {
                    "idStats": {
                        "stats": {
                            "field": "id"
                        }
                    },
                    "blockNumberStats": {
                        "stats": {
                            "field": "blockNumber"
                        }
                    }
                }
            }
            this.elasticsearchClient.search({ index: index, body: body }).then(response => {
                let tmpObj: EpochStats = new EpochStats();
                if (response.body?.aggregations?.idStats) {
                    tmpObj.count = response.body?.aggregations?.idStats?.count!;
                    tmpObj.minEpochId = response.body?.aggregations?.idStats?.min != null ? response.body?.aggregations?.idStats?.min : 0;
                    tmpObj.maxEpochId = response.body?.aggregations?.idStats.max;
                }

                if (response.body?.aggregations?.blockNumberStats) {
                    tmpObj.minBlockNumber = response.body?.aggregations?.blockNumberStats.min;
                    tmpObj.maxBlockNumber = response.body?.aggregations?.blockNumberStats.max;
                }
                resolve(tmpObj);
            }).catch(err => {
                reject(new Error(`getEpochStats error: ` + err.message))
            });
        });
    }


    getPersistenceMetadata(type: PersistenceMetadataType, value: string, from: number, to: number, filter?: string): Promise<PersistenceMetadata[]> {
        return new Promise<PersistenceMetadata[]>(async (resolve, reject) => {
            let parsedValue: string = isNotEmpty(value) ? value.toLowerCase() : 'all';
            const body: any = {
                "size": 0,
                "query": {
                    "query_string": {
                        "query": "type: " + type + " AND (value:" + parsedValue + " OR value: all) AND from:[* TO " + ((isNotEmpty(to) ? to : '*')) + "] AND to:[" + (isNotEmpty(from) ? from : '*') + " TO *] " + (isNotEmpty(filter) ? ' AND filter: ' + filter : '')
                    }
                },
                "aggs": {
                    "persistence_metadata": {
                        "multi_terms": {
                            "size": this.maxResultsLimit,
                            "terms": [
                                {
                                    "field": "from"
                                },
                                {
                                    "field": "to"
                                },
                                {
                                    "field": "value"
                                }
                            ]
                        }
                    }
                }
            }
            let results: PersistenceMetadata[] = [];
            this.elasticsearchClient.search({ index: this.getIndex(PersistenceConstants.METADATA_INDEX), body: body }).then(response => {
                this._getBuckets(response.body?.aggregations?.persistence_metadata)
                    .flatMap(persistenceMetadataBucket => {
                        let persistenceMetadata: PersistenceMetadata = new PersistenceMetadata();
                        persistenceMetadata.from = persistenceMetadataBucket?.key[0];
                        persistenceMetadata.to = persistenceMetadataBucket?.key[1];
                        persistenceMetadata.value = persistenceMetadataBucket?.key[2];
                        results.push(persistenceMetadata);
                    });
                resolve(results);
            }).catch(err => {
                reject(new Error(`Search error: ` + err.message))
            });
        });
    }
    storePersistenceMetadata(type: PersistenceMetadataType, value: string, epochBlocknumberFrom: number, epochBlocknumberTo: number, filter?: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let persistenceMetadata: PersistenceMetadata = new PersistenceMetadata();
            let parsedValue: string = isNotEmpty(value) ? value.toLowerCase() : 'all';
            persistenceMetadata.type = type;
            persistenceMetadata.value = parsedValue;
            persistenceMetadata.from = epochBlocknumberFrom;
            persistenceMetadata.to = epochBlocknumberTo;
            if (isNotEmpty(filter)) {
                persistenceMetadata.filter = filter;
            }
            const objId: string = `${type}_${value}_${epochBlocknumberFrom}_${epochBlocknumberTo}_${filter}`;
            this.logger.verbose(`Storing 1 element in  persistence metadata. - From: ${epochBlocknumberFrom} To: ${epochBlocknumberTo} ${isNotEmpty(filter) ? 'Filter: ' + filter : ''} - id: ${objId}`);
            await this.elasticsearchClient.index({ body: persistenceMetadata, id: objId, index: this.getIndex(PersistenceConstants.METADATA_INDEX), refresh: 'wait_for' });
            resolve(1);
        });
    }
    async deletePersistenceMetadata(type: PersistenceMetadataType, value: string, epochBlocknumberFrom: number, epochBlocknumberTo: number): Promise<number> {
        let parsedValue: string = isNotEmpty(value) ? value.toLowerCase() : '*';
        let queryString: string = `type: ${type} AND (value: ${parsedValue}) AND from:[* TO ${epochBlocknumberTo} ] AND to:[ ${epochBlocknumberFrom} TO *]`;
        const deletedCounter = await this._deleteByQuery(this.getIndex(PersistenceConstants.METADATA_INDEX), `${queryString}`);
        return deletedCounter;
    }
    public async optimizePersistenceMetadata(type: PersistenceMetadataType, persistenceMetadata: PersistenceMetadata[], filter?: string): Promise<number> {
        try {
            let optimizedCounter = 0;
            const allMetadata = persistenceMetadata.filter(pm => pm.value === 'all');
            const valuesMetadata = persistenceMetadata.filter(pm => pm.value !== 'all');

            if (valuesMetadata.length > 0) {
                const address = valuesMetadata[0].value;
                if (allMetadata.length > 0) {
                    valuesMetadata.push(...Commons.clone(allMetadata));
                }
                valuesMetadata.forEach(pm => pm.value = address);
            }

            const addressMetadataToOptimize = this._groupConsecutiveValues(valuesMetadata);
            const allMetadataToOptimize = this._groupConsecutiveValues(allMetadata);

            var metadataToOptimize: PersistenceMetadata[] = [];
            if (addressMetadataToOptimize.length != valuesMetadata.length) {
                metadataToOptimize.push(...addressMetadataToOptimize);
            }
            if (allMetadataToOptimize.length != allMetadata.length) {
                metadataToOptimize.push(...allMetadataToOptimize);
            }

            let objIds: string[] = [];
            for (const metadata of metadataToOptimize) {
                const objId: string = `${type}_${metadata.value.toLowerCase()}_${metadata.from}_${metadata.to}_${filter}`;
                objIds.push(objId);
                await this.storePersistenceMetadata(type, metadata.value.toLowerCase(), metadata.from, metadata.to, metadata.filter);
                const queryString = `NOT _id:(${objIds.join(' OR ')}) AND type:${type} AND value:(${metadata.value.toLowerCase()}) AND from:[* TO ${metadata.to}] AND to:{${metadata.from} TO *] ${isNotEmpty(filter) ? 'AND filter: ' + filter : ''}`;
                await this.elasticsearchClient.updateByQuery({
                    index: this.getIndex(PersistenceConstants.METADATA_INDEX),
                    body: {
                        script: {
                            source: 'ctx._source.delete = "true"',
                        },
                        query: {
                            query_string: { query: queryString },
                        },
                    },
                });
                optimizedCounter++;
            }
            this.logger.verbose(`optimize ${type} metadata -  Optimized elements: ${optimizedCounter}`);
            return optimizedCounter;
        } catch (err) {
            if (err.message.indexOf('version conflict') > 0) {
                return 0
            } else {
                throw new Error(`Error while deleting data: ${err.message}`);
            }
        }
    }

    getClaimedRewards(whoClaimed: string, dataProvider: string, sentTo: string, blockNumberFrom: number, blockNumberTo: number, page: number, pageSize: number, sortField?: ClaimedRewardsSortEnum, sortOrder?: SortOrderEnum): Promise<PaginatedResult<Reward[]>> {
        const sortClause = `${sortField}:${sortOrder}`;
        return new Promise<PaginatedResult<Reward[]>>(async (resolve, reject) => {
            let queryClauses: string[] = [];
            if (isNotEmpty(whoClaimed)) {
                queryClauses.push(`whoClaimed: ${whoClaimed}`);
            }
            if (isNotEmpty(dataProvider)) {
                queryClauses.push(`dataProvider: ${dataProvider}`);
            }
            if (isNotEmpty(sentTo)) {
                queryClauses.push(`sentTo: ${sentTo}`);
            }
            let queryString: string = `${queryClauses.length > 0 ? queryClauses.join(' AND ') + ' AND ' : ''} blockNumber: [ ${blockNumberFrom} TO ${blockNumberTo} ]`;
            const claimedRewards: PaginatedResult<Reward[]> = await this._paginatedSearch<Reward>(this.getIndex(PersistenceConstants.CLAIMED_REWARDS_INDEX), queryString, page, pageSize, sortClause);
            resolve(claimedRewards);
        });
    }

    storeClaimedRewards(blockchainData: Reward[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(claimedReward => {
                claimedReward.whoClaimed = claimedReward.whoClaimed.toLowerCase();
                claimedReward.sentTo = claimedReward.sentTo.toLowerCase();
                claimedReward.dataProvider = claimedReward.dataProvider.toLowerCase();
                (claimedReward as any).objId = `${claimedReward.rewardEpochId}_${claimedReward.whoClaimed}_${isNotEmpty(claimedReward.dataProvider) ? claimedReward.dataProvider : ''}`;
            });
            let storedObjectCount: number = await this._bulkLoad<Reward>(blockchainData, this.getIndex(PersistenceConstants.CLAIMED_REWARDS_INDEX));
            resolve(storedObjectCount);
        })
    }

    getClaimedRewardsDateHistogram(whoClaimed: string, dataProvider: string, startTime: number, endTime: number, dateHistogramPoints: number): Promise<ClaimedRewardDateHistogramElement[]> {
        return new Promise<ClaimedRewardDateHistogramElement[]>((resolve, reject) => {
            let results: ClaimedRewardDateHistogramElement[] = [];
            let body: any = {
                "size": 0,
                "query": {
                    "query_string": {
                        "query": `timestamp: [${startTime} TO ${endTime}]`
                    }
                },
                "aggs": {
                    "histogram": {
                        "auto_date_histogram": {
                            "field": "timestamp",
                            "buckets": `${dateHistogramPoints}`
                        },
                        "aggs": {
                            "rewardEpochId": {
                                "terms": {
                                    "field": "rewardEpochId",
                                    "size": 10000
                                },
                                "aggs": {
                                    "sum": {
                                        "sum": {
                                            "field": "amount"
                                        }
                                    },
                                    "topSum": {
                                        "terms": {
                                            "field": 'dataProvider',
                                            "size": 5,
                                            "order": {
                                                "sum": "desc"
                                            }
                                        },
                                        "aggs": {
                                            "sum": {
                                                "sum": {
                                                    "field": "amount"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (isNotEmpty(whoClaimed)) {
                body.query.query_string.query += ` AND whoClaimed: ${whoClaimed}`;
                body.aggs.histogram.aggs.rewardEpochId.aggs.topSum.terms.field = 'dataProvider';
            }
            if (isNotEmpty(dataProvider)) {
                body.query.query_string.query += ` AND dataProvider: ${dataProvider}`;
                body.aggs.histogram.aggs.rewardEpochId.aggs.topSum.terms.field = 'whoClaimed';
            }
            if (isEmpty(whoClaimed) && isEmpty(dataProvider)) {
                delete body.aggs.histogram.aggs.rewardEpochId.aggs.topSum;
            }
            this.elasticsearchClient.search({ index: this.getIndex(PersistenceConstants.CLAIMED_REWARDS_INDEX), body: body }).then(response => {
                this._getBuckets(response.body?.aggregations?.histogram)
                    .flatMap(histogramAggBucket => {
                        let claimedTimestamp: number = histogramAggBucket.key;
                        this._getBuckets(histogramAggBucket.rewardEpochId).flatMap(rewardEpochIdBucket => {
                            let rewardEpochId: number = rewardEpochIdBucket.key;
                            let rewardEpochSum: number = 0;

                            if (rewardEpochIdBucket.topSum) {
                                this._getBuckets(rewardEpochIdBucket.topSum).flatMap(topSumBucket => {
                                    let tmpObj: ClaimedRewardDateHistogramElement = new ClaimedRewardDateHistogramElement();
                                    tmpObj.claimTimestamp = claimedTimestamp;
                                    tmpObj.rewardEpochId = rewardEpochId;
                                    let address: string = topSumBucket.key;

                                    tmpObj.whoClaimed = isNotEmpty(whoClaimed) ? whoClaimed : address;
                                    tmpObj.dataProvider = isNotEmpty(dataProvider) ? dataProvider : address;
                                    tmpObj.amount = topSumBucket.sum.value;
                                    rewardEpochSum += topSumBucket.sum.value;
                                    results.push(tmpObj);
                                });
                            }
                            if (rewardEpochIdBucket.sum) {
                                let tmpObj: ClaimedRewardDateHistogramElement = new ClaimedRewardDateHistogramElement();
                                tmpObj.claimTimestamp = claimedTimestamp;
                                tmpObj.rewardEpochId = rewardEpochId;
                                tmpObj.whoClaimed = isNotEmpty(whoClaimed) ? whoClaimed : null;
                                tmpObj.dataProvider = isNotEmpty(dataProvider) ? dataProvider : null;
                                tmpObj.amount = rewardEpochIdBucket.sum.value - rewardEpochSum;
                                results.push(tmpObj);
                            }
                        })
                    });
                resolve(results);
            }).catch(err => {
                reject(new Error(`getEpochStats error: ` + err.message))
            });
        });
    }


    private _groupConsecutiveValues(data: PersistenceMetadata[]): PersistenceMetadata[] {
        if (data.length === 0) {
            return [];
        }
        data.sort((a, b) => a.from - b.from);
        const result: PersistenceMetadata[] = [];
        let currentGroup: PersistenceMetadata = null;

        for (const item of data) {
            if (!currentGroup) {
                currentGroup = Commons.clone(item);
            } else if (currentGroup.value === item.value) {
                if (item.from <= currentGroup.to) {
                    currentGroup.to = Math.max(currentGroup.to, item.to);
                } else {
                    result.push(currentGroup);
                    currentGroup = Commons.clone(item);
                }
            } else {
                result.push(currentGroup);
                currentGroup = Commons.clone(item);
            }
        }

        if (currentGroup) {
            result.push(currentGroup);
        }

        return result;
    }

    @Process({ name: 'fullScanProcessor', concurrency: 10 })
    async fullScanProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._fullScan(job.data['index'], job.data['queryString'], job.data['sort'])
                .then(res => {
                    resolve(res);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    async getDelegations(from: string, to: string, epochBlocknumberFrom: number, epochBlocknumberTo: number, page: number, pageSize: number, sortField?: string, sortOrder?: SortOrderEnum): Promise<PaginatedResult<Delegation[]>> {
        return new Promise<PaginatedResult<Delegation[]>>(async (resolve, reject) => {
            let queryString: string = `from: ${isNotEmpty(from) ? from.toLowerCase() : '*'} AND to: ${isNotEmpty(to) ? to.toLowerCase() : '*'} AND blockNumber:[ ${epochBlocknumberFrom} TO ${epochBlocknumberTo} ]`;
            const sortClause = `${sortField}:${sortOrder}`;
            const delegations: PaginatedResult<Delegation[]> = await this._paginatedSearch<Delegation>(this.getIndex(PersistenceConstants.DELEGATIONS_INDEX), queryString, page, pageSize, sortClause);
            resolve(delegations);
        });
    }
    getDelegationsSnapshot(to: string, rewardEpoch: number, page: number, pageSize: number, sortField: DelegationsSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<DelegationSnapshot[]>> {
        return new Promise<PaginatedResult<DelegationSnapshot[]>>(async (resolve, reject) => {
            const queryString: string = `rewardEpoch: ${rewardEpoch} AND to: ${to} AND amount:>0`;
            const index: string = this.getIndex(PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX)
            const job = await this._persistenceDaoQueue.add('fullScanProcessor', { index, queryString });
            const results = await job.finished() as DelegationSnapshot[];
            resolve(Commons.parsePaginatedResults(results, page, pageSize, sortField, sortOrder));
        });
    }
    deleteDelegationsSnapshot(to: string, rewardEpoch: number): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let queryString: string = `rewardEpoch: ${rewardEpoch} AND to: ${isNotEmpty(to) ? to.toLowerCase() : '*'}`;
            const deletedCounter = await this._deleteByQuery(this.getIndex(PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX), `${queryString}`);
            resolve(deletedCounter);
        });
    }


    getDelegators(to: string, blockNumber: number): Promise<Delegation[]> {
        return new Promise<Delegation[]>(async (resolve, reject) => {
            const results: Delegation[] = await this._executeDelegatorsAggregation(to, blockNumber, this.getIndex(PersistenceConstants.DELEGATIONS_INDEX));
            resolve(results);
        });
    }

    async getUniqueDataProviderAddressList(endTime: number): Promise<string[]> {
        const termsResults: { key: string, doc_count: number }[] = await this.doTermsAggregation('to', `timestamp: [* TO ${endTime}]`, this.getIndex(PersistenceConstants.DELEGATIONS_INDEX));
        let results: string[] = [];
        termsResults.map(result => {
            results.push(result.key);
        });
        return results;

    }
    async doTermsAggregation(field: string, queryString: string, index: string): Promise<{ key: string, doc_count: number }[]> {
        let results: { key: string, doc_count: number }[] = [];
        const aggregationQuery = `{
            "size": 0,
            "query": {
                "query_string": {
                    "query": "${queryString}"
                }
            },
            "aggs": {
                "unique_values": {
                    "terms": {
                        "field": "${field}",
                        "size": ${this.maxResultsLimit}
                    }
                }
            }
        }`;
        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });
        this._getBuckets(response.body?.aggregations?.unique_values)
            .flatMap(uniqueValuesBucket => {
                results.push(uniqueValuesBucket);
            })

        return results;
    }

    async _doGroupedStatsAggregation(groupByField: string, valueField: string, operation: AggregationOperationEnum, queryString: string, index: string): Promise<{ key: string, doc_count: number, value: number }[]> {
        let results: { key: string, doc_count: number, value: number }[] = [];
        const aggregationQuery = `{
            "size": 0,
            "query": {
                "query_string": {
                    "query": "${queryString}"
                }
            },
            "aggs": {
                "unique_terms": {
                    "terms": {
                        "field": "${groupByField}.keyword",
                        "size": ${this.maxResultsLimit}
                    },
                "aggs": {
                    "values": {
                        "${AggregationOperationEnum[operation]}": {
                            "field": "${valueField}"
                        }
                    }
                }                    
                }                
            }
        }`;
        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });
        this._getBuckets(response.body?.aggregations?.unique_terms)
            .flatMap(unique_terms => {
                results.push({ key: unique_terms.key, doc_count: unique_terms.doc_count, value: unique_terms.values?.value });
            });

        return results;
    }
    async _doStatsAggregation(valueField: string, operation: AggregationOperationEnum, queryString: string, index: string): Promise<{ key: string, doc_count: number, value: number }[]> {
        let results: { key: string, doc_count: number, value: number }[] = [];
        const aggregationQuery = `{
            "size": 0,
            "query": {
                "query_string": {
                    "query": "${queryString}"
                }
            },
            "aggs": {
                "values": {
                    "${AggregationOperationEnum[operation]}": {
                        "field": "${valueField}"
                    }
                },
                "count_occurrences": {
                    "value_count": {
                        "field": "amount"
                    }
                }
            }
        }`;
        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });
        results.push({ key: null, doc_count: response.body?.aggregations?.count_occurrences?.value ? response.body?.aggregations?.count_occurrences?.value : 0, value: response.body?.aggregations?.values?.value ? response.body?.aggregations?.values?.value : 0 });
        return results;
    }

    async _executeDelegatorsAggregation(address: string, toBlockNumber: number, index: string, afterKey = null, results: Delegation[] = []) {
        const aggregationQuery = {
            size: 0,
            query: {
                bool: {
                    filter: [
                        {
                            term: {
                                to: address,
                            },
                        },
                        {
                            range: {
                                blockNumber: {
                                    lte: toBlockNumber,
                                },
                            },
                        },
                    ],
                },
            },
            aggs: {
                composite_agg: {
                    composite: {
                        size: this.maxResultsLimit,
                        sources: [
                            {
                                from: {
                                    terms: {
                                        field: 'from',
                                    },
                                },
                            },
                        ],
                        ...(afterKey ? { after: afterKey } : {}),
                    },
                    aggs: {
                        from_to_agg: {
                            terms: {
                                field: 'from',
                                size: this.maxResultsLimit,
                            },
                            aggs: {
                                max_blockNumber: {
                                    max: {
                                        field: 'blockNumber',
                                    },
                                },
                                recent_docs: {
                                    top_hits: {
                                        size: 1,
                                        sort: [
                                            {
                                                blockNumber: 'desc',
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });
        this._getBuckets(response.body?.aggregations?.composite_agg)
            .flatMap(compositeAggBucket => {
                this._getBuckets(compositeAggBucket.from_to_agg).flatMap(fromToBucket => {
                    if (fromToBucket.recent_docs?.hits?.hits[0]?._source) {
                        let delegation: Delegation = fromToBucket.recent_docs.hits.hits[0]._source;
                        results.push(delegation)
                    }
                })
            })
        if (response.body.aggregations.composite_agg.after_key) {
            return this._executeDelegatorsAggregation(address, toBlockNumber, index, response.body.aggregations.composite_agg.after_key, results);
        }
        return results;
    }


    async getVotePower(address: string, rewardEpochId: number): Promise<VotePower> {
        return await this._executeVotePowerAggregation(address, rewardEpochId, this.getIndex(PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX));
    }


    async _executeVotePowerAggregation(address: string, rewardEpochId: number, index: string): Promise<VotePower> {
        const queryString: string = `to: ${isNotEmpty(address) ? address.toLowerCase() : '*'} AND rewardEpoch: ${rewardEpochId} AND amount:>0`;
        const aggregationQuery: any = {
            "size": 0,
            "query": {
                "query_string": {
                    "query": queryString
                }
            },
            "aggs": {
                "delegators_count": {
                    "cardinality": {
                        "field": "from",
                        "precision_threshold": 40000
                    }
                },
                "delegations_count": {
                    "value_count": {
                        "field": "from"
                    }
                },
                "vote_power": {
                    "sum": {
                        "field": "amount"
                    }
                }
            }
        };

        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });

        let votePower: VotePower = new VotePower();
        votePower.address = address;
        votePower.rewardEpochId = rewardEpochId;
        votePower.amount = response.body?.aggregations.vote_power?.value ? response.body?.aggregations.vote_power?.value : 0;
        votePower.delegators = response.body?.aggregations.delegators_count?.value ? response.body?.aggregations.delegators_count?.value : 0;
        votePower.delegations = response.body?.aggregations.delegations_count?.value ? response.body?.aggregations.delegations_count?.value : 0;
        return votePower;
    }
    async getDataProvidersVotePower(rewardEpochId: number): Promise<VotePower[]> {
        return this._executeVotePowerAggregationGroupedByAddresses(rewardEpochId, rewardEpochId, this.getIndex(PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX));
    }

    async _executeVotePowerAggregationGroupedByAddresses(rewardEpochFrom: number, rewardEpochTo: number, index: string): Promise<VotePower[]> {
        let results: VotePower[] = [];
        const aggregationQuery = `{
            "size": 0,
            "query": {
                "query_string": {
                    "query": "rewardEpoch: [${rewardEpochFrom} TO ${rewardEpochTo}] AND amount:>0"
                }
            },
            "aggs": {
                "reward_epochs_group": {
                    "terms": {
                        "field": "rewardEpoch",
                        "size": ${this.maxResultsLimit}
                    },
                    "aggs": {
                        "delegators_group": {
                            "terms": {
                                "field": "to",
                                "size": ${this.maxResultsLimit}
                            },
                            "aggs": {
                                "delegators_count": {
                                    "cardinality": {
                                        "field": "from",
                                        "precision_threshold": 40000
                                    }
                                },
                                "vote_power": {
                                    "sum": {
                                        "field": "amount"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`

        const response = await this.elasticsearchClient.search({
            index: index,
            body: aggregationQuery,
        });
        this._getBuckets(response.body?.aggregations?.reward_epochs_group)
            .flatMap(rewardEpochsBucket => {
                this._getBuckets(rewardEpochsBucket.delegators_group).map(delegatorsBucket => {
                    let votePower: VotePower = new VotePower();
                    votePower.address = delegatorsBucket.key;
                    votePower.amount = delegatorsBucket.vote_power?.value ? delegatorsBucket.vote_power?.value : 0;
                    votePower.rewardEpochId = parseInt(rewardEpochsBucket.key);
                    votePower.delegations = delegatorsBucket.doc_count;
                    votePower.delegators = delegatorsBucket.delegators_count?.value ? delegatorsBucket.delegators_count?.value : 0;
                    results.push(votePower);
                });
            });
        return results;
    }
    storeDelegations(blockchainData: Delegation[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(delegation => {
                delegation.from = delegation.from.toLowerCase();
                delegation.to = delegation.to.toLowerCase();
                (delegation as any).objId = `${delegation.from}_${delegation.to}_${delegation.blockNumber}`;
            });
            let storedObjectCount: number = await this._bulkLoad<Delegation>(blockchainData, this.getIndex(PersistenceConstants.DELEGATIONS_INDEX));
            resolve(storedObjectCount);
        })
    }
    storeDelegationsSnapshot(blockchainData: DelegationSnapshot[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(delegation => {
                delegation.from = delegation.from.toLowerCase();
                delegation.to = delegation.to.toLowerCase();
                (delegation as any).objId = `${delegation.rewardEpoch}_${delegation.from}_${delegation.to}`;
            });


            let storedObjectCount: number = await this._bulkLoad<DelegationSnapshot>(blockchainData, this.getIndex(PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX));
            resolve(storedObjectCount);
        })
    }

    getFtsoInfo(): Promise<DataProviderInfo[]> {
        return new Promise<DataProviderInfo[]>(async (resolve, reject) => {
            const results: DataProviderInfo[] = await this._search<DataProviderInfo>(this.getIndex(PersistenceConstants.FTSO_INFO_INDEX), '*', this.maxResultsLimit);
            if (isNotEmpty(results)) {
                resolve(results);
            } else {
                resolve(null);
            }
        });
    }

    storeFtsoInfo(ftsoInfo: DataProviderInfo[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            ftsoInfo.forEach(obj => {
                (obj as any).objId = obj.address;
            });
            let storedObjectCount: number = await this._bulkLoad<DataProviderInfo>(ftsoInfo, this.getIndex(PersistenceConstants.FTSO_INFO_INDEX));
            resolve(storedObjectCount);
        })
    }


    async getBalances(address: string, blockNublockNumberTo: number): Promise<Balance[]> {
        const queryString: string = `addressA: ${isEmpty(address) ? '*' : address.toLowerCase()} AND blockNumber: [0 TO ${blockNublockNumberTo}]`;
        const index: string = this.getIndex(PersistenceConstants.BALANCES_INDEX);
        const job = await this._persistenceDaoQueue.add('fullScanProcessor', { index, queryString });
        const results = await job.finished() as Balance[];
        return results;
    }


    getBalancesHistory(address: string, blockNumberFrom: number, blockNumberTo: number, page: number, pageSize: number, sortField?: BalanceSortEnum, sortOrder?: SortOrderEnum): Promise<PaginatedResult<Balance[]>> {
        return new Promise<PaginatedResult<Balance[]>>(async (resolve, reject) => {
            const sortClause = `${sortField}:${sortOrder}`;
            const queryString: string = `addressA: ${isEmpty(address) ? '*' : address.toLowerCase()} AND blockNumber: [${blockNumberFrom} TO ${blockNumberTo}]`;
            const results: PaginatedResult<Balance[]> = await this._paginatedSearch<Balance>(this.getIndex(PersistenceConstants.BALANCES_INDEX), queryString, page, pageSize, sortClause);
            resolve(results);
        });
    }
    storeBalances(blockchainData: Balance[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(balance => {
                balance.addressA = balance.addressA.toLowerCase();
                balance.addressB = balance.addressB.toLowerCase();
                (balance as any).objId = `${balance.addressA}_${balance.addressB}_${balance.amount}_${balance.blockNumber}_${balance.nonce}`;
                delete balance.nonce;
            });

            let storedObjectCount: number = await this._bulkLoad<Balance>(blockchainData, this.getIndex(PersistenceConstants.BALANCES_INDEX));
            resolve(storedObjectCount);
        })
    }



    getWrappedBalance(address: string, rewardEpochId: number, blockNumberTo: number): Promise<WrappedBalance> {
        return new Promise<WrappedBalance>(async (resolve, reject) => {
            const queryString: string = `addressA: ${isNotEmpty(address) ? address.toLowerCase() : '*'} AND blockNumber: [0 TO ${blockNumberTo}]`;
            const aggResults = await this._doStatsAggregation('amount', AggregationOperationEnum.sum, queryString, this.getIndex(PersistenceConstants.BALANCES_INDEX));
            let wrappedBalance: WrappedBalance = new WrappedBalance(address, rewardEpochId, aggResults[0].value, aggResults[0].doc_count);
            resolve(wrappedBalance);
        });
    }


    async getDataProvidersWrappedBalancesByRewardEpoch(addresses: string[], rewardEpochId: number, blockNumberTo: number, timestampTo: number): Promise<WrappedBalance> {
        return new Promise<WrappedBalance>(async (resolve, reject) => {
            let results: WrappedBalance = null;
            const rewardEpoch: RewardEpoch = await this._get<RewardEpoch>(this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX), rewardEpochId.toString());
            let targetBlockNumber: number = 0;
            let targetTimestamp: number = 0;
            if (isNotEmpty(rewardEpoch)) {
                targetBlockNumber = rewardEpoch.votePowerBlockNumber;
                targetTimestamp = rewardEpoch.votePowerTimestamp;
            } else {
                targetBlockNumber = blockNumberTo;
                targetTimestamp = timestampTo;
            }
            let addressesQuery: string;
            if (isEmpty(addresses) || (isNotEmpty(addresses) && addresses.length > 1)) {
                addressesQuery = `(${addresses.join(' OR ')})`;
                const queryString: string = `addressA: ${addressesQuery} AND blockNumber: [0 TO ${targetBlockNumber}]`;
                const aggResults = await this._doStatsAggregation('amount', AggregationOperationEnum.sum, queryString, this.getIndex(PersistenceConstants.BALANCES_INDEX));
                aggResults.map(bucket => {
                    let wrappedBalance: WrappedBalance = new WrappedBalance(bucket.key, rewardEpochId, bucket.value, bucket.doc_count);
                    wrappedBalance.timestamp = timestampTo;
                    results = wrappedBalance;
                });
            }
            resolve(results);
        });
    }
    async getDataProvidersWrappedBalancesByAddress(addresses: string[], rewardEpochId: number, blockNumberTo: number, timestampTo: number): Promise<WrappedBalance[]> {
        return new Promise<WrappedBalance[]>(async (resolve, reject) => {
            let results: WrappedBalance[] = [];
            const rewardEpoch: RewardEpoch = await this._get<RewardEpoch>(this.getIndex(PersistenceConstants.REWARD_EPOCHS_INDEX), rewardEpochId.toString());
            let targetBlockNumber: number = 0;
            let targetTimestamp: number = 0;
            if (isNotEmpty(rewardEpoch)) {
                targetBlockNumber = rewardEpoch.votePowerBlockNumber;
                targetTimestamp = rewardEpoch.votePowerTimestamp;
            } else {
                targetBlockNumber = blockNumberTo;
                targetTimestamp = timestampTo;
            }
            let addressesQuery: string;
            if (isEmpty(addresses) || (isNotEmpty(addresses) && addresses.length > 1)) {
                addressesQuery = `(${addresses.join(' OR ')})`;
                const queryString: string = `addressA: ${addressesQuery} AND blockNumber: [0 TO ${targetBlockNumber}]`;
                const aggResults = await this._doGroupedStatsAggregation('addressA', 'amount', AggregationOperationEnum.sum, queryString, this.getIndex(PersistenceConstants.BALANCES_INDEX));
                aggResults.map(bucket => {
                    let wrappedBalance: WrappedBalance = new WrappedBalance(bucket.key, rewardEpochId, bucket.value, bucket.doc_count);
                    wrappedBalance.timestamp = timestampTo;
                    results.push(wrappedBalance);
                });
            }
            resolve(results);
        });
    }

    getVoterWhitelist(address: string, targetBlockNumber: number): Promise<VoterWhitelist[]> {
        return new Promise<VoterWhitelist[]>(async (resolve, reject) => {
            let results: VoterWhitelist[] = [];
            const aggregationQuery: string = `{
            "size": 0,
                "query": {
                    "query_string": {
                        "query": "address:${isNotEmpty(address) ? address.toLowerCase() : '*'} AND blockNumber: [0 TO ${targetBlockNumber}]"
                    }                       
                },
                "aggs": {
                    "by_address": {
                        "terms": {
                            "field": "address",
                                "size": ${this.maxResultsLimit}
                        },
                        "aggs": {
                            "by_symbol": {
                                "terms": {
                                    "field": "symbol",
                                        "size": ${this.maxResultsLimit}
                                },
                                "aggs": {
                                    "latest_hit": {
                                        "top_hits": {
                                            "size": 1,
                                                "sort": [
                                                    {
                                                        "blockNumber": {
                                                            "order": "desc"
                                                        }
                                                    }
                                                ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`
            const response = await this.elasticsearchClient.search({
                index: this.getIndex(PersistenceConstants.VOTER_WHITELIST_INDEX),
                body: aggregationQuery,
            });
            this._getBuckets(response.body?.aggregations?.by_address)
                .flatMap(addressBucket => {
                    this._getBuckets(addressBucket.by_symbol).flatMap(symbolBucket => {
                        if (symbolBucket.latest_hit && symbolBucket.latest_hit.hits && symbolBucket.latest_hit.hits.hits.length > 0 && symbolBucket.latest_hit.hits.hits[0]._source) {
                            let voterWhitelist: VoterWhitelist = new VoterWhitelist();
                            voterWhitelist.address = symbolBucket.latest_hit.hits.hits[0]._source.address;
                            voterWhitelist.symbol = symbolBucket.latest_hit.hits.hits[0]._source.symbol;
                            voterWhitelist.blockNumber = symbolBucket.latest_hit.hits.hits[0]._source.blockNumber;
                            voterWhitelist.timestamp = symbolBucket.latest_hit.hits.hits[0]._source.timestamp;
                            voterWhitelist.whitelisted = symbolBucket.latest_hit.hits.hits[0]._source.whitelisted;
                            results.push(voterWhitelist);
                        }
                    })
                })

            resolve(results);
        })
    }
    storeVoterWhitelist(blockchainData: VoterWhitelist[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            blockchainData.forEach(voterWhitelist => {
                voterWhitelist.address = voterWhitelist.address.toLowerCase();
                (voterWhitelist as any).objId = `${voterWhitelist.address}_${voterWhitelist.symbol}_${voterWhitelist.whitelisted}_${voterWhitelist.blockNumber}`;
                delete voterWhitelist.nonce;
            });
            let storedObjectCount: number = await this._bulkLoad<VoterWhitelist>(blockchainData, this.getIndex(PersistenceConstants.VOTER_WHITELIST_INDEX));
            resolve(storedObjectCount);
        })
    }
}

export enum AggregationOperationEnum {
    sum, min, max, avg
}