import { Commons, NetworkEnum, PaginatedResult, PriceEpoch, PriceEpochDTO, PriceEpochSettings, RewardEpoch, RewardEpochDTO, RewardEpochSettings, SortOrderEnum } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { plainToClass } from "class-transformer";
import { isEmpty, isNotEmpty } from "class-validator";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { Subscription } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { ServiceStatusEnum } from "../network-dao-dispatcher/model/service-status.enum";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ProgressGateway } from "../progress.gateway";
import { ServiceUtils } from "../service-utils";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";

@Injectable()
export class EpochsService {
    logger: Logger = new Logger(EpochsService.name);
    private _rewardEpochSettings: { [network: string]: RewardEpochSettings } = {};
    private _priceEpochSettings: { [network: string]: PriceEpochSettings } = {};
    private _lastBlockNumber: { [network: string]: number } = {};
    private _bootstraped: { [network: string]: boolean } = {};
    private _firstPriceEpoch: { [network: string]: PriceEpoch } = {};
    constructor(
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private _configService: ConfigService,
        private readonly _progressGateway: ProgressGateway
    ) {

    }
    async initialize(): Promise<void> {
        try {
            this.logger.log(`Initializing...`);
            const availableNetworks: NetworkEnum[] = await this._networkDaoDispatcher.getAvailableNetworks();
            const networkConfigurations: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
            for (const network of availableNetworks) {
                const networkConfig = networkConfigurations.find(nConfig => nConfig.name === network);
                if (networkConfig && networkConfig.scanActive) {
                    const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                    const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                    await this._startEpochsListeners(network, persistenceDao, blockchainDao);
                    await this._bootstrapEpochsScan(network, persistenceDao, blockchainDao);
                }
            }
            this.logger.log(`Initialized.`);
            return;
        } catch (err) {
            throw new Error(`Unable to initialize FtsoService: ${err.message}`);
        }

    }

    private async _startEpochsListeners(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Initializing epochs listener`);
        this._lastBlockNumber[network] = await blockchainDao.provider.getBlockNumber();
        const handlePriceEpoch = async (priceEpoch: PriceEpoch) => {
            this.logger.log(`${network} - ${priceEpoch.id} - Price epoch finalized`);
            const currentBlockNumber: number = await blockchainDao.provider.getBlockNumber();
            await persistenceDao.storePriceEpoch([priceEpoch]);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.PriceEpoch, null, this._lastBlockNumber[network], priceEpoch.blockNumber);
            this._lastBlockNumber[network] = currentBlockNumber;
            await this._consistencyCheck(network, persistenceDao, blockchainDao, currentBlockNumber);
        };
        const handleRewardEpoch = async (rewardEpoch: RewardEpoch) => {
            this.logger.log(`${network} - ${rewardEpoch.id} - Reward epoch finalized`);
            const currentBlockNumber: number = await blockchainDao.provider.getBlockNumber();
            await persistenceDao.storeRewardEpochs([rewardEpoch]);
            this._lastBlockNumber[network] = currentBlockNumber;
        };

        blockchainDao.priceEpochListener$.subscribe(handlePriceEpoch);
        blockchainDao.rewardEpochListener$.subscribe(handleRewardEpoch);

        await blockchainDao.startRewardEpochListener();
        this.logger.log(`${network} - Epochs listener initialized`);
    }

    private async _consistencyCheck(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, actualBlockNumber: number): Promise<void> {
        if (this._bootstraped[network]) {
            const firstPriceEpoch: PriceEpoch = await this.getFirstPriceEpoch(network);
            const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.PriceEpoch, null, firstPriceEpoch.blockNumber, actualBlockNumber);
            const missingPriceEpochBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, firstPriceEpoch.blockNumber, actualBlockNumber);

            if (missingPriceEpochBlockNumbers.length > 0) {
                for (const missingBlockNumbers of missingPriceEpochBlockNumbers) {
                    await this.getPriceEpochsByBlockNumbers(network, missingBlockNumbers.from, missingBlockNumbers.to, persistenceDao, blockchainDao);
                }
            } else {
                if (persistenceMetadata.length > 5) {
                    await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.PriceEpoch, persistenceMetadata);
                }
            }
        }
    }

    private async _bootstrapEpochsScan(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Starting price epochs scan bootstrap...`);
        this._bootstraped[network] = false;
        const startTime: number = new Date().getTime();
        const currentPriceEpoch: PriceEpoch = await this.getCurrentPriceEpoch(network);
        const rewardEpochsSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
        const paginatedRewardEpochs: PaginatedResult<RewardEpoch[]> = await this.getRewardEpochs(network, rewardEpochsSettings.firstEpochStartTime, new Date().getTime(), 1, 10000, EpochSortEnum.id, SortOrderEnum.asc);
        const rewardEpochs: RewardEpoch[] = paginatedRewardEpochs.results;
        // Sort rewardEpochs by id

