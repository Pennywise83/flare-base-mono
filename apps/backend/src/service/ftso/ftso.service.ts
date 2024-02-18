import { Commons, DataProviderExtendedInfo, DataProviderInfo, HashSubmitted, NetworkEnum, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceRevealed, RewardEpoch, RewardEpochSettings, SortOrderEnum, VotePower, VotePowerDTO, VoterWhitelist } from "@flare-base/commons";
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty, isNotEmpty } from "class-validator";
import * as fs from 'fs';
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { RewardDistributed } from "libs/commons/src/model/ftso/reward-distributed";
import * as path from 'path';
import { interval } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { DelegationsService } from "../delegations/delegations.service";
import { EpochsService } from "../epochs/epochs.service";
import { ServiceStatusEnum } from "../network-dao-dispatcher/model/service-status.enum";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ServiceUtils } from "../service-utils";
import { TowoLabsDataProviderInfo } from "./model/towo-data-provider-info";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
@Injectable()
export class FtsoService {
    logger: Logger = new Logger(FtsoService.name);
    private _priceFinalizedList: { [network: string]: { [priceEpoch: number]: { [symbol: string]: PriceFinalized } } } = {};
    private _priceRevealedList: { [network: string]: { [priceEpoch: number]: { [symbol: string]: PriceRevealed[] } } } = {};
    private _hashSubmittedList: { [network: string]: { [priceEpoch: number]: HashSubmitted[] } } = {};
    private _rewardDistributedList: { [network: string]: { [priceEpoch: number]: RewardDistributed[] } } = {};
    private _voterWhitelistList: { [network: string]: VoterWhitelist[] } = {};

    private _lastBlockNumber: { [network: string]: number } = {};

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
                    interval(((networkConfig.towoLabsFtsoFetchEveryMinutes) * 60) * 1000).subscribe(async () => {
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
            this.logger.log(`${network} - Fetching voterWhitelist for rewardEpoch ${rewardEpoch.id}`);
            await this.getVoterWhitelist(network, null, rewardEpoch.votePowerBlockNumber, 0);
            rewardEpochIdx++;
        }

        let actualBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        let persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.VoterWhitelist, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingBalancesBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingBalancesBlockNumbers) {
            this.logger.log(`${network} - Fetching latest voter whitelist`);
            await this.getVoterWhitelist(network, null, missingBlockNumbers.to, 0);
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

            blockchainDao.priceEpochListener$.subscribe(async priceEpoch => {
                this.logger.log(`${network} - ${priceEpoch.id} - Price epoch finalized.`);
                const lastBlockNumber: number = await blockchainDao.provider.getBlockNumber();
                await this._storeFtsoPrices(network, priceEpoch, persistenceDao, lastBlockNumber);
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
                if (isEmpty(this._rewardDistributedList[network][rewardDistributed.epochId])) { this._rewardDistributedList[network][rewardDistributed.epochId] = [] }
                this._rewardDistributedList[network][rewardDistributed.epochId].push(rewardDistributed);
            });

            blockchainDao.voterWhitelistListener$.subscribe(async voterWhitelist => {
                if (isEmpty(this._voterWhitelistList[network])) { this._voterWhitelistList[network] = [] }
                this._voterWhitelistList[network].push(voterWhitelist);
            });


            await blockchainDao.startPriceFinalizedListener();
            await blockchainDao.startPricesRevealedListener();
            await blockchainDao.startHashSubmittedListener();
            await blockchainDao.startRewardDistributedListener();
            await blockchainDao.startVoterWhitelistListener();

            return Promise.resolve();
        } catch (err) {
            throw new Error(`Unable to initialize FtsoService: ${err.message}`);
        }

    }

    async getVoterWhitelistByAddress(network: NetworkEnum, address: string, targetTime: number, pageSize: number): Promise<VoterWhitelist[]> {
        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, priceEpochSettings.firstEpochStartTime, targetTime);
        if (isNotEmpty(epochStats)) {
            const epochBlockNumberTo: number = epochStats.maxBlockNumber;
            return await this.getVoterWhitelist(network, address, epochBlockNumberTo, 1);
        } else {
            return [];
        }
    }
    async getVoterWhitelistByCurrency(network: NetworkEnum, currency: string, targetTime: number, pageSize: number): Promise<VoterWhitelist[]> {
        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, priceEpochSettings.firstEpochStartTime, targetTime);
        if (isNotEmpty(epochStats)) {
            const epochBlockNumberTo: number = epochStats.maxBlockNumber;
            return (await this.getVoterWhitelist(network, null, epochBlockNumberTo, 1)).filter(vw => vw.symbol == currency);
        } else {
            return [];
        }

    }
    async getWhitelistedDataProvidersAddresses(network: NetworkEnum, whitelisted: boolean, rewardEpochId: number, pageSize: number): Promise<string[]> {
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

    private async _storeFtsoPrices(network: NetworkEnum, priceEpoch: PriceEpoch, persistenceDao: IPersistenceDao, lastBlockNumber: number) {
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

        if (this._priceRevealedList[network][priceEpoch.id]) {
            for (let symbol in this._priceRevealedList[network][priceEpoch.id]) {
                this.logger.log(`${network} - ${priceEpoch.id} - ${symbol} - ${this._priceRevealedList[network][priceEpoch.id][symbol].length} revealed prices`)
            }
        }
        if (this._hashSubmittedList[network][priceEpoch.id]) {
            this.logger.log(`${network} - ${priceEpoch.id} -  ${this._hashSubmittedList[network][priceEpoch.id].length} hashes submitted`)
        }
        if (this._rewardDistributedList[network][priceEpoch.id]) {
            this.logger.log(`${network} - ${priceEpoch.id} -  ${this._rewardDistributedList[network][priceEpoch.id].length} rewards distributes `)
        }
        this._priceFinalizedList[network][priceEpoch.id] = null;
        delete this._priceFinalizedList[network][priceEpoch.id];
        this._priceRevealedList[network][priceEpoch.id] = null;
        delete this._priceRevealedList[network][priceEpoch.id];
        this._hashSubmittedList[network][priceEpoch.id] = null;
        delete this._hashSubmittedList[network][priceEpoch.id];
        this._rewardDistributedList[network][priceEpoch.id] = null;
        delete this._rewardDistributedList[network][priceEpoch.id];

        this.logger.debug(`${network} - Stored 0 priceEpochs from listener`);
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
                const whitelistedAddresses: string[] = await this.getWhitelistedDataProvidersAddresses(network, true, rewardEpochId, 1);
                const dataProvidersInfo: DataProviderInfo[] = await this.getDataProvidersInfo(network);
                votePowerPersistenceData.map(vp => {
                    let previousVotePower: VotePower = previousVotePowerPersistenceData.find(previousVp => previousVp.address == vp.address)
                    let dpExtendedInfo: DataProviderExtendedInfo = new DataProviderExtendedInfo(vp, previousVotePower, dataProvidersInfo, totalVotePower, previousTotalVotePower, whitelistedAddresses);
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
}
