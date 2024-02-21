import { Balance, NetworkEnum, PaginatedResult, PriceEpochSettings, RewardEpoch, RewardEpochSettings } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isNotEmpty } from "class-validator";
import { TransactionSortEnum, WrappedBalance } from "libs/commons/src/model/balances/balance";
import { EpochSortEnum, PriceEpoch } from "libs/commons/src/model/epochs/price-epoch";
import { SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { interval } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { DelegationsService } from "../delegations/delegations.service";
import { EpochsService } from "../epochs/epochs.service";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ProgressGateway } from "../progress.gateway";
import { ServiceUtils } from "../service-utils";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";

@Injectable()
export class BalancesService {

    logger: Logger = new Logger(BalancesService.name);
    private _balancesList: { [network: string]: Array<Balance> } = {};
    private _lastBlockNumber: { [network: string]: number } = {};
    private _networkConfig: { [network: string]: NetworkConfig } = {};

    constructor(
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private readonly _configService: ConfigService,
        private readonly _epochsService: EpochsService
    ) { }
    async initialize(): Promise<void> {
        try {
            this.logger.log(`Initializing...`);
            const availableNetworks: NetworkEnum[] = await this._networkDaoDispatcher.getAvailableNetworks();
            const networkConfigurations: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
            for (const network of availableNetworks) {
                const networkConfig = networkConfigurations.find(nConfig => nConfig.name === network);
                this._networkConfig[network] = networkConfig;
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                if (networkConfig && networkConfig.scanActive) {
                    await this._bootstrapBalancesScan(network, persistenceDao, blockchainDao);
                    await this._startBalancesListener(network, persistenceDao, blockchainDao, networkConfig);
                }
            }
            this.logger.log(`Initialized.`);
            return;
        } catch (err) {
            throw new Error(`Unable to initialize DelegationService: ${err.message}`);
        }
    }
    private async _bootstrapBalancesScan(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Starting balances scan bootstrap...`);
        const startTime: number = new Date().getTime();
        const rewardEpochsSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const rewardEpochs: RewardEpoch[] = (await this._epochsService.getRewardEpochs(network, rewardEpochsSettings.firstEpochStartTime, new Date().getTime(), 1, 10000, EpochSortEnum.id, SortOrderEnum.asc)).results;
        let rewardEpochIdx: number = 0;

        for (let rewardEpoch of rewardEpochs) {
            this.logger.log(`${network} - Fetching balances for rewardEpoch ${rewardEpoch.id}`);
            await this.getBalances(network, null, rewardEpoch.votePowerBlockNumber, 0);
            rewardEpochIdx++;
        }

        let actualBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        let persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Balance, 'all', rewardEpochs[0].blockNumber, actualBlockNumber);
        let missingBalancesBlockNumbers: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, rewardEpochs[0].blockNumber, actualBlockNumber);
        for (const missingBlockNumbers of missingBalancesBlockNumbers) {
            this.logger.log(`${network} - Fetching latest balances`);
            await this.getBalances(network, null, missingBlockNumbers.to, 0);
        }
        this.logger.log(`${network} - Balances scan bootstrap finished. Duration: ${(new Date().getTime() - startTime) / 1000} s`);
        return;
    }


    private async _startBalancesListener(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, networkConfig: NetworkConfig): Promise<void> {
        this._lastBlockNumber[network] = await blockchainDao.provider.getBlockNumber();
        if (!this._balancesList[network]) {
            this._balancesList[network] = [];
        }

        blockchainDao.wrappedBalanceListener$.subscribe(async balance => {
            this._balancesList[network].push(balance);
        });

        this.logger.log(`${network} - Initializing balances listener. Collect items every ${networkConfig.collectBlockchainDataIntervalSeconds} seconds`);
        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        interval(networkConfig.collectBlockchainDataIntervalSeconds * 1000).subscribe(async () => {
            const lastBlockNumber: number = await blockchainDao.provider.getBlockNumber();
            await this.storeBalances(network, persistenceDao, lastBlockNumber, rewardEpochSettings);
        });
        await blockchainDao.startWrappedBalanceListener();
        return;
    }


    private async storeBalances(network: NetworkEnum, persistenceDao: IPersistenceDao, lastBlockNumber: number, rewardEpochSettings: RewardEpochSettings) {
        const balancesToLoad: Balance[] = [...this._balancesList[network]];
        this._balancesList[network] = [];
        this.logger.log(`${network} - Collected ${balancesToLoad.length} balances from listener`);

        let startBlock: number;
        const minListenerBlock: number = Math.min(...balancesToLoad.map(d => d.blockNumber));
        const maxListenerBlock: number = Math.max(...balancesToLoad.map(d => d.blockNumber));

        if (isNotEmpty(this._lastBlockNumber[network])) {
            startBlock = Math.min(this._lastBlockNumber[network], minListenerBlock);
        } else {
            startBlock = minListenerBlock;
        }
        const endBlock: number = Math.max(maxListenerBlock, lastBlockNumber);
        const stored: number = await persistenceDao.storeBalances(balancesToLoad);
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Balance, null, startBlock, endBlock);

        this._lastBlockNumber[network] = lastBlockNumber;
        this.logger.debug(`${network} - Stored ${stored} balances from listener`);
    }

    async getWrappedTransfers(
        network: NetworkEnum,
        address: string,
        startTime: number,
        endTime: number,
        page: number,
        pageSize: number,
        sortField?: TransactionSortEnum,
        sortOrder?: SortOrderEnum): Promise<void> {
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
        if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        return;
    }




    async getBalances(network: NetworkEnum, dataProviderAddress: string, targetBlockNumber: number, pageSize: number): Promise<Balance[]> {
        return new Promise<Balance[]>(async (resolve, reject) => {
            try {
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

                if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
                    throw new Error(`Service unavailable`);
                }
                const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Balance, dataProviderAddress, 0, targetBlockNumber);
                const missingBlocks: PersistenceMetadataScanInfo[] = new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, targetBlockNumber);
                if (missingBlocks.length > 0) {
                    for (const missingBalanceBlockNumber of missingBlocks) {
                        this.logger.log(`${network} - Fetching balances for address:'${isNotEmpty(dataProviderAddress) ? dataProviderAddress : '*'}'  - From block ${missingBalanceBlockNumber.from} to ${missingBalanceBlockNumber.to} - Size: ${missingBalanceBlockNumber.to - missingBalanceBlockNumber.from}`);
                        const blockchainData: Balance[] = await blockchainDao.getBalances(dataProviderAddress, missingBalanceBlockNumber.from, missingBalanceBlockNumber.to);
                        await persistenceDao.storeBalances(blockchainData);
                        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Balance, dataProviderAddress, missingBalanceBlockNumber.from, missingBalanceBlockNumber.to);
                    }
                    resolve(this.getBalances(network, dataProviderAddress, targetBlockNumber, pageSize));
                }
                if (pageSize > 0) {
                    if (persistenceMetadata.length > 5) {
                        await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Balance, persistenceMetadata);
                    }
                    resolve(await persistenceDao.getBalances(dataProviderAddress, targetBlockNumber));
                } else {
                    resolve([]);
                }
            } catch (e) {
                this.logger.error(`Unable to get balances. Address: ${dataProviderAddress} - Target blockNumber: ${targetBlockNumber}: `, e.message);
                reject(new Error(`Unable to get vote power`));
            }

        });
    }

    async getDataProviderWrappedBalancesByAddress(network: NetworkEnum, rewardEpochId: number): Promise<WrappedBalance[]> {
        return new Promise<WrappedBalance[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: WrappedBalance[] = await cacheDao.getDataProviderWrappedBalancesByAddress(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getWrappedBalance(network, null, rewardEpochId);
                const uniqueDataProviderAddressList: string[] = await this.getUniqueDataProviderAddressList(network, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    let wrappedBalances: WrappedBalance[] = [];
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    wrappedBalances.push(...await persistenceDao.getDataProvidersWrappedBalancesByAddress(uniqueDataProviderAddressList, rewardEpochId, lastFinalizedPriceEpoch.blockNumber, lastFinalizedPriceEpoch.timestamp));
                    await cacheDao.setDataProviderWrappedBalancesByAddress(rewardEpochId, wrappedBalances, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(wrappedBalances);
                } else {
                    let wrappedBalances: WrappedBalance[] = [];
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    wrappedBalances.push(...await persistenceDao.getDataProvidersWrappedBalancesByAddress(uniqueDataProviderAddressList, rewardEpochId, rewardEpoch.votePowerBlockNumber, rewardEpoch.votePowerTimestamp));
                    await cacheDao.setDataProviderWrappedBalancesByAddress(rewardEpochId, wrappedBalances);
                    resolve(wrappedBalances);
                }

            } catch (e) {
                this.logger.error(`Unable to get data providers wrapped balances grouped by addresses. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers wrapped balances grouped by addresses.`));
            }
        });
    };
    async getDataProviderWrappedBalancesByRewardEpoch(network: NetworkEnum, rewardEpochId: number): Promise<WrappedBalance> {
        return new Promise<WrappedBalance>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: WrappedBalance = await cacheDao.getDataProviderWrappedBalancesByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getWrappedBalance(network, null, rewardEpochId);
                const uniqueDataProviderAddressList: string[] = await this.getUniqueDataProviderAddressList(network, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    let wrappedBalance: WrappedBalance = null;
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    wrappedBalance = await persistenceDao.getDataProvidersWrappedBalancesByRewardEpoch(uniqueDataProviderAddressList, rewardEpochId, lastFinalizedPriceEpoch.blockNumber, lastFinalizedPriceEpoch.timestamp);
                    await cacheDao.setDataProviderWrappedBalancesByRewardEpoch(rewardEpochId, wrappedBalance, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(wrappedBalance);
                } else {
                    let wrappedBalance: WrappedBalance = null;

                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    wrappedBalance = await persistenceDao.getDataProvidersWrappedBalancesByRewardEpoch(uniqueDataProviderAddressList, rewardEpochId, rewardEpoch.votePowerBlockNumber, rewardEpoch.votePowerTimestamp);
                    await cacheDao.setDataProviderWrappedBalancesByRewardEpoch(rewardEpochId, wrappedBalance);
                    resolve(wrappedBalance);
                }

            } catch (e) {
                this.logger.error(`Unable to get data providers wrapped balances grouped by reward epoch. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers wrapped balances grouped by reward epoch.`));
            }
        });
    };
    async getWrappedBalancesByRewardEpoch(network: NetworkEnum, rewardEpochId: number): Promise<WrappedBalance> {
        return new Promise<WrappedBalance>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: WrappedBalance = await cacheDao.getWrappedBalancesByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }

                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getWrappedBalance(network, null, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    let wrappedBalance: WrappedBalance = null;
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    wrappedBalance = await persistenceDao.getWrappedBalance(null, rewardEpochId, lastFinalizedPriceEpoch.blockNumber);
                    await cacheDao.setWrappedBalancesByRewardEpoch(rewardEpochId, wrappedBalance, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(wrappedBalance);
                } else {
                    let wrappedBalance: WrappedBalance = null;
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    wrappedBalance = await persistenceDao.getWrappedBalance(null, rewardEpochId, rewardEpoch.blockNumber);
                    await cacheDao.setWrappedBalancesByRewardEpoch(rewardEpochId, wrappedBalance);
                    resolve(wrappedBalance);
                }

            } catch (e) {
                this.logger.error(`Unable to get total wrapped balances grouped by reward epoch. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get total wrapped balances`));
            }
        });
    };

    async getWrappedBalance(network: NetworkEnum, dataProviderAddress: string, rewardEpochId: number): Promise<WrappedBalance> {
        return new Promise<WrappedBalance>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: WrappedBalance = await cacheDao.getWrappedBalance(rewardEpochId, dataProviderAddress);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                if (rewardEpochId == nextEpochId) {
                    let wrappedBalance: WrappedBalance = null;
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    await this.getBalances(network, dataProviderAddress, lastFinalizedPriceEpoch.blockNumber, 0);
                    wrappedBalance = await persistenceDao.getWrappedBalance(dataProviderAddress, rewardEpochId, lastFinalizedPriceEpoch.blockNumber);
                    wrappedBalance.timestamp = lastFinalizedPriceEpoch.timestamp;
                    await cacheDao.setWrappedBalance(rewardEpochId, dataProviderAddress, wrappedBalance, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(wrappedBalance);
                } else {
                    let wrappedBalance: WrappedBalance = null;
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    await this.getBalances(network, dataProviderAddress, rewardEpoch.votePowerBlockNumber, 0);
                    wrappedBalance = await persistenceDao.getWrappedBalance(dataProviderAddress, rewardEpochId, rewardEpoch.blockNumber);
                    wrappedBalance.timestamp = rewardEpoch.votePowerTimestamp;
                    await cacheDao.setWrappedBalance(rewardEpochId, dataProviderAddress, wrappedBalance);
                    resolve(wrappedBalance);
                }

            } catch (e) {
                this.logger.error(`Unable to get wrapped balances. Address: ${dataProviderAddress} - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get vote power`));
            }
        });
    };
    async getUniqueDataProviderAddressList(network: NetworkEnum, rewardEpochId: number): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                throw new Error(`Service unavailable`);
            }
            const cacheData: string[] = await cacheDao.getUniqueDataProviderAddressList(rewardEpochId);
            if (isNotEmpty(cacheData)) {
                resolve(cacheData);
                return;
            }
            const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
            const nextEpochId: number = rewardEpochSettings.getNextEpochId();
            if (rewardEpochId < nextEpochId) {
                const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                const persistenceData: string[] = await persistenceDao.getUniqueDataProviderAddressList(rewardEpoch.votePowerTimestamp);
                cacheDao.setUniqueDataProviderAddressList(rewardEpochId, persistenceData);
                resolve(persistenceData);
                return;
            } else {
                const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                const cacheEndTime: number = priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId());
                const persistenceData: string[] = await persistenceDao.getUniqueDataProviderAddressList(cacheEndTime);
                cacheDao.setUniqueDataProviderAddressList(rewardEpochId, persistenceData, cacheEndTime);
                resolve(persistenceData);
                return;
            }
        })

    }
}