import { Commons, DataProviderExtendedInfo, DataProviderInfo, FtsoFee, FtsoFeeSortEnum, FtsoRewardStats, FtsoRewardStatsGroupByEnum, HashSubmitted, NetworkEnum, PaginatedResult, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceFinalizedSortEnum, PriceRevealed, PriceRevealedSortEnum, RewardEpoch, RewardEpochDTO, RewardEpochSettings, SortOrderEnum, VotePower, VotePowerDTO, VoterWhitelist } from "@flare-base/commons";
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty, isNotEmpty } from "class-validator";
import * as fs from 'fs';
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { RewardDistributed, RewardDistributedSortEnum } from "libs/commons/src/model/ftso/reward-distributed";
import * as path from 'path';
import { interval } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { DelegationsService } from "../delegations/delegations.service";
import { EpochsService } from "../epochs/epochs.service";
import { ServiceStatusEnum } from "../network-dao-dispatcher/model/service-status.enum";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
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
    private _lastBlockNumber: { [network: string]: number } = {};
    private _firstRun: boolean = true;

    constructor(
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private _configService: ConfigService,
        private _epochsService: EpochsService,
        private _delegationsService: DelegationsService,
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
                if (networkConfig && networkConfig.scanActive) {
                    const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                    const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

                    await this._startFtsoListeners(network, persistenceDao, blockchainDao, networkConfig);
                    await this._bootstrapFtsoScan(network, persistenceDao, blockchainDao);
                    interval(((networkConfig.towoLabsFtsoFetchEveryMinutes) * 30) * 1000).subscribe(async () => {
                        this.logger.log(`${network} - Fetching Towo Ftso Provider Data...`)
                        let remoteData: DataProviderInfo[] = await this.getTowoLabsFtsoInfo(network);
                        await persistenceDao.storeFtsoInfo(remoteData);
                        this.logger.log(`${network} - Towo Ftso Provider Data succesfully stored.`);
                    });

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
        this.logger.log(`${network} - Ftso scan bootstrap finished. Duration: ${(new Date().getTime() - startTime) / 1000} s`);
        return;
    }
    private async _startFtsoListeners(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, networkConfig: NetworkConfig): Promise<void> {
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
                // await this._storeFtsoPrices(network, priceEpoch, persistenceDao, blockchainDao, lastBlockNumber);
            });

            blockchainDao.pricesRevealedListener$.subscribe(async priceRevealed => {
                if (isEmpty(this._priceRevealedList[network][priceRevealed.epochId])) { this._priceRevealedList[network][priceRevealed.epochId] = {} }
                if (isEmpty(this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol])) { this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol] = [] }
                this._priceRevealedList[network][priceRevealed.epochId][priceRevealed.symbol].push(priceRevealed);
            });

            blockchainDao.pricesFinalizedListener$.subscribe(async priceFinalized => {
                if (isEmpty(this._priceFinalizedList[network][priceFinalized.epochId])) { this._priceFinalizedList[network][priceFinalized.epochId] = {} }
                if (isEmpty(this._priceFinalizedList[network][priceFinalized.epochId][priceFinalized.symbol])) { this._priceFinalizedList[network][priceFinalized.epochId][priceFinalized.symbol] = priceFinalized }
                if (Object.keys(this._priceFinalizedList[network][priceFinalized.epochId]).length == blockchainDao.getActiveFtsoContracts()) {
                    // Store

                }

            });

            blockchainDao.hashSubmittedListener$.subscribe(async hashSubmitted => {
                if (isEmpty(this._hashSubmittedList[network][hashSubmitted.epochId])) { this._hashSubmittedList[network][hashSubmitted.epochId] = [] }
                this._hashSubmittedList[network][hashSubmitted.epochId].push(hashSubmitted);
            });

            blockchainDao.rewardDistributedListener$.subscribe(async rewardDistributed => {
                if (isEmpty(this._rewardDistributedList[network][rewardDistributed.priceEpochId])) { this._rewardDistributedList[network][rewardDistributed.priceEpochId] = [] }
                this._rewardDistributedList[network][rewardDistributed.priceEpochId].push(rewardDistributed);
            });

            blockchainDao.voterWhitelistListener$.subscribe(async voterWhitelist => {
                if (isEmpty(this._voterWhitelistList[network])) { this._voterWhitelistList[network] = [] }
                this._voterWhitelistList[network].push(voterWhitelist);
            });

            blockchainDao.ftsoFeeListener$.subscribe(async ftsoFee => {
                if (isEmpty(this._ftsoFeeList[network])) { this._ftsoFeeList[network] = [] }
                this._ftsoFeeList[network].push(ftsoFee);
            });


            await blockchainDao.startPriceFinalizedListener();
            await blockchainDao.startPricesRevealedListener();
            await blockchainDao.startHashSubmittedListener();
            await blockchainDao.startRewardDistributedListener();
            await blockchainDao.startVoterWhitelistListener();
            await blockchainDao.startFtsoFeeListener();

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

    private async _storeListenerEvents(network: NetworkEnum, priceEpoch: PriceEpoch, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, lastBlockNumber: number) {
        let priceEpochsToLoad: PriceEpoch[] = [...[priceEpoch]];
        let startBlock: number;
        const minListenerBlock: number = Math.min(...priceEpochsToLoad.map(d => d.blockNumber));
        const maxListenerBlock: number = Math.max(...priceEpochsToLoad.map(d => d.blockNumber));

        if (isNotEmpty(this._lastBlockNumber[network])) {
            startBlock = Math.min(this._lastBlockNumber[network], minListenerBlock);
        } else {
            startBlock = minListenerBlock;
        }
        const endBlock: number = Math.max(maxListenerBlock, lastBlockNumber);
        this._lastBlockNumber[network] = lastBlockNumber;

        if (this._ftsoFeeList[network]) {
            this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._ftsoFeeList[network].length} ftso fee changes from listener`);
            const storedFtsoFee: number = await persistenceDao.storeFtsoFee(this._ftsoFeeList[network]);
            this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedFtsoFee} ftso fee changes from listener`);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FtsoFee, null, startBlock, endBlock);
        }

        if (this._priceFinalizedList[network] && this._priceFinalizedList[network][priceEpoch.id]) {
            let finalizedPricesToLoad: PriceFinalized[] = [];
            for (let symbol in this._priceFinalizedList[network][priceEpoch.id]) {
                this.logger.log(`${network} - ${priceEpoch.id} - ${symbol} - Collected ${Object.keys(this._priceFinalizedList[network][priceEpoch.id]).length} finalized prices from listener`)
                finalizedPricesToLoad.push(this._priceFinalizedList[network][priceEpoch.id][symbol]);
            }
            if (finalizedPricesToLoad.length != blockchainDao.getActiveFtsoContracts()) {
                await this.getFinalizedPrices(network, null, startBlock, endBlock, 1, 0);
            } else {
                const storedFinalizedPrices: number = await persistenceDao.storeFinalizedPrices(finalizedPricesToLoad);
                this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedFinalizedPrices} finalized prices from listener`);
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, startBlock, endBlock);
            }
            this._priceFinalizedList[network][priceEpoch.id] = null;
            delete this._priceFinalizedList[network][priceEpoch.id];


            if (this._firstRun) {
                await this.getRevealedPrices(network, null, null, startBlock, endBlock, 1, 0);
                this._firstRun = false;
            } else {
                if (this._priceRevealedList[network] && this._priceRevealedList[network][priceEpoch.id]) {
                    let tmpPriceRevealedList: PriceRevealed[] = [];
                    for (let symbol in this._priceRevealedList[network][priceEpoch.id]) {
                        this.logger.log(`${network} - ${priceEpoch.id} - ${symbol} - Collected ${this._priceRevealedList[network][priceEpoch.id][symbol].length} revealed prices from listener`)
                        tmpPriceRevealedList.push(...this._priceRevealedList[network][priceEpoch.id][symbol]);
                    }
                    const storedRevealedPrices: number = await persistenceDao.storeRevealedPrices(this.parseRevealedPriceScores(tmpPriceRevealedList, finalizedPricesToLoad));
                    this.logger.log(`${network} - ${priceEpoch.id} - Stored ${storedRevealedPrices} revealed prices from listener`);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock);
                }
            }
            this._priceRevealedList[network][priceEpoch.id] = null;
            delete this._priceRevealedList[network][priceEpoch.id];
        }


        if (this._hashSubmittedList[network] && this._hashSubmittedList[network][priceEpoch.id]) {
            this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._hashSubmittedList[network][priceEpoch.id].length} hashes submitted from listener`)
        }
        if (this._rewardDistributedList[network] && this._rewardDistributedList[network][priceEpoch.id]) {
            this.logger.log(`${network} - ${priceEpoch.id} -  Collected ${this._rewardDistributedList[network][priceEpoch.id].length} rewards distributed from listener `)
        }

        this._hashSubmittedList[network][priceEpoch.id] = null;
        delete this._hashSubmittedList[network][priceEpoch.id];
        this._rewardDistributedList[network][priceEpoch.id] = null;
        delete this._rewardDistributedList[network][priceEpoch.id];


    }

    async getDataProvidersInfo(network: NetworkEnum): Promise<DataProviderInfo[]> {
        return new Promise<DataProviderInfo[]>(async (resolve, reject) => {
            let persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            try {
                if (isEmpty(persistenceDao) || (isNotEmpty(persistenceDao) && persistenceDao.status !== ServiceStatusEnum.STARTED)) {
                    reject(new Error(`Service unavailable`));
                    return;
                }
                const daoData: DataProviderInfo[] = await persistenceDao.getFtsoInfo();
                if (isNotEmpty(daoData) && daoData.length > 0) {
                    resolve(daoData);
                    return;
                }
                let remoteData: DataProviderInfo[] = await this.getTowoLabsFtsoInfo(network);
                await persistenceDao.storeFtsoInfo(remoteData);
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
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();

                let results: DataProviderExtendedInfo[] = [];
                const votePowerPersistenceData: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
                const previousVotePowerPersistenceData: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                const totalVotePower: VotePowerDTO = await this._delegationsService.getTotalVotePowerByRewardEpoch(network, rewardEpochId);
                const previousTotalVotePower: VotePowerDTO = await this._delegationsService.getTotalVotePowerByRewardEpoch(network, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                const whitelistedAddresses: string[] = await this.getWhitelistedDataProvidersAddresses(network, true, rewardEpochId);
                const dataProvidersInfo: DataProviderInfo[] = await this.getDataProvidersInfo(network);
                const ftsoRewardStats: FtsoRewardStats[] = await this.getFtsoRewardStatsByRewardEpoch(network, null, rewardEpochId);
                const previousFtsoRewardStats: FtsoRewardStats[] = await this.getFtsoRewardStatsByRewardEpoch(network, null, rewardEpochId > 0 ? rewardEpochId - 1 : rewardEpochId);
                votePowerPersistenceData.map(vp => {
                    const previousVotePower: VotePower = previousVotePowerPersistenceData.find(previousVp => previousVp.address == vp.address);
                    const ftsoRewardStat: FtsoRewardStats = ftsoRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                    const previousFtsoRewardStat: FtsoRewardStats = previousFtsoRewardStats.find(previousRs => previousRs.dataProvider == vp.address);
                    const dpExtendedInfo: DataProviderExtendedInfo = new DataProviderExtendedInfo(vp, previousVotePower, dataProvidersInfo, totalVotePower, previousTotalVotePower, whitelistedAddresses, ftsoRewardStat, previousFtsoRewardStat);
                    results.push(dpExtendedInfo);
                });
                if (rewardEpochId == nextEpochId) {
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    cacheDao.setDataProvidersData(rewardEpochId, results, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                } else {
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
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
        if (isNotEmpty(symbol)) {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FinalizedPrice, symbol, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        } else {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        }
        if (missingBlocks.length > 0) {
            for (const missingBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching finalized prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                let blockchainData: PriceFinalized[] = [];
                if (isNotEmpty(symbol)) {
                    blockchainData.push(...await blockchainDao.getFinalizedPrices(symbol, missingBlockNumber.from, missingBlockNumber.to))
                } else {
                    blockchainData.push(...await blockchainDao.getFinalizedPrices(null, missingBlockNumber.from, missingBlockNumber.to))
                }
                this.logger.log(`Collected ${blockchainData.length} events`)
                if (blockchainData.length > 0) {
                    await persistenceDao.storeFinalizedPrices(blockchainData);
                }
                if (isNotEmpty(symbol)) {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, symbol, missingBlockNumber.from, missingBlockNumber.to);
                } else {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.FinalizedPrice, null, missingBlockNumber.from, missingBlockNumber.to);
                }
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

        paginatedResults = await this.getRevealedPrices(network, dataProvider, symbol, epochBlockNumberFrom, epochBlockNumberTo, page, pageSize, sortField!, sortOrder!);
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

        let paginatedResults: PaginatedResult<PriceRevealed[]> = new PaginatedResult<PriceRevealed[]>(page, pageSize, sortField, sortOrder, 0, []);
        const priceEpochTo: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId);
        const priceEpochFrom: PriceEpoch = await this._epochsService.getPriceEpoch(network, epochId - 1);
        if (isEmpty(priceEpochTo) || isEmpty(priceEpochTo)) {
            throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}. Invalid epoch id.`);
            return;
        }
        paginatedResults = await this.getRevealedPrices(network, dataProvider, symbol, priceEpochFrom.blockNumber + 1, priceEpochTo.blockNumber, page, pageSize, sortField!, sortOrder!);
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
        if (isNotEmpty(dataProvider)) {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RevealedPrice, dataProvider, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        } else {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        }
        if (missingBlocks.length > 0) {
            for (const missingBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                let blockchainData: PriceRevealed[] = [];
                let blockRanges: { from: number, to: number }[] = [];
                if (missingBlockNumber.to - missingBlockNumber.from >= 2000) {
                    blockRanges = Commons.divideBlocks(missingBlockNumber.from, missingBlockNumber.to, 2000);
                } else {
                    blockRanges = [{from: missingBlockNumber.from, to: missingBlockNumber.to}];
                }
                for (let blockRange of blockRanges) {
                    if (isNotEmpty(dataProvider)) {
                        blockchainData.push(...await blockchainDao.getRevealedPrices(dataProvider, blockRange.from, blockRange.to))
                    } else {
                        blockchainData.push(...await blockchainDao.getRevealedPrices(null, blockRange.from, blockRange.to))
                    }
                }
                if (blockchainData.length > 0) {
                    const finalizedPrices: PriceFinalized[] = (await this.getFinalizedPrices(network, null, missingBlockNumber.from, missingBlockNumber.to, 1, 1_000_000)).results;
                    if (isEmpty(finalizedPrices)) {
                        throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}. Unable to retrieve finalized prices for the selected timerange.`);
                        return;
                    }
                    let parsedRevealedPrice: PriceRevealed[] = this.parseRevealedPriceScores(blockchainData, finalizedPrices);
                    await persistenceDao.storeRevealedPrices(parsedRevealedPrice);
                }
                if (isNotEmpty(dataProvider)) {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, dataProvider, missingBlockNumber.from, missingBlockNumber.to);
                } else {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RevealedPrice, null, missingBlockNumber.from, missingBlockNumber.to);
                }
            }
            return this.getRevealedPrices(network, dataProvider, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }

        if (missingBlocks.length === 0) {
            let daoData: PaginatedResult<PriceRevealed[]> = new PaginatedResult<PriceRevealed[]>(page, pageSize, sortField, sortOrder, 0, []);
            if (pageSize > 0) {
                daoData = await persistenceDao.getRevealedPrices(symbol, dataProvider, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }
            if (persistenceMetadata.length > 5) {
                await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.RevealedPrice, persistenceMetadata);
            }
            return daoData;
        }
        throw new Error(`Unable to get revealed prices for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}.`);

    }

    parseRevealedPriceScores(revealedPrices: PriceRevealed[], finalizedPrices: PriceFinalized[]): PriceRevealed[] {
        let results: PriceRevealed[] = [];
        finalizedPrices.map(finalizedPrice => {
            revealedPrices.filter(revealedPrice => revealedPrice.epochId == finalizedPrice.epochId && revealedPrice.symbol == finalizedPrice.symbol).map(revealedPrice => {
                revealedPrice.borderIQR = false;
                revealedPrice.borderPct = false;
                revealedPrice.outIQR = false;
                revealedPrice.outPct = false;
                revealedPrice.innerIQR = false;
                revealedPrice.innerPct = false;
                if (revealedPrice.price == finalizedPrice.price) {
                    revealedPrice.innerIQR = true;
                }
                if (revealedPrice.price > finalizedPrice.lowIQRRewardPrice && revealedPrice.price < finalizedPrice.highIQRRewardPrice) {
                    revealedPrice.innerIQR = true;
                } else {
                    revealedPrice.outIQR = true;
                }
                if (revealedPrice.price > finalizedPrice.lowPctRewardPrice && revealedPrice.price < finalizedPrice.highPctRewardPrice) {
                    revealedPrice.innerPct = true;
                } else {
                    revealedPrice.outPct = true;
                }
                if (revealedPrice.price == finalizedPrice.highIQRRewardPrice || revealedPrice.price == finalizedPrice.lowIQRRewardPrice) {
                    revealedPrice.borderIQR = true;
                    revealedPrice.outIQR = false;
                }
                if (revealedPrice.price == finalizedPrice.highPctRewardPrice || revealedPrice.price == finalizedPrice.lowPctRewardPrice) {
                    revealedPrice.borderPct = true;
                    revealedPrice.outPct = false;
                }


                results.push(revealedPrice);
            });
        });
        return results;
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
        dataProvider: string,
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
                    this.logger.log(`${network} - Fetching reward distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'} - From block ${missingBlockNumber.from} to ${missingBlockNumber.to} - Size: ${missingBlockNumber.to - missingBlockNumber.from}`);
                    let blockchainData: RewardDistributed[] = await blockchainDao.getRewardDistributed(missingBlockNumber.from, missingBlockNumber.to);
                    if (blockchainData.length > 0) {
                        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                        const ftsoFee: FtsoFee[] = await this.getFtsoFee(network, endBlock, null, null, null, true);
                        const rewardEpochTimestampMin: number = Math.min(...blockchainData.map(bd => bd.timestamp)) - (rewardEpochSettings.rewardEpochDurationMillis * 2);
                        const rewardEpochTimestampMax: number = Math.max(...blockchainData.map(bd => bd.timestamp)) + (rewardEpochSettings.rewardEpochDurationMillis * 2);
                        let rewardEpochs: RewardEpochDTO[] = (await this._epochsService.getRewardEpochsDto(network, rewardEpochTimestampMin, rewardEpochTimestampMax, 1, 1_000_000, EpochSortEnum.id, SortOrderEnum.asc)).results;
                        blockchainData.map(rewardDistributed => {
                            let providerFee: FtsoFee = ftsoFee.find(fee => fee.dataProvider == rewardDistributed.dataProvider);
                            if (typeof providerFee != 'undefined') {
                                rewardDistributed.providerReward = (rewardDistributed.reward / 100) * providerFee.value;
                                rewardDistributed.reward = rewardDistributed.reward - rewardDistributed.providerReward;
                            } else {
                                // Fee not found. Meaning that the data provider has never changed their fee. Using default.
                                rewardDistributed.providerReward = (rewardDistributed.reward / 100) * 20;
                                rewardDistributed.reward = rewardDistributed.reward - rewardDistributed.providerReward;
                            }
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
                        });
                        await persistenceDao.storeRewardDistributed(blockchainData);
                    }
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.RewardDistributed, null, missingBlockNumber.from, missingBlockNumber.to);
                }
                return this.getRewardsDistributed(network, dataProvider, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }

            if (missingBlocks.length === 0) {
                let daoData: PaginatedResult<RewardDistributed[]> = new PaginatedResult<RewardDistributed[]>(page, pageSize, sortField, sortOrder, 0, []);
                if (pageSize > 0) {
                    daoData = await persistenceDao.getRewardDistributed(dataProvider, symbol, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
                }
                if (persistenceMetadata.length > 5) {
                    await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.RewardDistributed, persistenceMetadata);
                }
                return daoData;
            }
            throw new Error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}.`);
        } catch (e) {
            this.logger.error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}.: ${e.message}`);
            throw new Error(`Unable to get rewards distributed for symbol: ${isNotEmpty(symbol) ? symbol : '*'} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}.`);
        }

    }

    async getFtsoRewardStatsByRewardEpoch(
        network: NetworkEnum,
        dataProvider: string,
        rewardEpochId: number,
    ): Promise<FtsoRewardStats[]> {
        try {
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                throw new Error(`Service unavailable`);
            }
            const cacheData: FtsoRewardStats[] = await cacheDao.getFtsoRewardStatsByRewardEpoch(rewardEpochId);
            /*       if (isNotEmpty(cacheData)) {
                      if (isNotEmpty(dataProvider)) {
                          return cacheData.filter(ftsoRewardStats => ftsoRewardStats.dataProvider == dataProvider);
                      } else {
                          return cacheData;
                      }
                  } */
            const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
            const nextEpochId: number = rewardEpochSettings.getNextEpochId();
            if (rewardEpochId > nextEpochId) {
                throw new Error(`Invalid reward epoch. Reward epoch is not finalized yet.`);
                return;
            }
            const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
            const previousRewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId - 1);
            await this.getRewardsDistributed(network, dataProvider, null, previousRewardEpoch.blockNumber, rewardEpoch.blockNumber, 1, 0);
            const ftsoRewardStats: FtsoRewardStats[] = await persistenceDao.getFtsoRewardStats(null, previousRewardEpoch.blockNumber, rewardEpoch.blockNumber, FtsoRewardStatsGroupByEnum.dataProvider);
            const votePower: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
            if (votePower.length > 0) {
                ftsoRewardStats.map(ftsoRewardStats => {
                    votePower.filter(vp => vp.address == ftsoRewardStats.dataProvider).map(vp => {
                        ftsoRewardStats.rewardRate = (ftsoRewardStats.delegatorsReward / vp.amount) * 100;
                    });
                });
            }
            if (rewardEpochId == rewardEpochSettings.getCurrentEpochId()) {
                const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                await cacheDao.setFtsoRewardStatsByRewardEpoch(rewardEpochId, ftsoRewardStats, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
            } else {
                await cacheDao.setFtsoRewardStatsByRewardEpoch(rewardEpochId, ftsoRewardStats);
            }
            if (isNotEmpty(dataProvider)) {
                return ftsoRewardStats.filter(ftsoRewardStat => ftsoRewardStat.dataProvider == dataProvider);
            } else {
                return ftsoRewardStats;
            }
        } catch (e) {
            this.logger.error(`Unable to get ftso reward stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
            throw new Error(`Unable to get ftso reward stats for reward epoch ${rewardEpochId} and dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`);
        }
    }

    async getFtsoRewardStatsByDataProvider(
        network: NetworkEnum,
        dataProvider: string,
        startTime: number,
        endTime: number
    ): Promise<FtsoRewardStats[]> {
        try {
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                throw new Error(`Service unavailable`);
            }
            const rewardEpochs: RewardEpochDTO[] = (await this._epochsService.getRewardEpochsDto(network, startTime, endTime, 1, 1_000_000, EpochSortEnum.id, SortOrderEnum.asc)).results;
            const epochBlockNumberFrom: number = Math.min(...rewardEpochs.map(re => re.startBlockNumber));;
            const epochBlockNumberTo: number = Math.max(...rewardEpochs.map(re => re.startBlockNumber));;
            await this.getRewardsDistributed(network, dataProvider, null, epochBlockNumberFrom, epochBlockNumberTo, 1, 0);
            const ftsoRewardStats: FtsoRewardStats[] = await persistenceDao.getFtsoRewardStats(dataProvider, epochBlockNumberFrom, epochBlockNumberTo, FtsoRewardStatsGroupByEnum.rewardEpochId)
            let rewardEpochIds: number[] = [];
            ftsoRewardStats.map(ftsoRewardStat => rewardEpochIds.push(ftsoRewardStat.epochId));
            rewardEpochIds = [... new Set(rewardEpochIds)].sort((a, b) => a - b);
            for (let i in rewardEpochIds) {
                const rewardEpochId: number = rewardEpochIds[i];
                const votePower: VotePowerDTO[] = await this._delegationsService.getDataProviderVotePowerByAddress(network, rewardEpochId);
                if (votePower.length > 0) {
                    ftsoRewardStats.filter(ftsoRewardStat => ftsoRewardStat.epochId == rewardEpochId).map(ftsoRewardStats => {
                        votePower.filter(vp => vp.address == dataProvider).map(vp => {
                            ftsoRewardStats.rewardRate = (ftsoRewardStats.delegatorsReward / vp.amount) * 100;
                        });
                    });
                }
            }
            return ftsoRewardStats.sort((a, b) => a.epochId - b.epochId);
        } catch (e) {
            this.logger.error(`Unable to get ftso reward stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}: ${e.message}`);
            throw new Error(`Unable to get ftso reward stats for dataProvider: ${isNotEmpty(dataProvider) ? dataProvider : '*'}`);
        }
        return;
    }
}
