import { Commons, DataProviderExtendedInfo, DataProviderInfo, DataProviderRewardStats, DataProviderRewardStatsGroupByEnum, FtsoFee, FtsoFeeSortEnum, HashSubmitted, HashSubmittedRealTimeData, HashSubmittedSortEnum, IRealTimeData, NetworkEnum, PaginatedResult, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceFinalizedRealTimeData, PriceFinalizedSortEnum, PriceRevealed, PriceRevealedRealTimeData, PriceRevealedSortEnum, RealTimeDataTypeEnum, RealTimeFtsoData, RewardDistributedRealTimeData, RewardEpoch, RewardEpochDTO, RewardEpochSettings, SortOrderEnum, VotePower, VotePowerDTO, VoterWhitelist, WebsocketTopicsEnum } from "@flare-base/commons";
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty, isNotEmpty } from "class-validator";
import * as fs from 'fs';
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { DataProviderSubmissionStats } from "libs/commons/src/model/ftso/data-provider-submission-stats";
import { RewardDistributed, RewardDistributedSortEnum } from "libs/commons/src/model/ftso/reward-distributed";
import * as path from 'path';
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { BalancesService } from "../balances/balances.service";
import { DelegationsService } from "../delegations/delegations.service";
import { EpochsService } from "../epochs/epochs.service";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ProgressGateway } from "../progress.gateway";
import { ServiceUtils } from "../service-utils";
import { TowoLabsDataProviderInfo } from "./model/towo-data-provider-info";

@Injectable()
export class FtsoService {
    logger: Logger = new Logger(FtsoService.name);
    private _priceFinalizedList: { [network: string]: { [priceEpoch: number]: { [symbol: string]: PriceFinalized } } } = {};
    private _priceRevealedList: { [network: string]: { [priceEpoch: number]: { [symbol: string]: PriceRevealed[] } } } = {};
    private _hashSubmittedList: { [network: string]: { [priceEpoch: number]: HashSubmitted[] } } = {};
    private _rewardDistributedList: { [network: string]: { [priceEpoch: number]: RewardDistributed[] } } = {};
    private _voterWhitelistList: { [network: string]: VoterWhitelist[] } = {};
    private _ftsoFeeList: { [network: string]: FtsoFee[] } = {};
    private _ftsoFees: { [network: string]: FtsoFee[] } = {};
    private _lastRewardEpochs: { [network: string]: RewardEpochDTO[] } = {};
    private _lastBlockNumber: { [network: string]: number } = {};

    constructor(
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private _configService: ConfigService,
        private _epochsService: EpochsService,
        private _balanceService: BalancesService,
        private _delegationsService: DelegationsService,
        private readonly _realTimeFtsoDataGateway: ProgressGateway,
        private readonly httpService: HttpService
    ) {

    }

    async initialize(): Promise<void> {
        try {
            this.logger.log(`Initializing...`);
            const availableNetworks: NetworkEnum[] = await this._networkDaoDispatcher.getAvailableNetworks();
            const networkConfigurations: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
            for (const network of availableNetworks) {
                const networkConfig = networkConfigurations.find(nConfig => nConfig.name === network);
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (networkConfig && networkConfig.scanActive) {
                    await this._bootstrapFtsoScan(network, persistenceDao, blockchainDao);
                    await this._startFtsoListeners(network, persistenceDao, blockchainDao, cacheDao, networkConfig);
                }
            }
            this.logger.log(`Initialized.`);
            return;
        } catch (err) {
            throw new Error(`Unable to initialize FtsoService: ${err.message}`);
        }
    }