        for (let i = 0; i < rewardEpochs.length; i++) {
            const rewardEpoch = rewardEpochs[i];
            this.logger.log(`${network} - Fetching price epochs for rewardEpoch ${rewardEpoch.id}`);
            const fromTimestamp = i === 0 ? 0 : rewardEpochs[i - 1].timestamp;
            await this.getPriceEpochs(network, fromTimestamp, rewardEpoch.timestamp, 1, 0);
        }

        const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.PriceEpoch, null, 0, currentPriceEpoch.blockNumber);
        const missingPriceEpochsBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, currentPriceEpoch.blockNumber);

        for (const missingBlockNumbers of missingPriceEpochsBlockNumbers) {
            await this.getPriceEpochsByBlockNumbers(network, missingBlockNumbers.from, missingBlockNumbers.to, persistenceDao, blockchainDao);
        }

        const durationInSeconds = (new Date().getTime() - startTime) / 1000;
        this._bootstraped[network] = true;
        this.logger.log(`${network} - Price epochs scan bootstrap finished. Duration: ${durationInSeconds} s`);
    }

    async getRewardEpochSettings(network: NetworkEnum): Promise<RewardEpochSettings> {
        return new Promise<RewardEpochSettings>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }

                if (isNotEmpty(this._rewardEpochSettings[network])) {
                    resolve(this._rewardEpochSettings[network]);
                    return;
                }

                const daoData: RewardEpochSettings = await persistenceDao.getRewardEpochSettings();
                if (isNotEmpty(daoData)) {
                    this._rewardEpochSettings[network] = plainToClass(RewardEpochSettings, daoData);
                    resolve(this.getRewardEpochSettings(network));
                    return;
                }

                const blockchainData: RewardEpochSettings = await blockchainDao.getRewardEpochSettings();
                await persistenceDao.storeRewardEpochSettings(blockchainData);
                resolve(this.getRewardEpochSettings(network));
                return;
            } catch (e) {
                this.logger.error(`Unable to get rewardEpochSettings: ${e.message}`);
                reject(new Error('Unable to get rewardEpochSettings.'));
            }

        });
    }

    async getCurrentRewardEpoch(network: NetworkEnum): Promise<RewardEpoch> {
        return new Promise<RewardEpoch>(async (resolve, reject) => {
            try {
                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                resolve(this.getRewardEpoch(network, rewardEpochSettings.getCurrentEpochId()));
                return;
            } catch (e) {
                this.logger.error(`Unable to get current reward epoch: ${e.message}`);
                reject(new Error('Unable to get current reward epoch.'));
            }
        });
    }
    async getCurrentRewardEpochDto(network: NetworkEnum): Promise<RewardEpochDTO> {
        return new Promise<RewardEpochDTO>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                const rewardEpoch: RewardEpoch = await this.getCurrentRewardEpoch(network);
                if (isNotEmpty(rewardEpoch)) {
                    resolve(new RewardEpochDTO(rewardEpoch, rewardEpochSettings));
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get current reward epoch: ${e.message}`);
                reject(new Error('Unable to get current reward epoch.'));
            }
        });
    }

    async getRewardEpochs(network: NetworkEnum, startTime: number, endTime: number, page: number, pageSize: number, sortField?: EpochSortEnum, sortOrder?: SortOrderEnum, force?: boolean): Promise<PaginatedResult<RewardEpoch[]>> {
        return new Promise<PaginatedResult<RewardEpoch[]>>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                const expectedRewardEpochs: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                if (expectedRewardEpochs.length == 0) {
                    resolve(new PaginatedResult(page, pageSize, sortField, sortOrder, 0, []));
                    return;
                }
                const epochFrom: number = Math.min(...expectedRewardEpochs);
                const epochTo: number = Math.max(...expectedRewardEpochs);
                const epochStats: EpochStats = await persistenceDao.getRewardEpochStats(epochFrom, epochTo);


                if ((epochStats.count != ((epochStats.maxEpochId - epochStats.minEpochId) + 1)) || (epochStats.count != (epochTo - epochFrom))) {
                    const rewardEpochs: PaginatedResult<RewardEpoch[]> = await persistenceDao.getRewardEpochs(epochFrom, epochTo, 1, 10000, sortField, sortOrder);
                    const missingRewardEpochs: number[] = Commons.findMissingItems<number>(rewardEpochs.results, expectedRewardEpochs, 'id');
                    if (missingRewardEpochs.length == 0 && rewardEpochs.results.length > 0) {
                        resolve(rewardEpochs);
                        return;
                    }
                    if (missingRewardEpochs.length > 0) {
                        const blockchainData: RewardEpoch[] = [];
                        for (let i = 0; i < missingRewardEpochs.length; i++) {
                            if (missingRewardEpochs[i] < rewardEpochSettings.getNextEpochId()) {
                                this.logger.log(`${network} - Fetching rewardEpoch ${missingRewardEpochs[i]}`);
                                blockchainData.push(await blockchainDao.getRewardEpoch(missingRewardEpochs[i]));
                            }
                        }
                        if (blockchainData.length > 0) {
                            await persistenceDao.storeRewardEpochs(blockchainData);
                            resolve(await this.getRewardEpochs(network, startTime, endTime, page, pageSize, sortField, sortOrder));
                            return;
                        } else {
                            resolve(new PaginatedResult(page, pageSize, sortField, sortOrder, 0, []));
                            return;
                        }
                    }
                } else {
                    const rewardEpochs: PaginatedResult<RewardEpoch[]> = await persistenceDao.getRewardEpochs(epochFrom, epochTo, page, pageSize, sortField, sortOrder);
                    resolve(rewardEpochs);
                }
            } catch (e) {
                this.logger.error(`Unable to get reward epochs: ${e.message}`);
                reject(new Error('Unable to get reward epochs.'));
            }
        });
    }
    async getRewardEpoch(network: NetworkEnum, rewardEpochId: number): Promise<RewardEpoch> {
        return new Promise<RewardEpoch>(async (resolve, reject) => {
            try {
                let cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }
                const cacheData: RewardEpoch = await cacheDao.getRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }

                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                const currentRewardEpochId: number = rewardEpochSettings.getCurrentEpochId();
                if (rewardEpochId > currentRewardEpochId) {
                    reject(new Error(`Unable to retrieve reward epoch data for ${rewardEpochId} as it has not been initialized yet.`))
                }
                const rewardEpochs: PaginatedResult<RewardEpoch[]> = await this.getRewardEpochs(network, rewardEpochSettings.getStartTimeForEpochId(rewardEpochId), rewardEpochSettings.getEndTimeForEpochId(rewardEpochId), 1, 1);
                cacheDao.setRewardEpoch(rewardEpochs.results[0]);
                resolve(rewardEpochs.results[0]);
                return;
            } catch (e) {
                this.logger.error(`Unable to get reward epoch: ${e.message}`);
                reject(new Error('Unable to get reward epoch.'));
            }
        });
    }
    async getRewardEpochDto(network: NetworkEnum, rewardEpochId): Promise<RewardEpochDTO> {
        return new Promise<RewardEpochDTO>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                const rewardEpoch: RewardEpoch = await this.getRewardEpoch(network, rewardEpochId);
                if (isNotEmpty(rewardEpoch)) {
                    resolve(new RewardEpochDTO(rewardEpoch, rewardEpochSettings));
                    return;
                } else {
                    resolve(null);
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get reward epoch: ${e.message}`);
                reject(new Error(e.message));
            }
        });
    }
    async getRewardEpochsDto(network: NetworkEnum, startTime: number, endTime: number, page: number, pageSize: number, sortField?: EpochSortEnum, sortOrder?: SortOrderEnum): Promise<PaginatedResult<RewardEpochDTO[]>> {
        return new Promise<PaginatedResult<RewardEpochDTO[]>>(async (resolve, reject) => {
            try {
                const rewardEpochSettings: RewardEpochSettings = await this.getRewardEpochSettings(network);
                const rewardEpochs: PaginatedResult<RewardEpoch[]> = await this.getRewardEpochs(network, startTime, endTime, page, pageSize, sortField, sortOrder);
                let paginatedResults: PaginatedResult<RewardEpochDTO[]> = new PaginatedResult(rewardEpochs.page, rewardEpochs.pageSize, rewardEpochs.sortField, rewardEpochs.sortOrder, rewardEpochs.numResults, []);
                if (rewardEpochs.results.length > 0) {
                    const results: RewardEpochDTO[] = [];
                    rewardEpochs.results.forEach(rewardEpoch => {
                        results.push(new RewardEpochDTO(rewardEpoch, rewardEpochSettings));
                    });
                    paginatedResults.results = results;
                    resolve(paginatedResults);
                    return;
                } else {
                    resolve(new PaginatedResult(page, pageSize, sortField, sortOrder, 0, []));
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get reward epochs dto: ${e.message}`);
                reject(new Error('Unable to get reward epochs dto.'));
            }
        });
    }
    async getBlockNumberRangesByRewardEpochs(network: NetworkEnum, startTime: number, endTime: number, blockchainDao: IBlockchainDao): Promise<EpochStats> {
        return new Promise<EpochStats>(async (resolve, reject) => {
            let epochStats: EpochStats = new EpochStats();
            const paginatedRewardEpochs: PaginatedResult<RewardEpoch[]> = await this.getRewardEpochs(network, startTime, endTime, 1, 10000, EpochSortEnum.id, SortOrderEnum.desc);
            const currentRewardEpoch: RewardEpoch = await this.getCurrentRewardEpoch(network);
            const rewardEpochs: RewardEpoch[] = paginatedRewardEpochs.results;
            if (rewardEpochs.length > 0) {
                if (rewardEpochs.length == 1 && rewardEpochs[0].id < currentRewardEpoch.id) {
                    const targetRewardEpoch: RewardEpoch = await this.getRewardEpoch(network, rewardEpochs[0].id + 1);
                    epochStats.minBlockNumber = rewardEpochs[0].blockNumber;
                    epochStats.maxBlockNumber = targetRewardEpoch.blockNumber;
                    epochStats.count = rewardEpochs.length;
                    epochStats.minEpochId = rewardEpochs[0].id;
                    epochStats.maxEpochId = targetRewardEpoch.id;
                    resolve(epochStats);
                } else {
                    rewardEpochs.sort((a, b) => b.id - a.id);
                    epochStats.minBlockNumber = rewardEpochs[rewardEpochs.length - 1].blockNumber;
                    epochStats.maxBlockNumber = rewardEpochs[0].blockNumber;
                    epochStats.minEpochId = rewardEpochs[rewardEpochs.length - 1].id;
                    epochStats.maxEpochId = rewardEpochs[0].id;
                    epochStats.count = rewardEpochs.length;

                    resolve(epochStats);
                }

            } else {
                resolve(null);
            }
        })
    }



    getPriceEpochSettings(network: NetworkEnum): Promise<PriceEpochSettings> {
        return new Promise<PriceEpochSettings>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }

                if (isNotEmpty(this._priceEpochSettings[network])) {
                    resolve(this._priceEpochSettings[network]);
                    return;
                }

                const daoData: PriceEpochSettings = await persistenceDao.getPriceEpochSettings();
                if (isNotEmpty(daoData)) {
                    this._priceEpochSettings[network] = plainToClass(PriceEpochSettings, daoData);
                    resolve(this.getPriceEpochSettings(network));
                    return;
                }

                const blockchainData: PriceEpochSettings = await blockchainDao.getPriceEpochSettings();
                await persistenceDao.storePriceEpochSettings(blockchainData);
                resolve(this.getPriceEpochSettings(network));
                return;
            } catch (e) {
                this.logger.error(`Unable to get priceEpochSettings: ${e.message}`);
                reject(new Error('Unable to get priceEpochSettings.'));
            }

        });
    }

    async getPriceEpochStats(network: NetworkEnum, startTime: number, endTime: number): Promise<EpochStats> {
        return new Promise<EpochStats>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (isEmpty(blockchainDao) || (isNotEmpty(blockchainDao) && blockchainDao.status !== ServiceStatusEnum.STARTED)) {
                    reject(new Error(`Service unavailable`));
                    return;
                }
                if (isEmpty(persistenceDao) || (isNotEmpty(persistenceDao) && persistenceDao.status !== ServiceStatusEnum.STARTED)) {
                    reject(new Error(`Service unavailable`));
                    return;
                }

                const daoData: EpochStats = await persistenceDao.getPriceEpochStats(startTime, endTime);
                if (isNotEmpty(daoData)) {
                    resolve(daoData);
                    return;
                } else {
                    resolve(new EpochStats());
                }
                return;
            } catch (e) {
                this.logger.error(`Unable to get priceEpochStats: ${e.message}`);
                reject(new Error('Unable to get priceEpochStats.'));
            }
        });
    }
    getBlockNumberRangeByPriceEpochs(network: NetworkEnum, startTime: number, endTime: number): Promise<EpochStats> {
        return new Promise<EpochStats>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }

                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                const firstPriceEpoch: PriceEpoch = await this.getFirstPriceEpoch(network);
                if (endTime >= new Date().getTime()) {
                    endTime = priceEpochSettings.getStartTimeForEpochId(priceEpochSettings.getCurrentEpochId() - 2);
                }
                if (startTime < firstPriceEpoch.timestamp) {
                    startTime = firstPriceEpoch.timestamp;
                }
                const targetPriceEpochs: number[] = priceEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                if (isEmpty(targetPriceEpochs) || (isNotEmpty(targetPriceEpochs) && targetPriceEpochs.length == 0)) {
                    resolve(null);
                    return;
                }
                await this.getPriceEpochs(network, startTime, endTime, 1, 0);
                const priceEpochsStats: EpochStats = await persistenceDao.getPriceEpochStats(targetPriceEpochs[0], targetPriceEpochs[targetPriceEpochs.length - 1]);
                resolve(priceEpochsStats);

            } catch (e) {
                this.logger.error(`Unable to get block number ranges by price epochs: ${e.message}`);
                reject(new Error('Unable to get block number ranges by price epochs.'));
            }
        })

    }
    async getPriceEpochsDto(network: NetworkEnum, startTime: number, endTime: number, page: number, pageSize: number, sortField?: EpochSortEnum, sortOrder?: SortOrderEnum): Promise<PaginatedResult<PriceEpochDTO[]>> {
        return new Promise<PaginatedResult<PriceEpochDTO[]>>(async (resolve, reject) => {
            try {
                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                let priceEpochs: PaginatedResult<PriceEpoch[]> = await this.getPriceEpochs(network, startTime, endTime, page, pageSize, sortField, sortOrder);
                let results: PriceEpochDTO[] = [];
                if (priceEpochs.results.length > 0) {
                    priceEpochs.results.map((priceEpoch, idx) => {
                        let priceEpochDTO: PriceEpochDTO = new PriceEpochDTO();
                        priceEpochDTO.id = priceEpoch.id;
                        if (idx == 0) {
                            priceEpochDTO.startTime = priceEpochSettings.getStartTimeForEpochId(priceEpoch.id);
                        } else {
                            priceEpochDTO.startTime = results[idx - 1].startTime + priceEpochSettings.priceEpochDurationMillis;
                        }
                        priceEpochDTO.endTime = priceEpochDTO.startTime + priceEpochSettings.priceEpochDurationMillis;
                        priceEpochDTO.revealEndTime = priceEpochDTO.endTime + priceEpochSettings.revealEpochDurationMillis;
                        results.push(priceEpochDTO);
                    });
                }
                let paginatedResults: PaginatedResult<PriceEpochDTO[]> = new PaginatedResult(priceEpochs.page, priceEpochs.pageSize, priceEpochs.sortField, priceEpochs.sortOrder, priceEpochs.numResults, []);
                paginatedResults.results = results
                resolve(paginatedResults);
                return;
            } catch (e) {
                this.logger.error(`Unable to get price epochs dto: ${e.message}`);
                reject(new Error('Unable to get price epochs dto.'));
            }
        });
    }

    async getCurrentPriceEpoch(network: NetworkEnum): Promise<PriceEpoch> {
        return new Promise<PriceEpoch>(async (resolve, reject) => {
            try {
                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                resolve(this.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId()));
                return;
            } catch (e) {
                this.logger.error(`Unable to get current price epoch: ${e.message}`);
                reject(new Error('Unable to get current price epoch.'));
            }
        });
    }
    async getCurrentPriceEpochDto(network: NetworkEnum): Promise<PriceEpochDTO> {
        return new Promise<PriceEpochDTO>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                const priceEpoch: PriceEpoch = await this.getCurrentPriceEpoch(network);
                if (isNotEmpty(priceEpoch)) {
                    resolve(new PriceEpochDTO(priceEpoch, priceEpochSettings));
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get current price epoch: ${e.message}`);
                reject(new Error('Unable to get current price epoch.'));
            }
        });
    }
    async getPriceEpochs(network: NetworkEnum, startTime: number, endTime: number, page: number, pageSize: number, sortField?: EpochSortEnum, sortOrder?: SortOrderEnum, requestId?: string, force?: boolean): Promise<PaginatedResult<PriceEpoch[]>> {
        return new Promise<PaginatedResult<PriceEpoch[]>>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                let expectedPriceEpochs: number[] = priceEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                const epochFrom: number = expectedPriceEpochs[0];
                const epochTo: number = expectedPriceEpochs[expectedPriceEpochs.length - 1];

                const priceEpochsStats: EpochStats = await persistenceDao.getPriceEpochStats(epochFrom, epochTo);
                if (expectedPriceEpochs.length == 0) {
                    resolve(new PaginatedResult(page, pageSize, sortField, sortOrder, 0, []));
                    return;
                }

                if (priceEpochsStats.count == expectedPriceEpochs.length) {
                    if (page > 0) {
                        resolve(persistenceDao.getPriceEpochs(epochFrom, epochTo, page, pageSize, sortField, sortOrder));
                    } else {
                        resolve(null);
                    }
                    return;
                }

                let epochStats: EpochStats = await this.getBlockNumberRangesByRewardEpochs(network, startTime, endTime, blockchainDao);
                if (epochStats == null) {
                    epochStats = new EpochStats();
                    epochStats.minBlockNumber = 0;
                    epochStats.maxBlockNumber = (await this.getRewardEpoch(network, 0)).blockNumber;
                }

                if (epochStats.maxEpochId == (await this.getCurrentRewardEpoch(network)).id) {
                    epochStats.maxBlockNumber = await blockchainDao.provider.getBlockNumber();
                }
                const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.PriceEpoch, null, epochStats.minBlockNumber, epochStats.maxBlockNumber);
                let missingBlocks: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, epochStats.minBlockNumber, epochStats.maxBlockNumber);
                if (missingBlocks.length == 0) {
                    if (pageSize > 0) {
                        let priceEpochs: PaginatedResult<PriceEpoch[]> = await persistenceDao.getPriceEpochs(epochFrom, epochTo, page, pageSize, sortField, sortOrder);
                        resolve(priceEpochs);
                    } else {
                        resolve(null);
                    }
                    if (persistenceMetadata.length > 5) {
                        await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.PriceEpoch, persistenceMetadata);
                    }
                    return;
                }
                if (missingBlocks.length > 0) {
                    let progressSubscription: Subscription = new Subscription();
                    if (isNotEmpty(requestId)) {
                        progressSubscription = ServiceUtils.monitorProgress(requestId, missingBlocks, blockchainDao, this._progressGateway);
                    }

                    for (let i in missingBlocks) {
                        const missingBlock: PersistenceMetadataScanInfo = missingBlocks[i];
                        await this.getPriceEpochsByBlockNumbers(network, missingBlock.from, missingBlock.to, persistenceDao, blockchainDao);
                    }
                    if (isNotEmpty(requestId)) {
                        progressSubscription.unsubscribe();
                    }
                    resolve(await this.getPriceEpochs(network, startTime, endTime, page, pageSize, sortField, sortOrder));
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get price epochs: ${e.message}`);
                reject(new Error('Unable to get price epochs.'));
            }
        });
    }
    async getPriceEpochsByBlockNumbers(network: NetworkEnum, blockFrom: number, blockTo: number, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<boolean> {
        this.logger.log(`${network} - Fetching price epochs - From block ${blockFrom} to ${blockTo}`);
        const blockchainData: PriceEpoch[] = await blockchainDao.getPriceEpochs(blockFrom, blockTo);
        if (blockchainData.length > 0) {
            await persistenceDao.storePriceEpoch(blockchainData);
        }
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.PriceEpoch, null, blockFrom, blockTo);
        return true;
    }
    async getPriceEpoch(network: NetworkEnum, priceEpochId: number): Promise<PriceEpoch> {
        return new Promise<PriceEpoch>(async (resolve, reject) => {
            try {
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: PriceEpoch = await cacheDao.getPriceEpoch(priceEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }

                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                const currentPriceEpochId: number = priceEpochSettings.getLastFinalizedEpochId();

                if (priceEpochId > currentPriceEpochId) {
                    reject(new Error(`Unable to retrieve price epoch data for ${priceEpochId} as it has not been finalized yet.`))
                }
                const priceEpochs: PaginatedResult<PriceEpoch[]> = await this.getPriceEpochs(network, priceEpochSettings.getStartTimeForEpochId(priceEpochId), priceEpochSettings.getEndTimeForEpochId(priceEpochId) + priceEpochSettings.revealEpochDurationMillis, 1, 1, EpochSortEnum.id, SortOrderEnum.desc);
                cacheDao.setPriceEpoch(priceEpochId, priceEpochs.results[0], new Date().getTime() + (60 * 30 * 1000));
                resolve(priceEpochs.results[0]);
                return;
            } catch (e) {
                this.logger.error(`Unable to get reward epoch: ${e.message}`);
                reject(new Error('Unable to get reward epoch.'));
            }
        });
    }
    async getFirstPriceEpoch(network: NetworkEnum): Promise<PriceEpoch> {
        return new Promise<PriceEpoch>(async (resolve, reject) => {
            try {
                if (isEmpty(this._firstPriceEpoch[network])) {
                    const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                    const priceEpochs: PaginatedResult<PriceEpoch[]> = await this.getPriceEpochs(network, priceEpochSettings.firstEpochStartTime, priceEpochSettings.getEndTimeForEpochId(10000), 1, 1);
                    this._firstPriceEpoch[network] = priceEpochs.results.slice(-1)[0];
                    resolve(this.getFirstPriceEpoch(network));
                    return;
                } else {
                    resolve(this._firstPriceEpoch[network]);
                }

            } catch (e) {
                this.logger.error(`Unable to get reward epoch: ${e.message}`);
                reject(new Error('Unable to get reward epoch.'));
            }
        });
    }
    async getPriceEpochDto(network: NetworkEnum, priceEpochId): Promise<PriceEpochDTO> {
        return new Promise<PriceEpochDTO>(async (resolve, reject) => {
            try {
                const priceEpochSettings: PriceEpochSettings = await this.getPriceEpochSettings(network);
                const priceEpoch: PriceEpoch = await this.getPriceEpoch(network, priceEpochId);
                if (isNotEmpty(priceEpoch)) {
                    resolve(new PriceEpochDTO(priceEpoch, priceEpochSettings));
                    return;
                } else {
                    resolve(null);
                    return;
                }
            } catch (e) {
                this.logger.error(`Unable to get price epoch: ${e.message}`);
                reject(new Error(e.message));
            }
        });
    }

}