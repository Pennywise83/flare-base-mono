import { ClaimedRewardsSortEnum, NetworkEnum, PaginatedResult, PriceEpoch, PriceEpochSettings, Reward, RewardDTO, RewardEpoch, RewardEpochDTO, RewardEpochSettings, SortOrderEnum } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty, isNotEmpty } from "class-validator";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { ClaimedRewardHistogramElement, ClaimedRewardsGroupByEnum } from "libs/commons/src/model/rewards/reward";
import { interval } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { EpochsService } from "../epochs/epochs.service";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ProgressGateway } from "../progress.gateway";
import { ServiceUtils } from "../service-utils";

@Injectable()
export class RewardsService {

    logger: Logger = new Logger(RewardsService.name);
    private _claimedRewardsList: { [network: string]: Array<Reward> } = {};
    private _lastBlockNumber: { [network: string]: number } = {};
    private _bootstraped: { [network: string]: boolean } = {};

    constructor(
        private readonly _configService: ConfigService,
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private readonly _epochsService: EpochsService,
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
                    await this._bootstrapClaimedRewardsScan(network, persistenceDao, blockchainDao);
                    await this._startClaimedRewardsListener(network, persistenceDao, blockchainDao, networkConfig);
                }
            }
            this.logger.log(`Initialized.`);
            return;
        } catch (err) {
            throw new Error(`Unable to initialize DelegationService: ${err.message}`);
        }
    }
    private async _bootstrapClaimedRewardsScan(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Starting claimed rewards scan bootstrap...`);
        this._bootstraped[network] = false;
        const startTime: number = new Date().getTime();
        const firstPriceEpoch: PriceEpoch = await this._epochsService.getFirstPriceEpoch(network);
        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
        const rewardEpochsSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const paginatedRewardEpochs: PaginatedResult<RewardEpoch[]> = await this._epochsService.getRewardEpochs(network, rewardEpochsSettings.firstEpochStartTime, new Date().getTime(), 1, 10000, EpochSortEnum.id, SortOrderEnum.asc);
        const rewardEpochs: RewardEpoch[] = paginatedRewardEpochs.results;
        for (let i = 0; i < rewardEpochs.length; i++) {
            const rewardEpoch = rewardEpochs[i];
            if (rewardEpoch.timestamp > firstPriceEpoch.timestamp) {
                this.logger.log(`${network} - Fetching claimed rewards for rewardEpoch ${rewardEpoch.id}`);
                const fromTimestamp: number = rewardEpochs[i - 1].timestamp;
                const toTimestamp: number = rewardEpoch.timestamp + priceEpochSettings.priceEpochDurationMillis + priceEpochSettings.revealEpochDurationMillis;
                if (fromTimestamp < rewardEpoch.timestamp) {
                    await this.getRewards(network, null, null, null, fromTimestamp, toTimestamp, 1, 0);
                }
            }
        }

        const actualBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        const persistenceMetadata = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, null, firstPriceEpoch.blockNumber, actualBlockNumber);
        const missingDelegationsBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, firstPriceEpoch.blockNumber, actualBlockNumber);

        for (const missingBlockNumbers of missingDelegationsBlockNumbers) {
            await this.getRewardsByBlockNumbers(network, null, missingBlockNumbers.from, missingBlockNumbers.to, blockchainDao, persistenceDao, null);
        }
        const durationInSeconds = (new Date().getTime() - startTime) / 1000;
        this._bootstraped[network] = true;
        this.logger.log(`${network} - Claimed rewards scan bootstrap finished. Duration: ${durationInSeconds} s`);
    }

    private async _startClaimedRewardsListener(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, networkConfig: NetworkConfig): Promise<void> {
        this._lastBlockNumber[network] = await blockchainDao.provider.getBlockNumber();
        if (!this._claimedRewardsList[network]) {
            this._claimedRewardsList[network] = [];
        }
        blockchainDao.claimedRewardsListener$.subscribe(claimedReward => {
            this._claimedRewardsList[network].push(claimedReward);
        });

        this.logger.log(`${network} - Initializing claimed rewards listener. Collect items every ${networkConfig.collectBlockchainDataIntervalSeconds} seconds`);
        interval(networkConfig.collectBlockchainDataIntervalSeconds * 1000).subscribe(async () => {
            const lastBlockNumber: number = await blockchainDao.provider.getBlockNumber();
            await this._storeClaimedRewards(network, persistenceDao, lastBlockNumber);
            await this._consistencyCheck(network, persistenceDao, blockchainDao, lastBlockNumber);
        });

        await blockchainDao.startClaimedRewardsListener();
        return;
    }

    private async _consistencyCheck(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, actualBlockNumber: number): Promise<void> {
        if (this._bootstraped[network]) {
            const firstPriceEpoch: PriceEpoch = await this._epochsService.getFirstPriceEpoch(network);
            const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, 'all', firstPriceEpoch.blockNumber, actualBlockNumber);
            const missingRewardEpochBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, firstPriceEpoch.blockNumber, actualBlockNumber);
            if (missingRewardEpochBlockNumbers.length > 0) {
                for (const missingBlockNumbers of missingRewardEpochBlockNumbers) {
                    await this.getRewardsByBlockNumbers(network, null, missingBlockNumbers.from, missingBlockNumbers.to, blockchainDao, persistenceDao, null);
                }
            } else {
                if (persistenceMetadata.length > 5) {
                    await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Reward, persistenceMetadata);
                }
            }
        }
        return;
    }

    private async _storeClaimedRewards(network: NetworkEnum, persistenceDao: IPersistenceDao, lastBlockNumber: number) {
        const claimedRewardsToLoad: Reward[] = [...this._claimedRewardsList[network]];
        this._claimedRewardsList[network] = [];
        const numClaimedRewards = claimedRewardsToLoad.length;
        this.logger.log(`${network} - Collected ${numClaimedRewards} claimed rewards from listener`);

        let startBlock: number;
        const minListenerBlock: number = Math.min(...claimedRewardsToLoad.map(d => d.blockNumber));
        const maxListenerBlock: number = Math.max(...claimedRewardsToLoad.map(d => d.blockNumber));

        if (isNotEmpty(this._lastBlockNumber[network])) {
            startBlock = Math.min(this._lastBlockNumber[network], minListenerBlock);
        } else {
            startBlock = minListenerBlock;
        }
        const endBlock: number = Math.max(maxListenerBlock, lastBlockNumber);

        const stored: number = await persistenceDao.storeClaimedRewards(claimedRewardsToLoad);

        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, null, startBlock, endBlock);
        this._lastBlockNumber[network] = lastBlockNumber;
        this.logger.debug(`${network} - Stored ${stored} claimed rewards from listener`);
    }

    async getRewardsDto(network: NetworkEnum, whoClaimed: string, dataProvider: string, sentTo: string, startTime: number, endTime: number, page: number, pageSize: number, sortField?: ClaimedRewardsSortEnum, sortOrder?: SortOrderEnum, requestId?: string): Promise<PaginatedResult<RewardDTO[]>> {
        return new Promise<PaginatedResult<RewardDTO[]>>(async (resolve, reject) => {
            try {
                const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                const priceEpochEndTime: number = priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getLastFinalizedEpochId());
                const claimedRewards: PaginatedResult<Reward[]> = await this.getRewards(network, whoClaimed, dataProvider, sentTo, startTime, priceEpochEndTime, page, pageSize, sortField, sortOrder, requestId)
                let paginatedResults: PaginatedResult<RewardDTO[]> = new PaginatedResult<RewardDTO[]>(claimedRewards.page, claimedRewards.pageSize, claimedRewards.sortField, claimedRewards.sortOrder, claimedRewards.numResults, []);
                if (claimedRewards.numResults == 0) {
                    resolve(paginatedResults);
                    return;
                }
                const rewardEpochFrom: number = Math.min(...claimedRewards.results.map(r => r.rewardEpochId));
                const rewardEpochStartTime = (await this._epochsService.getRewardEpochSettings(network)).getStartTimeForEpochId(rewardEpochFrom);
                const rewardEpochTo: number = Math.max(...claimedRewards.results.map(r => r.rewardEpochId));
                const rewardEpochEndTime = (await this._epochsService.getRewardEpochSettings(network)).getEndTimeForEpochId(rewardEpochTo);
                const paginatedRewardEpochs: PaginatedResult<RewardEpochDTO[]> = await this._epochsService.getRewardEpochsDto(network, rewardEpochStartTime, rewardEpochEndTime, 1, 10000, EpochSortEnum.id, SortOrderEnum.desc);
                const rewardEpochs: RewardEpochDTO[] = paginatedRewardEpochs.results;
                claimedRewards.results.forEach(claimedReward => {
                    paginatedResults.results.push(new RewardDTO(claimedReward, rewardEpochs.filter(rewardEpoch => rewardEpoch.id == claimedReward.rewardEpochId)[0]));
                });
                resolve(paginatedResults);
                return;
            } catch (e) {
                this.logger.error(`${network} - Unable to get claimed rewards dto for address ${whoClaimed}: ${e.message}`);
                reject(new Error(`${network} - Unable to get claimed rewards dto for address ${whoClaimed}.`));
            }
        });
    }
    async getRewards(network: NetworkEnum, whoClaimed: string, dataProvider: string, sentTo: string, startTime: number, endTime: number, page: number, pageSize: number, sortField?: ClaimedRewardsSortEnum, sortOrder?: SortOrderEnum, requestId?: string): Promise<PaginatedResult<Reward[]>> {
        let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
        try {
            if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                throw new Error(`Service unavailable`);
            }
            const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
            let persistenceMetadata: PersistenceMetadata[] = [];
            let missingBlocks: PersistenceMetadataScanInfo[] = [];
            if (isNotEmpty(whoClaimed)) {
                persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, whoClaimed, epochStats.minBlockNumber, epochStats.maxBlockNumber));
                missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, epochStats.minBlockNumber, epochStats.maxBlockNumber))

            }
            if (isNotEmpty(dataProvider)) {
                persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, dataProvider, epochStats.minBlockNumber, epochStats.maxBlockNumber));
                missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, epochStats.minBlockNumber, epochStats.maxBlockNumber))
            }
            if (isNotEmpty(sentTo)) {
                persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, sentTo, epochStats.minBlockNumber, epochStats.maxBlockNumber));
                missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, epochStats.minBlockNumber, epochStats.maxBlockNumber))
            }
            if (isEmpty(whoClaimed) && isEmpty(dataProvider) && isEmpty(sentTo)) {
                persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Reward, null, epochStats.minBlockNumber, epochStats.maxBlockNumber));
                missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, epochStats.minBlockNumber, epochStats.maxBlockNumber))
            }

            if (missingBlocks.length > 0) {
                for (const missingRewardBlockNumber of missingBlocks) {
                    this.logger.log(`${network} - Fetching claimed rewards - From block ${missingRewardBlockNumber.from} to ${missingRewardBlockNumber.to} - Size: ${missingRewardBlockNumber.to - missingRewardBlockNumber.from}`);
                    const blockchainData: Reward[] = [];
                    if (isNotEmpty(whoClaimed)) {
                        blockchainData.push(...await blockchainDao.getClaimedRewards(whoClaimed, missingRewardBlockNumber.from, missingRewardBlockNumber.to));
                    }
                    if (isNotEmpty(dataProvider)) {
                        blockchainData.push(...await blockchainDao.getClaimedRewards(dataProvider, missingRewardBlockNumber.from, missingRewardBlockNumber.to));
                    }
                    if (isNotEmpty(sentTo)) {
                        blockchainData.push(...await blockchainDao.getClaimedRewards(sentTo, missingRewardBlockNumber.from, missingRewardBlockNumber.to));
                    }
                    if (isEmpty(whoClaimed) && isEmpty(dataProvider) && isEmpty(sentTo)) {
                        blockchainData.push(...await blockchainDao.getClaimedRewards(null, missingRewardBlockNumber.from, missingRewardBlockNumber.to));
                    }
                    if (blockchainData.length > 0) {
                        await persistenceDao.storeClaimedRewards(blockchainData);
                    }
                    if (isNotEmpty(whoClaimed)) {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, whoClaimed, missingRewardBlockNumber.from, missingRewardBlockNumber.to);
                    }
                    if (isNotEmpty(dataProvider)) {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, dataProvider, missingRewardBlockNumber.from, missingRewardBlockNumber.to);
                    }
                    if (isNotEmpty(sentTo)) {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, sentTo, missingRewardBlockNumber.from, missingRewardBlockNumber.to);
                    }
                    if (isEmpty(whoClaimed) && isEmpty(dataProvider) && isEmpty(sentTo)) {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, null, missingRewardBlockNumber.from, missingRewardBlockNumber.to);
                    }
                }
                return this.getRewards(network, whoClaimed, dataProvider, sentTo, startTime, endTime, page, pageSize, sortField!, sortOrder!);
            }
            if (missingBlocks.length == 0) {
                let daoData: PaginatedResult<Reward[]> = new PaginatedResult<Reward[]>(page, pageSize, sortField, sortOrder, 0, []);
                persistenceMetadata = new PersistenceMetadata().removeDuplicates(persistenceMetadata);
                if (pageSize > 0) {
                    daoData = await persistenceDao.getClaimedRewards(whoClaimed, dataProvider, sentTo, epochStats.minBlockNumber, epochStats.maxBlockNumber, page, pageSize, sortField!, sortOrder!);
                }
                if (persistenceMetadata.length > 5) {
                    await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Reward, persistenceMetadata);
                }
                return daoData;
            }
        } catch (e) {
            this.logger.error(`${network} - Unable to get claimed rewards for address ${whoClaimed}: ${e.message}`);
            throw new Error(`${network} - Unable to get claimed rewards for address ${whoClaimed}.`);
        }
    }

    private async getRewardsByBlockNumbers(network: NetworkEnum, address: string, blockFrom: number, blockTo: number, blockchainDao: IBlockchainDao, persistenceDao: IPersistenceDao, requestId: string) {
        this.logger.log(`${network} - Fetching claimed rewards for ${isNotEmpty(address) ? address : '*'} - From block ${blockFrom} to ${blockTo} - Size: ${blockTo - blockFrom}`);
        const blockchainData: Reward[] = await blockchainDao.getClaimedRewards(address, blockFrom, blockTo, requestId);
        if (blockchainData.length > 0) {
            await persistenceDao.storeClaimedRewards(blockchainData);
        }
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Reward, address, blockFrom, blockTo);
    }

    getClaimedRewardsHistogram(network: NetworkEnum, whoClaimed: string, dataProvider: string, startTime: number, endTime: number, groupBy: ClaimedRewardsGroupByEnum, aggregationInterval?: string): Promise<ClaimedRewardHistogramElement[]> {
        return new Promise<ClaimedRewardHistogramElement[]>(async (resolve, reject) => {
            let blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                await this.getRewards(network, whoClaimed, dataProvider, null, startTime, endTime, 1, 0);
                const daoData: ClaimedRewardHistogramElement[] = await persistenceDao.getClaimedRewardsHistogram(whoClaimed, dataProvider, startTime, endTime, groupBy, aggregationInterval);
                if (groupBy == ClaimedRewardsGroupByEnum.rewardEpochId) {
                    const rewardEpochs: RewardEpochDTO[] = (await this._epochsService.getRewardEpochsDto(network,startTime,endTime,1,10000)).results;
                    daoData.map(data => {
                        const tmpRewardEpoch: RewardEpochDTO = rewardEpochs.find(rewardEpoch => rewardEpoch.id == data.rewardEpochId);
                        if (isNotEmpty(tmpRewardEpoch)) {
                            data.timestamp = tmpRewardEpoch.startTime;
                        }
                    });
                }
                resolve(daoData);
                return;
            } catch (e) {
                this.logger.error(`${network} - Unable to get claimed rewards date histogram: ${e.message}`);
                if (e.name == 'tooBigException') {
                    reject(new Error(`${network} - Unable to get claimed rewards date histogram: ${e.message}`));
                } else {
                    reject(new Error(`${network} - Unable to get claimed rewards date histogram.`));
                }

            }
        });
    }
}