    private async _bootstrapFtsoScan(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Starting ftso scan bootstrap...`);
        const startTime: number = new Date().getTime();
        const rewardEpochsSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const rewardEpochs: RewardEpoch[] = (await this._epochsService.getRewardEpochs(network, rewardEpochsSettings.firstEpochStartTime, new Date().getTime(), 1, 10000, EpochSortEnum.id, SortOrderEnum.asc)).results;

        let rewardEpochIdx: number = 0;
        for (let rewardEpoch of rewardEpochs) {
            let rewardEpochStartBlock: number = 0;
            let rewardEpochEndBlock: number = 0;
            if (rewardEpochIdx == 0) {
                rewardEpochStartBlock = 0;
                rewardEpochEndBlock = rewardEpoch.blockNumber;
            } else {
                rewardEpochStartBlock = rewardEpochs[rewardEpochIdx - 1].blockNumber;
                rewardEpochEndBlock = rewardEpoch.blockNumber;
            }
            this.logger.log(`${network} - Fetching voterWhitelist for rewardEpoch ${rewardEpoch.id}`);
            await this.getVoterWhitelist(network, null, rewardEpochEndBlock, 0);
            this.logger.log(`${network} - Fetching ftso fees for rewardEpoch ${rewardEpoch.id} `);
            await this.getFtsoFee(network, rewardEpochEndBlock, null, null, null, false);
            this.logger.log(`${network} - Fetching ftso rewards distributed for rewardEpoch ${rewardEpoch.id}`);
            await this.getRewardsDistributed(network, null, null, rewardEpochStartBlock, rewardEpochEndBlock, 1, 0);
            this.logger.verbose(`${network} - Fetching  finalized prices for rewardEpoch ${rewardEpoch.id}`);
            await this.getFinalizedPrices(network, null, rewardEpochStartBlock, rewardEpochEndBlock, 1, 0);
            this.logger.verbose(`${network} - Fetching revealed prices for rewardEpoch ${rewardEpoch.id}`);
            await this.getRevealedPrices(network, null, null, rewardEpochStartBlock, rewardEpochEndBlock, 1, 0);
            rewardEpochIdx++;
        }

        let actualBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        let voterWhitelistPersistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.VoterWhitelist, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingVoterWhitelistBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(voterWhitelistPersistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingVoterWhitelistBlockNumbers) {
            this.logger.log(`${network} - Fetching latest voter whitelist`);
            await this.getVoterWhitelist(network, null, missingBlockNumbers.to, 0);
        }

        let ftsoFeePersistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FtsoFee, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingFtsoFeeBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(ftsoFeePersistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingFtsoFeeBlockNumbers) {
            this.logger.log(`${network} - Fetching latest ftso fees`);
            await this.getFtsoFee(network, missingBlockNumbers.to, null, null, null, false);
        }

        let rewardDistributedPersistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FtsoFee, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingRewardDistributedBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(rewardDistributedPersistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingRewardDistributedBlockNumbers) {
            this.logger.log(`${network} - Fetching latest rewards distributed`);
            await this.getRewardsDistributed(network, null, null, missingBlockNumbers.from, missingBlockNumbers.to, 1, 0);
        }
        let finalizedPricesPersistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FinalizedPrice, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingFinalizedPricesBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(finalizedPricesPersistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingFinalizedPricesBlockNumbers) {
            this.logger.log(`${network} - Fetching latest finalized prices`);
            await this.getFinalizedPrices(network, null, missingBlockNumbers.from, missingBlockNumbers.to, 1, 0);
        }

        let revealedPricesPersistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RevealedPrice, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingRevealedPricesBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(revealedPricesPersistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingRevealedPricesBlockNumbers) {
            this.logger.log(`${network} - Fetching latest revealed prices`);
            await this.getRevealedPrices(network, null, null, missingBlockNumbers.from, missingBlockNumbers.to, 1, 0);
        }
        if (isEmpty(this._ftsoFees[network])) {
            this._ftsoFees[network] = await this.getFtsoFee(network, await blockchainDao.provider.getBlockNumber(), null, FtsoFeeSortEnum.timestamp, SortOrderEnum.desc, true);
        }
        if (isEmpty(this._lastBlockNumber[network])) {
            const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
            this._lastRewardEpochs[network] = [
                await this._epochsService.getRewardEpochDto(network, rewardEpochSettings.getCurrentEpochId() - 2),
                await this._epochsService.getRewardEpochDto(network, rewardEpochSettings.getCurrentEpochId() - 1),
                await this._epochsService.getRewardEpochDto(network, rewardEpochSettings.getCurrentEpochId())
            ]
        }
        this.logger.log(`${network} - Ftso scan bootstrap finished. Duration: ${(new Date().getTime() - startTime) / 1000} s`);
        return;
    }
    private async _startFtsoListeners(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, cacheDao: ICacheDao, networkConfig: NetworkConfig): Promise<void> {
        try {
            this.logger.log(`${network} - Initializing Ftso Prices listener.`);
            this._lastBlockNumber[network] = await blockchainDao.provider.getBlockNumber();
            if (isEmpty(this._priceRevealedList[network])) { this._priceRevealedList[network] = {} }
            if (isEmpty(this._priceFinalizedList[network])) { this._priceFinalizedList[network] = {} }
            if (isEmpty(this._hashSubmittedList[network])) { this._hashSubmittedList[network] = {} }
            if (isEmpty(this._rewardDistributedList[network])) { this._rewardDistributedList[network] = {} }
            if (isEmpty(this._voterWhitelistList[network])) { this._voterWhitelistList[network] = [] }
            if (isEmpty(this._ftsoFeeList[network])) { this._ftsoFeeList[network] = [] }

            blockchainDao.priceEpochListener$.subscribe(async priceEpoch => {
                this.logger.log(`${network} - ${priceEpoch.id} - Price epoch finalized.`);
                const lastBlockNumber: number = await blockchainDao.provider.getBlockNumber();
                await this._storeListenerEvents(network, priceEpoch, persistenceDao, blockchainDao, lastBlockNumber);
            });

            blockchainDao.pricesRevealedListener$.subscribe(async priceRevealed => {
                if (isEmpty(this._priceRevealedList[network][priceRevealed.epochId])) { this._priceRevealedList[network][priceRevealed.epochId] = {} }
                if (isEmpty(this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol])) { this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol] = [] }
                this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol].push(priceRevealed);
                await cacheDao.pushRealTimeFtsoData(priceRevealed);
                (priceRevealed as PriceRevealedRealTimeData).type = RealTimeDataTypeEnum.revealedPrice;
                this._realTimeFtsoDataGateway.server.emit(`${WebsocketTopicsEnum.REAL_TIME_FTSO_DATA.toString()}_${network}`, priceRevealed);
            });

            blockchainDao.pricesFinalizedListener$.subscribe(async priceFinalized => {
                if (isEmpty(this._priceFinalizedList[network][priceFinalized.epochId])) { this._priceFinalizedList[network][priceFinalized.epochId] = {} }
                if (isEmpty(this._priceFinalizedList[network][priceFinalized.epochId][priceFinalized.symbol])) { this._priceFinalizedList[network][priceFinalized.epochId][priceFinalized.symbol] = priceFinalized }
                await cacheDao.pushRealTimeFtsoData(priceFinalized);
                (priceFinalized as PriceFinalizedRealTimeData).type = RealTimeDataTypeEnum.finalizedPrice;
                this._realTimeFtsoDataGateway.server.emit(`${WebsocketTopicsEnum.REAL_TIME_FTSO_DATA.toString()}_${network}`, priceFinalized);
            });

            blockchainDao.hashSubmittedListener$.subscribe(async hashSubmitted => {
                if (isEmpty(this._hashSubmittedList[network][hashSubmitted.epochId])) { this._hashSubmittedList[network][hashSubmitted.epochId] = [] }
                this._hashSubmittedList[network][hashSubmitted.epochId].push(hashSubmitted);
                await cacheDao.pushRealTimeFtsoData(hashSubmitted);
                (hashSubmitted as HashSubmittedRealTimeData).type = RealTimeDataTypeEnum.hashSubmitted;
                this._realTimeFtsoDataGateway.server.emit(`${WebsocketTopicsEnum.REAL_TIME_FTSO_DATA.toString()}_${network}`, hashSubmitted);
            });

            blockchainDao.rewardDistributedListener$.subscribe(async rewardDistributed => {
                if (isEmpty(this._rewardDistributedList[network][rewardDistributed.priceEpochId])) { this._rewardDistributedList[network][rewardDistributed.priceEpochId] = [] }
                this._rewardDistributedList[network][rewardDistributed.priceEpochId].push(rewardDistributed);
                this._calculateProviderReward(rewardDistributed, this._ftsoFees[network], this._lastRewardEpochs[network]);
                await cacheDao.pushRealTimeFtsoData(rewardDistributed);
                (rewardDistributed as RewardDistributedRealTimeData).type = RealTimeDataTypeEnum.rewardDistributed;
                this._realTimeFtsoDataGateway.server.emit(`${WebsocketTopicsEnum.REAL_TIME_FTSO_DATA.toString()}_${network}`, rewardDistributed);
            });

            blockchainDao.voterWhitelistListener$.subscribe(async voterWhitelist => {
                if (isEmpty(this._voterWhitelistList[network])) { this._voterWhitelistList[network] = [] }
                this._voterWhitelistList[network].push(voterWhitelist);
            });

            blockchainDao.ftsoFeeListener$.subscribe(async ftsoFee => {
                if (isEmpty(this._ftsoFeeList[network])) { this._ftsoFeeList[network] = [] }
                this._ftsoFeeList[network].push(ftsoFee);
            });
            blockchainDao.rewardEpochListener$.subscribe(async rewardEpoch => {
                if (!this._lastRewardEpochs[network]) { this._lastRewardEpochs[network] = [] }
                this._lastRewardEpochs[network].push(await this._epochsService.getRewardEpochDto(network, rewardEpoch.id));
                if (this._lastRewardEpochs[network].length > 5) {
                    this._lastRewardEpochs[network] = this._lastRewardEpochs[network].slice(2);
                }
            });


            await blockchainDao.startPriceFinalizedListener();
            await blockchainDao.startPricesRevealedListener();
            await blockchainDao.startHashSubmittedListener();
            await blockchainDao.startRewardDistributedListener();
            await blockchainDao.startVoterWhitelistListener();
            await blockchainDao.startFtsoFeeListener();
            await blockchainDao.startRewardEpochListener();

            return Promise.resolve();
        } catch (err) {
            throw new Error(`Unable to initialize FtsoService: ${err.message}`);
        }

    }

    async getFtsoFeeByRewardEpoch(network: NetworkEnum, rewardEpochId: number, address?: string, sortField?: FtsoFeeSortEnum, sortOrder?: SortOrderEnum, returnResults?: boolean): Promise<FtsoFee[]> {
        try {
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                throw new Error(`Service unavailable`);
            }
            const cacheData: FtsoFee[] = await cacheDao.getFtsoFee(rewardEpochId);
            if (isNotEmpty(cacheData)) {
                if (sortField) {
                    cacheData.sort((a, b) => {
                        const aValue = a[sortField] as any;
                        const bValue = b[sortField] as any;
                        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
                    });
                }
                if (isNotEmpty(address)) {
                    return cacheData.filter(ftsoFee => ftsoFee.dataProvider == address);
                } else {
                    return cacheData;
                }
            }

            const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
            const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
            const ftsoFee: FtsoFee[] = await this.getFtsoFee(network, rewardEpoch.blockNumber, address, sortField, sortOrder, true);
            if (rewardEpochId == rewardEpochSettings.getCurrentEpochId()) {
                const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                await cacheDao.setFtsoFee(rewardEpochId, ftsoFee, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
            } else {
                await cacheDao.setFtsoFee(rewardEpochId, ftsoFee);
            }
            return ftsoFee;
        } catch (e) {
            this.logger.error(`Unable to get ftso fee for reward epoch ${rewardEpochId} and address: ${isNotEmpty(address) ? address : '*'}: ${e.message}`);
            throw new Error(`Unable to get ftso fee for reward epoch ${rewardEpochId} and address: ${isNotEmpty(address) ? address : '*'}`);
        }

    }
    async getFtsoFee(network: NetworkEnum, targetBlock: number, address?: string, sortField?: FtsoFeeSortEnum, sortOrder?: SortOrderEnum, returnResults?: boolean): Promise<FtsoFee[]> {
        try {
            const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

            if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                throw new Error(`Service unavailable`);
            }

            let missingBlocks: PersistenceMetadataScanInfo[] = [];
            let persistenceMetadata: PersistenceMetadata[] = [];
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FtsoFee, null, 0, targetBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, targetBlock))
            if (missingBlocks.length > 0) {
                for (const missingFtsoFeeBlockNumber of missingBlocks) {
                    this.logger.log(`${network} - Fetching ftso fee percentage - From block ${missingFtsoFeeBlockNumber.from} to ${missingFtsoFeeBlockNumber.to} - Size: ${missingFtsoFeeBlockNumber.to - missingFtsoFeeBlockNumber.from}`);
                    let blockchainData: FtsoFee[] = [];
                    blockchainData.push(...await blockchainDao.getFtsoFee(null, missingFtsoFeeBlockNumber.from, missingFtsoFeeBlockNumber.to))
                    if (blockchainData.length > 0) {
                        await persistenceDao.storeFtsoFee(blockchainData);
                    }
                    if (isNotEmpty(address)) {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FtsoFee, address, missingFtsoFeeBlockNumber.from, missingFtsoFeeBlockNumber.to);
                    } else {
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FtsoFee, null, missingFtsoFeeBlockNumber.from, missingFtsoFeeBlockNumber.to);
                    }
                }
                return this.getFtsoFee(network, targetBlock, address, sortField, sortOrder, returnResults);
            }
            if (missingBlocks.length === 0) {
                if (returnResults) {
                    let daoData: FtsoFee[] = await persistenceDao.getFtsoFee(targetBlock, null, sortField, sortOrder);
                    if (persistenceMetadata.length > 5) {
                        await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.FtsoFee, persistenceMetadata);
                    }
                    if (isNotEmpty(address)) {
                        return daoData.filter(ftsoFee => ftsoFee.dataProvider == address);
                    } else {
                        return daoData;
                    }
                } else {
                    return [];
                }
            }
            throw new Error(`Unable to get ftso fee address: ${isNotEmpty(address) ? address : '*'}`);
        } catch (e) {
            this.logger.error(`Unable to get ftso fee for address: ${isNotEmpty(address) ? address : '*'}: ${e.message}`);
            throw new Error(`Unable to get ftso fee for address: ${isNotEmpty(address) ? address : '*'}`);
        }
    }
    async getFtsoFeeHistory(network: NetworkEnum, address: string): Promise<FtsoFee[]> {
        try {
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
                throw new Error(`Service unavailable`);
            }
            const currentRewardEpoch: RewardEpoch = await this._epochsService.getCurrentRewardEpoch(network);
            await this.getFtsoFee(network, currentRewardEpoch.blockNumber, address, null, null, false);
            return await persistenceDao.getFtsoFeeHistory(address);
        } catch (e) {
            this.logger.error(`Unable to get ftso fee for address: ${isNotEmpty(address) ? address : '*'}: ${e.message}`);
            throw new Error(`Unable to get ftso fee for address: ${isNotEmpty(address) ? address : '*'}`);
        }
    }

    async getVoterWhitelistByAddress(network: NetworkEnum, address: string, targetTime: number): Promise<VoterWhitelist[]> {
        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, priceEpochSettings.firstEpochStartTime, targetTime);
        if (isNotEmpty(epochStats)) {
            const epochBlockNumberTo: number = epochStats.maxBlockNumber;
            return await this.getVoterWhitelist(network, address, epochBlockNumberTo, 1);
        } else {
            return [];
        }
    }
    async getVoterWhitelistByCurrency(network: NetworkEnum, currency: string, targetTime: number): Promise<VoterWhitelist[]> {
        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, priceEpochSettings.firstEpochStartTime, targetTime);
        if (isNotEmpty(epochStats)) {
            const epochBlockNumberTo: number = epochStats.maxBlockNumber;
            return (await this.getVoterWhitelist(network, null, epochBlockNumberTo, 1)).filter(vw => vw.symbol == currency);
        } else {
            return [];
        }

    }
    async getWhitelistedDataProvidersAddresses(network: NetworkEnum, whitelisted: boolean, rewardEpochId: number): Promise<string[]> {
        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const nextEpochId: number = rewardEpochSettings.getNextEpochId();
        let targetBlockNumber: number = 0;
        if (rewardEpochId == nextEpochId) {
            const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
            const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
            targetBlockNumber = lastFinalizedPriceEpoch.blockNumber;
        } else {
            const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
            targetBlockNumber = rewardEpoch.blockNumber;

        }

        if (targetBlockNumber > 0) {
            const addresses: string[] = (await this.getVoterWhitelist(network, null, targetBlockNumber, 1)).filter(vw => vw.whitelisted == whitelisted).map(vw => vw.address);
            return [... new Set(addresses)];
        } else {
            return [];
        }
    }
    async getVoterWhitelist(network: NetworkEnum, address: string, targetBlockNumber: number, pageSize: number): Promise<VoterWhitelist[]> {
        return new Promise<VoterWhitelist[]>(async (resolve, reject) => {
            try {
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.VoterWhitelist, address, 0, targetBlockNumber);
                const missingBlocks: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, targetBlockNumber);
                if (missingBlocks.length > 0) {
                    for (const missingBalanceBlockNumber of missingBlocks) {
                        this.logger.log(`${network} - Fetching voter whitelist for address:'${isNotEmpty(address) ? address : '*'}'  - From block ${missingBalanceBlockNumber.from} to ${missingBalanceBlockNumber.to} - Size: ${missingBalanceBlockNumber.to - missingBalanceBlockNumber.from}`);
                        const blockchainData: VoterWhitelist[] = await blockchainDao.getVoterWhitelist(missingBalanceBlockNumber.from, missingBalanceBlockNumber.to);
                        await persistenceDao.storeVoterWhitelist(blockchainData);
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.VoterWhitelist, address, missingBalanceBlockNumber.from, missingBalanceBlockNumber.to);
                    }
                    resolve(this.getVoterWhitelist(network, address, targetBlockNumber, pageSize));
                }

                if (pageSize > 0) {
                    if (persistenceMetadata.length > 5) {
                        await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.VoterWhitelist, persistenceMetadata);
                    }
                    resolve(await persistenceDao.getVoterWhitelist(address, targetBlockNumber));
                } else {
                    resolve([]);
                }
            } catch (e) {
                this.logger.error(`Unable to get voter whitelist. Address: ${isNotEmpty(address) ? address : '*'} - Target blockNumber: ${targetBlockNumber}: `, e.message);
                reject(new Error(`Unable to get voter whitelist`));
            }

        });
    }

    private async _storeListenerEvents(network: NetworkEnum, priceEpoch: PriceEpoch, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, lastListenerBlock: number) {
        if (this._lastBlockNumber[network]) {
            const startBlock: number = this._lastBlockNumber[network];
            const endBlock: number = lastListenerBlock;
            const activeFtsoSymbols: number = blockchainDao.getActiveFtsoContracts();
            if (this._ftsoFeeList[network]) {
                let ftsoFeeToLoad: FtsoFee[] = this._ftsoFeeList[network];
                if (ftsoFeeToLoad.length > 0) {
                    this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._ftsoFeeList[network].length} ftso fee changes from listener`);
                    const storedFtsoFee: number = await persistenceDao.storeFtsoFee(this._ftsoFeeList[network]);
                    this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedFtsoFee} ftso fee changes from listener`);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FtsoFee, null, startBlock, endBlock);
                    this._ftsoFees[network] = await this.getFtsoFee(network, this._lastBlockNumber[network], null, FtsoFeeSortEnum.timestamp, SortOrderEnum.desc, true);
                } else {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FtsoFee, null, startBlock, endBlock);
                }
                this._ftsoFeeList[network] = [];
                delete this._ftsoFeeList[network];
            }
            if (this._priceFinalizedList[network] && this._priceFinalizedList[network][priceEpoch.id]) {
                let finalizedPricesToLoad: PriceFinalized[] = [];
                for (let symbol in this._priceFinalizedList[network][priceEpoch.id]) {
                    finalizedPricesToLoad.push(this._priceFinalizedList[network][priceEpoch.id][symbol]);
                }
                if (finalizedPricesToLoad.length > 0) {
                    this.logger.log(`${network} - ${priceEpoch.id} - Collected ${finalizedPricesToLoad.length} finalized prices from listener`)
                    if (finalizedPricesToLoad.length != activeFtsoSymbols) {
                        await this.getFinalizedPrices(network, null, startBlock, endBlock, 1, 0);
                    } else {
                        const storedFinalizedPrices: number = await persistenceDao.storeFinalizedPrices(finalizedPricesToLoad);
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, startBlock, endBlock);
                        this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedFinalizedPrices} finalized prices from listener`);
                    }
                } else {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, startBlock, endBlock);
                }
                this._priceFinalizedList[network][priceEpoch.id] = null;
                delete this._priceFinalizedList[network][priceEpoch.id];

                if (this._priceRevealedList[network] && this._priceRevealedList[network][priceEpoch.id]) {
                    let revealedPricesToLoad: PriceRevealed[] = [];
                    for (let symbol in this._priceRevealedList[network][priceEpoch.id]) {
                        this.logger.log(`${network} - ${priceEpoch.id} - ${symbol} - Collected ${this._priceRevealedList[network][priceEpoch.id][symbol].length} revealed prices from listener`)
                        revealedPricesToLoad.push(...this._priceRevealedList[network][priceEpoch.id][symbol]);
                    }
                    if (finalizedPricesToLoad.length != activeFtsoSymbols) {
                        finalizedPricesToLoad = (await this.getFinalizedPrices(network, null, startBlock, endBlock, 1, 1000)).results;
                    }
                    const storedRevealedPrices: number = await persistenceDao.storeRevealedPrices(this.parseRevealedPriceScores(revealedPricesToLoad, finalizedPricesToLoad));
                    this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedRevealedPrices} revealed prices from listener`);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock);
                } else {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock);
                }
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock);
                this._priceRevealedList[network][priceEpoch.id] = null;
                delete this._priceRevealedList[network][priceEpoch.id];
            }


            if (this._hashSubmittedList[network] && this._hashSubmittedList[network][priceEpoch.id]) {
                let hashSubmittedToLoad: HashSubmitted[] = this._hashSubmittedList[network][priceEpoch.id];
                if (hashSubmittedToLoad.length > 0) {
                    this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._hashSubmittedList[network][priceEpoch.id].length} submitted hashes from listener`)
                    const storedHashSubmitted: number = await persistenceDao.storeSubmittedHashes(hashSubmittedToLoad);
                    this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedHashSubmitted} submitted hashes from listener`);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.HashSubmitted, null, startBlock, endBlock);
                }
            } else {
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.HashSubmitted, null, startBlock, endBlock);
            }

            this._hashSubmittedList[network][priceEpoch.id] = null;
            delete this._hashSubmittedList[network][priceEpoch.id];

            if (this._rewardDistributedList[network] && this._rewardDistributedList[network][priceEpoch.id]) {
                this._rewardDistributedList[network][priceEpoch.id].map(rewardDistributed => {
                    this._calculateProviderReward(rewardDistributed, this._ftsoFees[network], this._lastRewardEpochs[network])
                })
                let rewardDistributedToLoad: RewardDistributed[] = this._rewardDistributedList[network][priceEpoch.id];
                if (rewardDistributedToLoad.length > 0) {
                    this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._rewardDistributedList[network][priceEpoch.id].length} rewards distributed from listener `)
                    const storedRewardDistributed: number = await persistenceDao.storeRewardDistributed(rewardDistributedToLoad);
                    this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedRewardDistributed} distributed rewards from listener`);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RewardDistributed, null, startBlock, endBlock);
                }
            } else {
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RewardDistributed, null, startBlock, endBlock);
            }
            this._rewardDistributedList[network][priceEpoch.id] = null;
            delete this._rewardDistributedList[network][priceEpoch.id];
            this._lastBlockNumber[network] = lastListenerBlock;
        }
    }


    async getDataProvidersInfo(network: NetworkEnum, rewardEpochId?: number): Promise<DataProviderInfo[]> {
        return new Promise<DataProviderInfo[]>(async (resolve, reject) => {
            try {
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: DataProviderInfo[] = await cacheDao.getDataProvidersInfo(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                let data: DataProviderInfo[] = await this.getTowoLabsFtsoInfo(network);
                let addresses: string[] = [];
                if (isNotEmpty(rewardEpochId)) {
                    addresses = await this.getWhitelistedDataProvidersAddresses(network, true, isEmpty(rewardEpochId) ? rewardEpochSettings.getCurrentEpochId() - 1 : rewardEpochId - 1);
                } else {
                    addresses = await this._balanceService.getUniqueDataProviderAddressList(network, rewardEpochSettings.getCurrentEpochId() - 1);
                }
                addresses.map(whitelistedAddress => {
                    let dpInfo: DataProviderInfo = data.find(dpInfo => dpInfo.address == whitelistedAddress);
                    if (isEmpty(dpInfo)) {
                        dpInfo = new DataProviderInfo();
                        dpInfo.address = whitelistedAddress.toLowerCase();
                        data.push(dpInfo);
                    }
                });
                cacheDao.setDataProvidersInfo(rewardEpochId, data, new Date().getTime() + (60 * 60 * 12 * 1000));

                resolve(await this.getDataProvidersInfo(network));
            } catch (e) {
                this.logger.error(`Unable to get ftso info: ${e.message}`);
                reject(new Error('Unable to get ftso info.'));
            }
        });
    }

    async getDataProvidersData(network: NetworkEnum, rewardEpochId: number): Promise<DataProviderExtendedInfo[]> {
        return new Promise<DataProviderExtendedInfo[]>(async (resolve, reject) => {
            try {
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }
                const cacheData: DataProviderExtendedInfo[] = await cacheDao.getDataProvidersData(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }

                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();

                let results: DataProviderExtendedInfo[] = [];
                const votePowerPersistenceData: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
                const previousVotePowerPersistenceData: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                const totalVotePower: VotePowerDTO = await this._delegationsService.getTotalVotePowerByRewardEpoch(network, rewardEpochId);
                const previousTotalVotePower: VotePowerDTO = await this._delegationsService.getTotalVotePowerByRewardEpoch(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                const whitelistedAddresses: string[] = await this.getWhitelistedDataProvidersAddresses(network, true, rewardEpochId);
                const dataProvidersInfo: DataProviderInfo[] = await this.getDataProvidersInfo(network);
                const dataProviderRewardStats: DataProviderRewardStats[] = await this.getDataProviderRewardStatsByRewardEpoch(network, null, rewardEpochId);
                const previousDataProviderRewardStats: DataProviderRewardStats[] = await this.getDataProviderRewardStatsByRewardEpoch(network, null, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                const submissionStatsRewardEpoch: DataProviderSubmissionStats[] = await this.getDataProvideSubmissionStatsByRewardEpoch(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId, null, null);
                const ftsoFees: FtsoFee[] = await this.getFtsoFeeByRewardEpoch(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                if (rewardEpochId == nextEpochId || rewardEpochId == currentEpochId) {
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const submissionStats6h: DataProviderSubmissionStats[] = await this.getDataProviderSubmissionStatsByDataProvider(network, null, null, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId() - 120), priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    votePowerPersistenceData.map(vp => {
                        const previousVotePower: VotePower = previousVotePowerPersistenceData.find(previousVp => previousVp.address == vp.address);
                        const ftsoRewardStat: DataProviderRewardStats = dataProviderRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                        const previousFtsoRewardStat: DataProviderRewardStats = previousDataProviderRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                        const dataProviderSubmissionStats: DataProviderSubmissionStats = submissionStatsRewardEpoch.find(submissionStats => submissionStats.dataProvider == vp.address);
                        const dataProviderSubmissionStats6h: DataProviderSubmissionStats = submissionStats6h.find(submissionStats => submissionStats.dataProvider == vp.address);
                        const dataProviderFee: FtsoFee = ftsoFees.find(fee => fee.dataProvider == vp.address);
                        const dpExtendedInfo: DataProviderExtendedInfo = new DataProviderExtendedInfo(vp, previousVotePower, dataProvidersInfo, totalVotePower, previousTotalVotePower, whitelistedAddresses, ftsoRewardStat, previousFtsoRewardStat, dataProviderSubmissionStats, dataProviderFee, dataProviderSubmissionStats6h);
                        results.push(dpExtendedInfo);
                    });
                    cacheDao.setDataProvidersData(rewardEpochId, results, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                } else {
                    votePowerPersistenceData.map(vp => {
                        const previousVotePower: VotePower = previousVotePowerPersistenceData.find(previousVp => previousVp.address == vp.address);
                        const ftsoRewardStat: DataProviderRewardStats = dataProviderRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                        const previousFtsoRewardStat: DataProviderRewardStats = previousDataProviderRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                        const dataProviderSubmissionStats: DataProviderSubmissionStats = submissionStatsRewardEpoch.find(submissionStats => submissionStats.dataProvider == vp.address);
                        const dataProviderFee: FtsoFee = ftsoFees.find(fee => fee.dataProvider == vp.address);
                        const dpExtendedInfo: DataProviderExtendedInfo = new DataProviderExtendedInfo(vp, previousVotePower, dataProvidersInfo, totalVotePower, previousTotalVotePower, whitelistedAddresses, ftsoRewardStat, previousFtsoRewardStat, dataProviderSubmissionStats, dataProviderFee);
                        results.push(dpExtendedInfo);
                    });
                    cacheDao.setDataProvidersData(rewardEpochId, results);
                }
                resolve(results);
            } catch (e) {
                this.logger.error(`Unable to get data providers data - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers data`));
            }
        });
    }


    async getTowoLabsFtsoInfo(network: NetworkEnum): Promise<DataProviderInfo[]> {
        return new Promise<any>((resolve, reject) => {
            const networkConfigs: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
            let networkConfig: NetworkConfig = networkConfigs.find(nConfig => nConfig.name == network);
            let data = [];
            try {
                this.httpService.get('https://raw.githubusercontent.com/TowoLabs/ftso-signal-providers/master/bifrost-wallet.providerlist.json').subscribe(async res => {
                    let providersData: TowoLabsDataProviderInfo[] = Commons.clone((res.data?.providers as TowoLabsDataProviderInfo[]).filter(providerInfo => providerInfo.chainId == networkConfig.blockchainDao.chainId));
                    for (let i in providersData) {
                        let providerInfo: TowoLabsDataProviderInfo = providersData[i];
                        let dataProviderInfo: DataProviderInfo = new DataProviderInfo();
                        dataProviderInfo.address = providerInfo.address.toLowerCase();
                        dataProviderInfo.name = providerInfo.name;
                        dataProviderInfo.description = providerInfo.description;
                        // await this.downloadAndSaveFile(providerInfo.logoURI, `${path.join(__dirname, '.', 'public')}/images/ftso-icons/${network}`, `${providerInfo.address}.png`);
                        dataProviderInfo.icon = providerInfo.logoURI;
                        dataProviderInfo.listed = providerInfo.listed;
                        dataProviderInfo.url = providerInfo.url;
                        data.push(dataProviderInfo);
                    }
                    resolve(data);
                });
            } catch (e) {
                reject(new Error(`Unable to download data from TowoLabs repository: ${e.message}`));
            }
        })
    }
    async downloadAndSaveFile(url: string, localFolderPath: string, fileName: string): Promise<string> {
        try {
            this.createFolderIfNotExists(localFolderPath);
            const localFilePath = path.join(localFolderPath, fileName);
            const response = await this.httpService.get(url, { responseType: 'stream' }).toPromise();
            const writer = fs.createWriteStream(localFilePath);
            response.data.pipe(writer);
            return new Promise<string>((resolve, reject) => {
                writer.on('finish', () => resolve(localFilePath));
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Error downloading remote file: ${error.message}`);
        }
    }
    private createFolderIfNotExists(folderPath: string): void {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
    }

    async getSubmittedHashesByEpochId(network: NetworkEnum, epochId: number, page: number, pageSize: number, sortField: HashSubmittedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<HashSubmitted[]> | PromiseLike<PaginatedResult<HashSubmitted[]>>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let paginatedResults: PaginatedResult<HashSubmitted[]> = new PaginatedResult<HashSubmitted[]>(page, pageSize, sortField, sortOrder, 0, []);
        const priceEpochTo: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId);
        const priceEpochFrom: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId - 1);
        if (isEmpty(priceEpochTo) || isEmpty(priceEpochTo)) {
            throw new Error(`Unable to get submitted hashes: Invalid epoch id.`);
            return;
        }
        paginatedResults = await this.getSubmittedHashes(network, epochId, null, priceEpochFrom.blockNumber + 1, priceEpochTo.blockNumber, page, pageSize, sortField!, sortOrder!);
        return paginatedResults;
    }
    async getSubmittedHashes(network: NetworkEnum, epochId: number, submitter: string, startBlock: number, endBlock: number, page: number, pageSize: number, sortField: HashSubmittedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<HashSubmitted[]> | PromiseLike<PaginatedResult<HashSubmitted[]>>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let missingBlocks: PersistenceMetadataScanInfo[] = [];
        let persistenceMetadata: PersistenceMetadata[] = [];
        persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.HashSubmitted, null, startBlock, endBlock));
        missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        if (missingBlocks.length > 0) {
            for (const missingBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching submitted hashes - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                let blockchainData: HashSubmitted[] = [];
                blockchainData.push(...await blockchainDao.getSubmittedHashes(missingBlockNumber.from, missingBlockNumber.to))
                if (blockchainData.length > 0) {
                    await persistenceDao.storeSubmittedHashes(blockchainData);
                }
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.HashSubmitted, null, missingBlockNumber.from, missingBlockNumber.to);
            }
            return this.getSubmittedHashes(network, epochId, submitter, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }

        if (missingBlocks.length === 0) {
            let daoData: PaginatedResult<HashSubmitted[]> = new PaginatedResult<HashSubmitted[]>(page, pageSize, sortField, sortOrder, 0, []);
            if (pageSize > 0) {
                daoData = await persistenceDao.getSubmittedHashes(epochId, submitter, startBlock, endBlock, page, pageSize);
            }
            if (persistenceMetadata.length > 5) {
                await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.HashSubmitted, persistenceMetadata);
            }
            return daoData;
        }
        throw new Error(`Unable to get submitted hashes for epoch id ${epochId}.`);
    }


    async getFinalizedPricesDto(
        network: NetworkEnum,
        symbol: string,
        startTime: number,
        endTime: number,
        page: number,
        pageSize: number,
        sortField?: PriceFinalizedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceFinalized[]>> {
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
        if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let paginatedResults: PaginatedResult<PriceFinalized[]> = new PaginatedResult<PriceFinalized[]>(page, pageSize, sortField, sortOrder, 0, []);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
        const epochBlockNumberFrom: number = epochStats.minBlockNumber;
        const epochBlockNumberTo: number = epochStats.maxBlockNumber;
        paginatedResults = await this.getFinalizedPrices(network, symbol, epochBlockNumberFrom, epochBlockNumberTo, page, pageSize, sortField!, sortOrder!);
        return paginatedResults;
    }
    async getFinalizedPricesByEpochId(
        network: NetworkEnum,
        symbol: string,
        epochId: number,
        page: number,
        pageSize: number,
        sortField?: PriceFinalizedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceFinalized[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let paginatedResults: PaginatedResult<PriceFinalized[]> = new PaginatedResult<PriceFinalized[]>(page, pageSize, sortField, sortOrder, 0, []);
        const priceEpochTo: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId);
        const priceEpochFrom: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId - 1);
        if (isEmpty(priceEpochTo) || isEmpty(priceEpochTo)) {
            throw new Error(`Unable to get finalized prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'}. Invalid epoch id.`);
            return;
        }
        paginatedResults = await this.getFinalizedPrices(network, symbol, priceEpochFrom.blockNumber + 1, priceEpochTo.blockNumber, page, pageSize, sortField!, sortOrder!);
        return paginatedResults;
    }


    async getFinalizedPrices(
        network: NetworkEnum,
        symbol: string,
        startBlock: number,
        endBlock: number,
        page: number,
        pageSize: number,
        sortField?: PriceFinalizedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceFinalized[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let missingBlocks: PersistenceMetadataScanInfo[] = [];
        let persistenceMetadata: PersistenceMetadata[] = [];
        persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, startBlock, endBlock));
        missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        if (missingBlocks.length > 0) {
            for (const missingBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching finalized prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                let blockchainData: PriceFinalized[] = [];
                blockchainData.push(...await blockchainDao.getFinalizedPrices(null, missingBlockNumber.from, missingBlockNumber.to))
                if (blockchainData.length > 0) {
                    await persistenceDao.storeFinalizedPrices(blockchainData);
                }
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, missingBlockNumber.from, missingBlockNumber.to);
            }
            return this.getFinalizedPrices(network, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }

        if (missingBlocks.length === 0) {
            let daoData: PaginatedResult<PriceFinalized[]> = new PaginatedResult<PriceFinalized[]>(page, pageSize, sortField, sortOrder, 0, []);
            if (pageSize > 0) {
                daoData = await persistenceDao.getFinalizedPrices(symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }
            if (persistenceMetadata.length > 5) {
                await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, persistenceMetadata);
            }
            return daoData;
        }
        throw new Error(`Unable to get finalized prices symbol: ${isNotEmpty(symbol) ? symbol : '*'}.`);

    }

    async getRevealedPricesDto(
        network: NetworkEnum,
        dataProvider: string,
        symbol: string,
        startTime: number,
        endTime: number,
        page: number,
        pageSize: number,
        sortField?: PriceRevealedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceRevealed[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let paginatedResults: PaginatedResult<PriceRevealed[]> = new PaginatedResult<PriceRevealed[]>(page, pageSize, sortField, sortOrder, 0, []);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
        const epochBlockNumberFrom: number = epochStats.minBlockNumber;
        const epochBlockNumberTo: number = epochStats.maxBlockNumber;
        paginatedResults = await this.getRevealedPrices(network, dataProvider, symbol, epochBlockNumberFrom, epochBlockNumberTo, page, pageSize, sortField, sortOrder);
        return paginatedResults;
    }
    async getRevealedPricesByEpochId(
        network: NetworkEnum,
        dataProvider: string,
        symbol: string,
        epochId: number,
        page: number,
        pageSize: number,
        sortField?: PriceRevealedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceRevealed[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }
        const priceEpochTo: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId);
        const priceEpochFrom: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId - 1);
        if (isEmpty(priceEpochTo) || isEmpty(priceEpochTo)) {
            throw new Error(`Unable to get finalized prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'}. Invalid epoch id.`);
            return;
        }
        let paginatedResults: PaginatedResult<PriceRevealed[]> = await this.getRevealedPrices(network, dataProvider, symbol, priceEpochFrom.blockNumber + 1, priceEpochTo.blockNumber, page, pageSize, sortField!, sortOrder!);
        paginatedResults = await persistenceDao.getRevealedPricesByEpochId(symbol, dataProvider, epochId, epochId, page, pageSize, sortField!, sortOrder!);
        return paginatedResults;
    }
    async getRevealedPrices(
        network: NetworkEnum,
        dataProvider: string,
        symbol: string,
        startBlock: number,
        endBlock: number,
        page: number,
        pageSize: number,
        sortField?: PriceRevealedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<PriceRevealed[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }
        let missingBlocks: PersistenceMetadataScanInfo[] = [];
        let persistenceMetadata: PersistenceMetadata[] = [];
        let missingBlocksDataProvidersMap: { [dataProvider: string]: PersistenceMetadataScanInfo[] } = {};
        if (isNotEmpty(dataProvider)) {
            let dataProviders: string[] = dataProvider.split(',');
            for (let i in dataProviders) {
                let dataProviderePersistenceMetadata = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RevealedPrice, dataProviders[i], startBlock, endBlock);
                let missingDataProviderBlocks = new PersistenceMetadata().findMissingIntervals(dataProviderePersistenceMetadata, startBlock, endBlock);
                if (missingDataProviderBlocks.length > 0) {
                    if (!missingBlocksDataProvidersMap[dataProviders[i]]) { missingBlocksDataProvidersMap[dataProviders[i]] = [] }
                    missingBlocksDataProvidersMap[dataProviders[i]].push(...missingDataProviderBlocks);
                }
            }
        } else {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        }
        if (Object.keys(missingBlocksDataProvidersMap).length > 0) {
            for (let dataProviderAddress in missingBlocksDataProvidersMap) {
                if (missingBlocksDataProvidersMap[dataProviderAddress].length > 0) {
                    for (const missingBlockNumber of missingBlocksDataProvidersMap[dataProviderAddress]) {
                        this.logger.log(`${network} - Fetching revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviderAddress) ? dataProviderAddress : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                        let blockchainData: PriceRevealed[] = [];
                        let blockRanges: { from: number, to: number }[] = [];
                        if (missingBlockNumber.to - missingBlockNumber.from >= 300000) {
                            blockRanges = Commons.divideBlocks(missingBlockNumber.from, missingBlockNumber.to, 300000);
                        } else {
                            blockRanges = [{ from: missingBlockNumber.from, to: missingBlockNumber.to }];
                        }
                        const blockRange = blockRanges[0];
                        blockchainData.push(...await blockchainDao.getRevealedPrices(dataProviderAddress, blockRange.from, blockRange.to))
                        if (blockchainData.length > 0) {
                            const finalizedPrices: PriceFinalized[] = (await this.getFinalizedPrices(network, null, missingBlockNumber.from, missingBlockNumber.to, 1, 1_000_000)).results;
                            if (isEmpty(finalizedPrices)) {
                                throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviderAddress) ? dataProviderAddress : '*'}. Unable to retrieve finalized prices for the selected timerange.`);
                                return;
                            }
                            let parsedRevealedPrice: PriceRevealed[] = this.parseRevealedPriceScores(blockchainData, finalizedPrices);
                            await persistenceDao.storeRevealedPrices(parsedRevealedPrice);
                        }
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, dataProviderAddress, blockRange.from, blockRange.to);
                    }
                }
            }
            return this.getRevealedPrices(network, dataProvider, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }
        if (missingBlocks.length > 0) {
            for (const missingBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                let blockchainData: PriceRevealed[] = [];
                let blockRanges: { from: number, to: number }[] = [];
                if (missingBlockNumber.to - missingBlockNumber.from >= 4500) {
                    blockRanges = Commons.divideBlocks(missingBlockNumber.from, missingBlockNumber.to, 4500);
                } else {
                    blockRanges = [{ from: missingBlockNumber.from, to: missingBlockNumber.to }];
                }
                const blockRange = blockRanges[0];

                blockchainData.push(...await blockchainDao.getRevealedPrices(null, blockRange.from, blockRange.to))
                if (blockchainData.length > 0) {
                    const finalizedPrices: PriceFinalized[] = (await this.getFinalizedPrices(network, null, missingBlockNumber.from, missingBlockNumber.to, 1, 1_000_000)).results;
                    if (isEmpty(finalizedPrices)) {
                        throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}. Unable to retrieve finalized prices for the selected timerange.`);
                        return;
                    }
                    let parsedRevealedPrice: PriceRevealed[] = this.parseRevealedPriceScores(blockchainData, finalizedPrices);
                    await persistenceDao.storeRevealedPrices(parsedRevealedPrice);
                }
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, blockRange.from, blockRange.to);
            }
            return this.getRevealedPrices(network, dataProvider, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }

        if (missingBlocks.length === 0) {
            let daoData: PaginatedResult<PriceRevealed[]> = new PaginatedResult<PriceRevealed[]>(page, pageSize, sortField, sortOrder, 0, []);
            if (pageSize > 0) {
                daoData = await persistenceDao.getRevealedPrices(symbol, dataProvider, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }
            return daoData;
        }
        throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}.`);

    }

    parseRevealedPriceScores(revealedPrices: PriceRevealed[], finalizedPrices: PriceFinalized[]): PriceRevealed[] {
        finalizedPrices.map(finalizedPrice => {
            revealedPrices.filter(revealedPrice => revealedPrice.epochId == finalizedPrice.epochId && revealedPrice.symbol == finalizedPrice.symbol).map(revealedPrice => {
                revealedPrice.borderIQR = false;
                revealedPrice.borderPct = false;
                revealedPrice.outIQR = false;
                revealedPrice.outPct = false;
                revealedPrice.innerIQR = false;
                revealedPrice.innerPct = false;

                if (revealedPrice.value > finalizedPrice.lowIQRRewardPrice && revealedPrice.value < finalizedPrice.highIQRRewardPrice) {
                    revealedPrice.innerIQR = true;
                } else {
                    revealedPrice.outIQR = true;
                }
                if (revealedPrice.value == finalizedPrice.highIQRRewardPrice || revealedPrice.value == finalizedPrice.lowIQRRewardPrice) {
                    revealedPrice.borderIQR = true;
                    revealedPrice.outIQR = false;
                }
                if (revealedPrice.value > finalizedPrice.lowPctRewardPrice && revealedPrice.value < finalizedPrice.highPctRewardPrice) {
                    revealedPrice.innerPct = true;
                } else {
                    revealedPrice.outPct = true;
                }

                if (revealedPrice.value == finalizedPrice.highPctRewardPrice || revealedPrice.value == finalizedPrice.lowPctRewardPrice) {
                    revealedPrice.borderPct = true;
                    revealedPrice.outPct = false;
                }
            });
        });
        return revealedPrices;
    }



    async getRewardsDistributedDTO(
        network: NetworkEnum,
        dataProvider: string,
        symbol: string,
        startTime: number,
        endTime: number,
        page: number,
        pageSize: number,
        sortField?: RewardDistributedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<RewardDistributed[]>> {
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
        if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }
        let paginatedResults: PaginatedResult<RewardDistributed[]> = new PaginatedResult<RewardDistributed[]>(page, pageSize, sortField, sortOrder, 0, []);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
        const epochBlockNumberFrom: number = epochStats.minBlockNumber;
        const epochBlockNumberTo: number = epochStats.maxBlockNumber;
        paginatedResults = await this.getRewardsDistributed(network, dataProvider, symbol, epochBlockNumberFrom, epochBlockNumberTo, page, pageSize, sortField!, sortOrder!);
        return paginatedResults;
    }
    async getRewardsDistributed(
        network: NetworkEnum,
        dataProviders: string,
        symbol: string,
        startBlock: number,
        endBlock: number,
        page: number,
        pageSize: number,
        sortField?: RewardDistributedSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<RewardDistributed[]>> {
        try {
            const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
            if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                throw new Error(`Service unavailable`);
            }

            let persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RewardDistributed, null, startBlock, endBlock);
            let missingBlocks: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock);
            if (missingBlocks.length > 0) {
                for (const missingBlockNumber of missingBlocks) {
                    this.logger.log(`${network} - Fetching reward distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviders) ? dataProviders : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                    let blockchainData: RewardDistributed[] = await blockchainDao.getRewardDistributed(missingBlockNumber.from, missingBlockNumber.to);
                    if (blockchainData.length > 0) {
                        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                        const ftsoFee: FtsoFee[] = await this.getFtsoFee(network, endBlock, null, null, null, true);
                        const rewardEpochTimestampMin: number = Math.min(...blockchainData.map(bd => bd.timestamp)) - (rewardEpochSettings.rewardEpochDurationMillis * 2);
                        const rewardEpochTimestampMax: number = Math.max(...blockchainData.map(bd => bd.timestamp)) + (rewardEpochSettings.rewardEpochDurationMillis * 2);
                        let rewardEpochs: RewardEpochDTO[] = (await this._epochsService.getRewardEpochsDto(network, rewardEpochTimestampMin, rewardEpochTimestampMax, 1, 1_000_000, EpochSortEnum.id, SortOrderEnum.asc)).results;
                        if (rewardEpochs.length == 0) {
                            this.logger.error(`Unable to find reward epochs for the given timerange:${rewardEpochTimestampMin} to ${rewardEpochTimestampMax}`);
                            throw new Error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviders) ? dataProviders : '*'}.`);
                        }
                        blockchainData.map(rewardDistributed => {
                            this._calculateProviderReward(rewardDistributed, ftsoFee, rewardEpochs);
                        });
                        await persistenceDao.storeRewardDistributed(blockchainData);
                    }
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RewardDistributed, null, missingBlockNumber.from, missingBlockNumber.to);
                }
                return this.getRewardsDistributed(network, dataProviders, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }

            if (missingBlocks.length === 0) {
                let daoData: PaginatedResult<RewardDistributed[]> = new PaginatedResult<RewardDistributed[]>(page, pageSize, sortField, sortOrder, 0, []);
                if (pageSize > 0) {
                    daoData = await persistenceDao.getRewardDistributed(dataProviders, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
                }
                if (persistenceMetadata.length > 5) {
                    await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.RewardDistributed, persistenceMetadata);
                }
                return daoData;
            }
            throw new Error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviders) ? dataProviders : '*'}.`);
        } catch (e) {
            this.logger.error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviders) ? dataProviders : '*'}.: ${e.message}`);
            throw new Error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProviders) ? dataProviders : '*'}.`);
        }

    }


    private _calculateProviderReward(rewardDistributed: RewardDistributed, ftsoFee: FtsoFee[], rewardEpochs: RewardEpochDTO[]) {
        let providerFee: FtsoFee;
        if (typeof ftsoFee != 'undefined') {
            providerFee = ftsoFee.find(fee => fee.dataProvider == rewardDistributed.dataProvider);
        }
        if (typeof providerFee != 'undefined') {
            rewardDistributed.providerReward = (rewardDistributed.reward / 100) * providerFee.value;
            rewardDistributed.reward = rewardDistributed.reward - rewardDistributed.providerReward;
        } else {
            // Fee not found. Meaning that the data provider has never changed their fee. Using default.
            rewardDistributed.providerReward = (rewardDistributed.reward / 100) * 20;
            rewardDistributed.reward = rewardDistributed.reward - rewardDistributed.providerReward;
        }
        if (isNotEmpty(rewardEpochs) && rewardEpochs.length > 0) {
            rewardEpochs.map((re, idx) => {
                if (idx > 0) {
                    if (rewardDistributed.blockNumber <= re.startBlockNumber && rewardDistributed.blockNumber >= rewardEpochs[idx - 1].startBlockNumber) {
                        rewardDistributed.rewardEpochId = re.id;
                    }
                } else {
                    if (rewardDistributed.blockNumber <= re.startBlockNumber) {
                        rewardDistributed.rewardEpochId = re.id;
                    }
                }
            });

            if (!rewardDistributed.rewardEpochId) {
                rewardDistributed.rewardEpochId = Math.max(...rewardEpochs.map(rewardEpoch => rewardEpoch.id)) + 1;
            }
        }
    }

    async getDataProviderRewardStatsHistory(network: NetworkEnum, dataProviderAddress: string, startTime: number, endTime: number,
        page: number,
        pageSize: number,
        sortField?: DataProviderRewardStatsGroupByEnum,
        sortOrder?: SortOrderEnum): Promise<PaginatedResult<DataProviderRewardStats[]>> {
        return new Promise<PaginatedResult<DataProviderRewardStats[]>>(async (resolve, reject) => {
            try {
                let rewardStatsResults: DataProviderRewardStats[] = [];
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const rewardEpochs: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                for (let i in rewardEpochs) {
                    rewardStatsResults.push(...await this.getDataProviderRewardStatsByRewardEpoch(network, dataProviderAddress, rewardEpochs[i]));
                }
                resolve(Commons.parsePaginatedResults<DataProviderRewardStats>(rewardStatsResults, page, pageSize, sortField, sortOrder));
            } catch (e) {
                this.logger.error(`Unable to get reward stats history. Address: ${dataProviderAddress} - From: ${startTime} To: ${endTime}: `, e);
                reject(new Error(`Unable to get reward stats history`));
            }
        });
    }

    async getDataProviderRewardStatsByRewardEpoch(
        network: NetworkEnum,
        dataProvider: string,
        rewardEpochId: number,
    ): Promise<DataProviderRewardStats[]> {
        return new Promise<DataProviderRewardStats[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    reject(new Error(`Service unavailable`));
                }
                const cacheData: DataProviderRewardStats[] = await cacheDao.getDataProviderRewardStatsByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    if (isNotEmpty(dataProvider)) {
                        resolve(cacheData.filter(DataProviderRewardStats => DataProviderRewardStats.dataProvider == dataProvider));
                    } else {
                        resolve(cacheData);
                    }
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                if (rewardEpochId > nextEpochId) {
                    throw new Error(`Invalid reward epoch. Reward epoch is not finalized yet.`);
                    return;
                }
                let endBlockNumber: number = 0;
                if (rewardEpochId == nextEpochId || rewardEpochId == currentEpochId) {
                    endBlockNumber = Number(await blockchainDao.provider.getBlockNumber());
                } else {
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    endBlockNumber = rewardEpoch.blockNumber;
                }

                const previousRewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId - 1)
                await this.getRewardsDistributed(network, null, null, previousRewardEpoch.blockNumber, endBlockNumber, 1, 0);
                const dataProviderRewardStats: DataProviderRewardStats[] = await persistenceDao.getDataProviderRewardStats(null, previousRewardEpoch.blockNumber, endBlockNumber, DataProviderRewardStatsGroupByEnum.dataProvider);
                const votePower: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
                if (votePower.length > 0) {
                    dataProviderRewardStats.map(DataProviderRewardStats => {
                        votePower.filter(vp => vp.address == DataProviderRewardStats.dataProvider).map(vp => {
                            DataProviderRewardStats.rewardRate = (DataProviderRewardStats.delegatorsReward / vp.amount) * 100;
                        });
                    });
                }
                if (rewardEpochId == nextEpochId || rewardEpochId == currentEpochId) {
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    await cacheDao.setDataProviderRewardStatsByRewardEpoch(rewardEpochId, dataProviderRewardStats, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                } else {
                    await cacheDao.setDataProviderRewardStatsByRewardEpoch(rewardEpochId, dataProviderRewardStats);
                }
                if (isNotEmpty(dataProvider)) {
                    resolve(dataProviderRewardStats.filter(ftsoRewardStat => ftsoRewardStat.dataProvider == dataProvider));
                } else {
                    resolve(dataProviderRewardStats);
                }
                return
            } catch (e) {
                this.logger.error(`Unable to get data providers reward stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
                reject(new Error(`Unable to get data providers reward stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`));
            }
        });
    }

    async getDataProviderRewardStatsByDataProvider(
        network: NetworkEnum,
        dataProvider: string,
        startTime: number,
        endTime: number
    ): Promise<DataProviderRewardStats[]> {
        return new Promise<DataProviderRewardStats[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    reject(new Error(`Service unavailable`));
                }
                const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
                const epochBlockNumberFrom: number = epochStats.minBlockNumber;
                const epochBlockNumberTo: number = epochStats.maxBlockNumber;
                await this.getRewardsDistributed(network, null, null, epochBlockNumberFrom, epochBlockNumberTo, 1, 0);
                const dataProviderRewardStats: DataProviderRewardStats[] = await persistenceDao.getDataProviderRewardStats(dataProvider, epochBlockNumberFrom, epochBlockNumberTo, DataProviderRewardStatsGroupByEnum.rewardEpochId)
                let rewardEpochIds: number[] = [];
                dataProviderRewardStats.map(ftsoRewardStat => rewardEpochIds.push(ftsoRewardStat.epochId));
                rewardEpochIds = [... new Set(rewardEpochIds)].sort((a, b) => a - b);
                for (let i in rewardEpochIds) {
                    const rewardEpochId: number = rewardEpochIds[i];
                    const votePower: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
                    if (votePower.length > 0) {
                        dataProviderRewardStats.filter(ftsoRewardStat => ftsoRewardStat.epochId == rewardEpochId).map(DataProviderRewardStats => {
                            votePower.filter(vp => vp.address == dataProvider).map(vp => {
                                DataProviderRewardStats.rewardRate = (DataProviderRewardStats.delegatorsReward / vp.amount) * 100;
                            });
                        });
                    }
                }
                resolve(dataProviderRewardStats.sort((a, b) => a.epochId - b.epochId));
            } catch (e) {
                this.logger.error(`Unable to get data providers reward stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
                reject(new Error(`Unable to get data providers reward stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`));
            }
        });
    }

    async getDataProvideSubmissionStatsByRewardEpoch(network: NetworkEnum, rewardEpochId: number, dataProvider: string, symbol: string): Promise<DataProviderSubmissionStats[]> {
        return new Promise<DataProviderSubmissionStats[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }
                const cacheData: DataProviderSubmissionStats[] = await cacheDao.getDataProvideSubmissionStatsByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData.filter(data =>
                        (isEmpty(dataProvider) || data.dataProvider === dataProvider) &&
                        (symbol == 'all' || (isEmpty(symbol) ? data.symbol == null : data.symbol === symbol))
                    ));
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                const previousRewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId - 1);
                let targetBlockNumber: number;
                if (rewardEpochId == nextEpochId) {
                    targetBlockNumber = await blockchainDao.provider.getBlockNumber();
                } else {
                    targetBlockNumber = (await this._epochsService.getRewardEpoch(network, rewardEpochId)).blockNumber
                }
                await this.getRevealedPrices(network, null, null, previousRewardEpoch.blockNumber, targetBlockNumber, 1, 0);
                if (rewardEpochId == nextEpochId) {
                    // Calcola
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const submissionStats: DataProviderSubmissionStats[] = await persistenceDao.getDataProviderSubmissionStats(previousRewardEpoch.blockNumber, targetBlockNumber);
                    await cacheDao.setDataProvideSubmissionStatsByRewardEpoch(rewardEpochId, submissionStats, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(submissionStats.filter(data =>
                        (isEmpty(dataProvider) || data.dataProvider === dataProvider) &&
                        (symbol == 'all' || (isEmpty(symbol) ? data.symbol == null : data.symbol === symbol))
                    ));
                } else {
                    const submissionStats: DataProviderSubmissionStats[] = await persistenceDao.getDataProviderSubmissionStats(previousRewardEpoch.blockNumber, targetBlockNumber);
                    await cacheDao.setDataProvideSubmissionStatsByRewardEpoch(rewardEpochId, submissionStats);
                    resolve(submissionStats.filter(data =>
                        (isEmpty(dataProvider) || data.dataProvider === dataProvider) &&
                        (symbol == 'all' || (isEmpty(symbol) ? data.symbol == null : data.symbol === symbol))
                    ));
                }
            } catch (e) {
                this.logger.error(`Unable to get data provider submissions stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
                reject(new Error(`Unable to get data provider submissions stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`));
            }
        });
    }

    async getDataProviderSubmissionStatsByDataProvider(network: NetworkEnum, dataProvider: string, symbol: string, startTime: number, endTime: number): Promise<DataProviderSubmissionStats[]> {
        return new Promise<DataProviderSubmissionStats[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
                const epochBlockNumberFrom: number = epochStats.minBlockNumber;
                const epochBlockNumberTo: number = epochStats.maxBlockNumber;
                await this.getRevealedPrices(network, dataProvider, symbol, epochBlockNumberFrom, epochBlockNumberTo, 1, 0);
                const submissionStats: DataProviderSubmissionStats[] = await persistenceDao.getDataProviderSubmissionStats(epochBlockNumberFrom, epochBlockNumberTo)
                resolve(submissionStats.filter(data =>
                    (isEmpty(dataProvider) || dataProvider.split(',').includes(data.dataProvider)) &&
                    (symbol == 'all' || (isEmpty(symbol) ? data.symbol == null : data.symbol === symbol))
                ));
            } catch (e) {
                this.logger.error(`Unable to get data providers submission stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
                reject(new Error(`Unable to get data providers submission stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`));
            }
        });
    }
    async getAvailableSymbols(network: NetworkEnum, startTime: number, endTime: number): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
                const epochBlockNumberFrom: number = epochStats.minBlockNumber;
                const epochBlockNumberTo: number = epochStats.maxBlockNumber;
                await this.getFinalizedPrices(network, null, epochBlockNumberFrom, epochBlockNumberTo, 1, 0);
                resolve(persistenceDao.getAvailableSymbols(epochBlockNumberFrom, epochBlockNumberTo));

            } catch (e) {
                this.logger.error(`Unable to get available symbols: ${e.message}`);
                reject(new Error(`Unable to get available symbols`));
            }
        });
    }
    async getRealTimeFtsoData(network: NetworkEnum): Promise<RealTimeFtsoData> {
        return new Promise<RealTimeFtsoData>(async (resolve, reject) => {
            try {
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }
                resolve(cacheDao.getRealTimeFtsoData());
            } catch (e) {
                this.logger.error(`Unable to get realtime ftso data: ${e.message}`);
                reject(new Error(`Unable to get realtime ftso data`));
            }
        });
    }
}
