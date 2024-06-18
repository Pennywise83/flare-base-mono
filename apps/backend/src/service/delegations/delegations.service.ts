import { Commons, Delegation, DelegationDTO, DelegationsSortEnum, NetworkEnum, PaginatedResult, PriceEpochSettings, RewardEpoch, RewardEpochSettings, VotePower, VotePowerDTO, VotePowerSortEnum, WebsocketTopicsEnum, WrappedBalance } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty, isNotEmpty } from "class-validator";
import { DelegationSnapshot } from "libs/commons/src/model/delegations/delegation";
import { EpochSortEnum, PriceEpoch } from "libs/commons/src/model/epochs/price-epoch";
import { SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { from, interval, mergeMap } from "rxjs";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { EpochStats } from "../../dao/persistence/impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "../../dao/persistence/impl/model/persistence-metadata";
import { NetworkConfig } from "../../model/app-config/network-config";
import { BalancesService } from "../balances/balances.service";
import { EpochsService } from "../epochs/epochs.service";
import { NetworkDaoDispatcherService } from "../network-dao-dispatcher/network-dao-dispatcher.service";
import { ProgressGateway } from "../progress.gateway";
import { ServiceUtils } from "../service-utils";

@Injectable()
export class DelegationsService {

    logger: Logger = new Logger(DelegationsService.name);
    private _delegationList: { [network: string]: Array<Delegation> } = {};
    private _lastBlockNumber: { [network: string]: number } = {};
    private _networkConfig: { [network: string]: NetworkConfig } = {};

    constructor(
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private readonly _epochsService: EpochsService,
        private readonly _balanceService: BalancesService,
        private readonly _configService: ConfigService,
        private readonly _progressGateway: ProgressGateway

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
                    await this._bootstrapDelegationsScan(network, persistenceDao, blockchainDao);
                    await this._startDelegationsListener(network, persistenceDao, blockchainDao, networkConfig);
                    await this._startRewardEpochListener(network, persistenceDao, blockchainDao);
                }
            }

            this.logger.log(`Initialized.`);
            return;
        } catch (err) {
            throw new Error(`Unable to initialize DelegationService: ${err.message}`);
        }
    }
    private async _bootstrapDelegationsScan(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Starting delegations scan bootstrap...`);
        const startTime: number = new Date().getTime();
        const rewardEpochsSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const nextEpochId: number = rewardEpochsSettings.getNextEpochId();
        const paginatedRewardEpochs: PaginatedResult<RewardEpoch[]> = await this._epochsService.getRewardEpochs(network, rewardEpochsSettings.firstEpochStartTime, new Date().getTime(), 1, 10000, EpochSortEnum.id, SortOrderEnum.asc);
        const rewardEpochs: RewardEpoch[] = paginatedRewardEpochs.results;
        let rewardEpochIdx: number = 0;
        this.logger.log(`${network} - Fetching delegations from rewardEpoch ${Math.min(...rewardEpochs.map(rewardEpoch => rewardEpoch.id))} to ${Math.max(...rewardEpochs.map(rewardEpoch => rewardEpoch.id))}`);
        for (let rewardEpoch of rewardEpochs) {
            this.logger.debug(`${network} - Fetching delegations for rewardEpoch ${rewardEpoch.id}`);
            if (rewardEpochIdx == 0) {
                await this.getDelegations(network, null, null, 0, rewardEpoch.blockNumber, 1, 0);
            } else {
                await this.getDelegations(network, null, null, rewardEpochs[rewardEpochIdx - 1].blockNumber, rewardEpoch.blockNumber, 1, 0);
            }
            rewardEpochIdx++;
        }

        for (let rewardEpoch of rewardEpochs) {
            await this.calculateDelegationSnapshotAt(network, rewardEpoch.id, persistenceDao, rewardEpoch.votePowerBlockNumber);
            rewardEpochIdx++;
        }

        let lastEpochIdSnapshotBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        await this.getDelegations(network, null, null, 0, lastEpochIdSnapshotBlockNumber, 1, 0);
        await this.calculateDelegationSnapshotAt(network, nextEpochId, persistenceDao, lastEpochIdSnapshotBlockNumber);

        let actualBlockNumber: number = await blockchainDao.provider.getBlockNumber();
        this.logger.log(`${network} - Syncronizing snapshots with latest delegations`);
        const delegations: PaginatedResult<Delegation[]> = await this.getDelegations(network, null, null, lastEpochIdSnapshotBlockNumber, actualBlockNumber, 1, 10000);
        this._lastBlockNumber[network] = actualBlockNumber;

        const delegationSnapshot: DelegationSnapshot[] = delegations.results.map(delegation => new DelegationSnapshot(delegation, nextEpochId));
        await persistenceDao.storeDelegationsSnapshot(delegationSnapshot, rewardEpochsSettings.getStartTimeForEpochId(nextEpochId));
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, null, 0, actualBlockNumber, nextEpochId.toString());

        const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, null, 0, actualBlockNumber, nextEpochId.toString());
        if (persistenceMetadata.length > 5) {
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, persistenceMetadata, nextEpochId.toString());
        }
        this.logger.log(`${network} - Delegations scan bootstrap finished. Duration: ${(new Date().getTime() - startTime) / 1000} s`);
        return;
    }
    private async _startRewardEpochListener(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao): Promise<void> {
        this.logger.log(`${network} - Initializing reward epoch listener`);
        const handleRewardEpoch = async (rewardEpoch: RewardEpoch) => {
            this.logger.log(`${network} - ${rewardEpoch.id} - Reward epoch finalized`);
            await this.calculateDelegationSnapshotAt(network, rewardEpoch.id, persistenceDao, rewardEpoch.votePowerBlockNumber);
            return await this.calculateDelegationSnapshotAt(network, rewardEpoch.id + 1, persistenceDao, this._lastBlockNumber[network]);
        };
        blockchainDao.rewardEpochListener$.subscribe(handleRewardEpoch);
        this.logger.log(`${network} - Reward epoch listener initialized`);
    }

    private async _startDelegationsListener(network: NetworkEnum, persistenceDao: IPersistenceDao, blockchainDao: IBlockchainDao, networkConfig: NetworkConfig): Promise<void> {
        if (!this._delegationList[network]) {
            this._delegationList[network] = [];
        }
        blockchainDao.delegationsListener$.subscribe(async delegation => {
            let delegationDTO: DelegationDTO = new DelegationDTO().fromDelegation(delegation, null, null)
            this._progressGateway.server.emit(`${WebsocketTopicsEnum.LATEST_DELEGATIONS.toString()}_${network}`, delegationDTO);
            this._delegationList[network].push(delegation);
        });

        this.logger.log(`${network} - Initializing delegations listener. Collect items every ${networkConfig.collectBlockchainDataIntervalSeconds} seconds`);
        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        interval(networkConfig.collectBlockchainDataIntervalSeconds * 1000).subscribe(async () => {
            const lastBlockNumber: number = await blockchainDao.provider.getBlockNumber();
            await this.storeDelegations(network, persistenceDao, lastBlockNumber, rewardEpochSettings);
        });

        await blockchainDao.startDelegationsListener();
        return;
    }




    private async calculateDelegationSnapshotAt(network: NetworkEnum, rewardEpochId: number, persistenceDao: IPersistenceDao, actualBlockNumber: number) {
        const startTime: number = new Date().getTime();
        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const nextEpochId: number = rewardEpochSettings.getNextEpochId();

        const persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, null, 0, actualBlockNumber, rewardEpochId.toString());
        let missingBlocks: PersistenceMetadataScanInfo[] = [];
        missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, actualBlockNumber))
        if (missingBlocks.length > 0) {
            this.logger.debug(`${network} - Reward epoch: ${rewardEpochId} - Calculating delegations snapshots`);
            const uniqueDataProviderAddressList: string[] = await this._balanceService.getUniqueDataProviderAddressList(network, rewardEpochId);
            if (uniqueDataProviderAddressList.length > 0) {
                this.logger.log(`${network} - Reward epoch: ${rewardEpochId} - Delegations snapshots -  Calculating ${uniqueDataProviderAddressList.length} snapshots...`);
                let counter: number = 0;
                await from(uniqueDataProviderAddressList).pipe(
                    mergeMap(async (dataProviderAddress, index) => {
                        try {
                            counter++;
                            this.logger.debug(`${network} - Reward epoch: ${rewardEpochId} - ${dataProviderAddress} - [${counter}/${uniqueDataProviderAddressList.length}] Calculating snapshot...`);
                            const response = await this.getDelegationsSnapshot(network, dataProviderAddress, rewardEpochId, actualBlockNumber);
                            return { response, index };
                        } catch (error) {
                            return { error, index };
                        }
                    }, 10)
                ).toPromise();
                await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, null, 0, actualBlockNumber, rewardEpochId.toString());
                this.logger.log(`${network} - Reward epoch: ${rewardEpochId} - Delegations snapshot calculation finished. Duration: ${(new Date().getTime() - startTime) / 1000} s`);
            }
        }
        return;
    }


    private async storeDelegations(network: NetworkEnum, persistenceDao: IPersistenceDao, lastBlockNumber: number, rewardEpochSettings: RewardEpochSettings) {
        const delegationsToLoad: Delegation[] = [...this._delegationList[network]];
        let delegationsSnapshotToLoad: DelegationSnapshot[] = [];
        this._delegationList[network] = [];
        const numDelegations = delegationsToLoad.length;
        this.logger.log(`${network} - Collected ${numDelegations} delegations from listener`);

        let startBlock: number;
        const minListenerBlock: number = Math.min(...delegationsToLoad.map(d => d.blockNumber));
        const maxListenerBlock: number = Math.max(...delegationsToLoad.map(d => d.blockNumber));

        if (isNotEmpty(this._lastBlockNumber[network])) {
            startBlock = Math.min(this._lastBlockNumber[network], minListenerBlock);
        } else {
            startBlock = minListenerBlock;
        }
        const endBlock: number = Math.max(maxListenerBlock, lastBlockNumber);

        const stored: number = await persistenceDao.storeDelegations(delegationsToLoad);
        const nextEpochId: number = rewardEpochSettings.getNextEpochId();
        delegationsToLoad.map(delegation => delegationsSnapshotToLoad.push(new DelegationSnapshot(delegation, nextEpochId)));
        await persistenceDao.storeDelegationsSnapshot(delegationsSnapshotToLoad, rewardEpochSettings.getStartTimeForEpochId(nextEpochId));
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, null, startBlock, endBlock);
        await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, null, startBlock, endBlock, nextEpochId.toString());

        this._lastBlockNumber[network] = lastBlockNumber;
        this.logger.debug(`${network} - Stored ${stored} delegations from listener`);
    }




    async getDelegationsDto(
        network: NetworkEnum,
        from: string,
        to: string,
        startTime: number,
        endTime: number,
        page: number,
        pageSize: number,
        sortField?: DelegationsSortEnum,
        sortOrder?: SortOrderEnum,
        requestId?: string
    ): Promise<PaginatedResult<DelegationDTO[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        const paginatedResults: PaginatedResult<DelegationDTO[]> = new PaginatedResult<DelegationDTO[]>(page, pageSize, sortField, sortOrder, 0, []);
        const epochStats: EpochStats = await this._epochsService.getBlockNumberRangeByPriceEpochs(network, startTime, endTime);
        const epochBlockNumberFrom: number = epochStats.minBlockNumber;
        const epochBlockNumberTo: number = epochStats.maxBlockNumber;


        const delegations: PaginatedResult<Delegation[]> = await this.getDelegations(network, from, to, epochBlockNumberFrom, epochBlockNumberTo, page, pageSize, sortField!, sortOrder!, requestId!);
        paginatedResults.numResults = delegations.numResults;
        if (delegations.numResults === 0) {
            return paginatedResults;
        }
        const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
        const paginatedRewardEpochs: PaginatedResult<RewardEpoch[]> = await this._epochsService.getRewardEpochs(network, startTime, endTime + rewardEpochSettings.rewardEpochDurationMillis, 1, 10000);
        const rewardEpochs: RewardEpoch[] = paginatedRewardEpochs.results;
        paginatedResults.results = delegations.results.map(delegation => new DelegationDTO().fromDelegation(delegation, rewardEpochs, rewardEpochSettings));

        return paginatedResults;
    }

    async getDelegations(
        network: NetworkEnum,
        from: string,
        to: string,
        startBlock: number,
        endBlock: number,
        page: number,
        pageSize: number,
        sortField?: DelegationsSortEnum,
        sortOrder?: SortOrderEnum,
        requestId?: string
    ): Promise<PaginatedResult<Delegation[]>> {
        const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
        const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);

        if (ServiceUtils.isServiceUnavailable(blockchainDao) || ServiceUtils.isServiceUnavailable(persistenceDao)) {
            throw new Error(`Service unavailable`);
        }

        let missingBlocks: PersistenceMetadataScanInfo[] = [];
        let persistenceMetadata: PersistenceMetadata[] = [];
        if (isNotEmpty(from)) {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, from, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))

        }
        if (isNotEmpty(to)) {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, to, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        }
        if (isEmpty(from) && isEmpty(to)) {
            persistenceMetadata.push(...await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, null, startBlock, endBlock));
            missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, startBlock, endBlock))
        }


        if (missingBlocks.length > 0) {
            for (const missingDelegationsBlockNumber of missingBlocks) {
                this.logger.log(`${network} - Fetching delegations - From block ${missingDelegationsBlockNumber.from} to ${missingDelegationsBlockNumber.to} - Size: ${missingDelegationsBlockNumber.to - missingDelegationsBlockNumber.from}`);
                let blockchainData: Delegation[] = [];
                if (isNotEmpty(from)) {
                    blockchainData.push(...await blockchainDao.getDelegations(from, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to))
                }
                if (isNotEmpty(to)) {
                    blockchainData.push(...await blockchainDao.getDelegations(to, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to))
                }
                if (isEmpty(from) && isEmpty(to)) {
                    blockchainData.push(...await blockchainDao.getDelegations(null, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to))
                }

                if (blockchainData.length > 0) {
                    await persistenceDao.storeDelegations(blockchainData);
                }
                if (isNotEmpty(from)) {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, from, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to);
                }
                if (isNotEmpty(to)) {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, to, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to);
                }
                if (isEmpty(from) && isEmpty(to)) {
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, null, missingDelegationsBlockNumber.from, missingDelegationsBlockNumber.to);
                }
            }
            return this.getDelegations(network, from, to, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
        }

        if (missingBlocks.length === 0) {
            let daoData: PaginatedResult<Delegation[]> = new PaginatedResult<DelegationDTO[]>(page, pageSize, sortField, sortOrder, 0, []);
            if (pageSize > 0) {
                daoData = await persistenceDao.getDelegations(from, to, startBlock, endBlock, page, pageSize, sortField!, sortOrder!);
            }
            if (persistenceMetadata.length > 5) {
                await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, persistenceMetadata);
            }
            return daoData;
        }
        throw new Error(`Unable to get delegations from:'${isNotEmpty(from) ? from : '*'}' to '${isNotEmpty(to) ? to : '*'}.`);

    }

    async getDelegationsSnapshot(network: NetworkEnum, address: string, rewardEpochId: number, toBlockNumber?: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            if (ServiceUtils.isServiceUnavailable(persistenceDao)) {
                throw new Error(`Service unavailable`);
            }
            try {
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                let lastBlockNumber: number = 0;
                let rewardEpochTimestamp: number;
                if (isEmpty(toBlockNumber)) {
                    if (rewardEpochId == nextEpochId) {
                        const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                        const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                        rewardEpochTimestamp = lastFinalizedPriceEpoch.timestamp;
                        lastBlockNumber = lastFinalizedPriceEpoch.blockNumber;
                    } else {
                        const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                        rewardEpochTimestamp = rewardEpoch.timestamp;
                        lastBlockNumber = rewardEpoch.votePowerBlockNumber;
                    }
                } else {
                    lastBlockNumber = toBlockNumber;
                }

                let persistenceMetadata: PersistenceMetadata[] = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, address, 0, lastBlockNumber, rewardEpochId.toString());
                let missingBlocks: PersistenceMetadataScanInfo[] = [];
                missingBlocks.push(...new PersistenceMetadata().findMissingIntervals(persistenceMetadata, 0, lastBlockNumber))

                if (missingBlocks.length > 0) {
                    let startBlockNumber: number = 0;
                    /*  if (missingBlocks.length == 1 && rewardEpochId == nextEpochId && (missingBlocks[0].to - missingBlocks[0].from < 50000)) {
                         resolve();
                     } else { */
                    await this.getDelegations(network, null, address, startBlockNumber, lastBlockNumber, 1, 0);
                    const delegatorsData: Delegation[] = await persistenceDao.getDelegators(address, lastBlockNumber);
                    const delegationSnapshot: DelegationSnapshot[] = delegatorsData.map(delegation => new DelegationSnapshot(delegation, rewardEpochId));
                    await persistenceDao.storeDelegationsSnapshot(delegationSnapshot, rewardEpochTimestamp);
                    await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.DelegationSnapshot, address, 0, lastBlockNumber, rewardEpochId.toString());
                    /*  } */
                }
                resolve();
            } catch (e) {
                this.logger.error(`Unable to get delegations snapshot. Address: ${address} - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get delegations snapshot`));
            }
        });
    }


    async getDelegators(
        network: NetworkEnum,
        to: string,
        epochId: number,
        page: number,
        pageSize: number,
        sortField?: DelegationsSortEnum,
        sortOrder?: SortOrderEnum
    ): Promise<PaginatedResult<DelegationDTO[]>> {
        return new Promise<PaginatedResult<DelegationDTO[]>>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                if (epochId > nextEpochId) {
                    throw new Error(`Invalid reward epoch. Reward epoch is not finalized yet.`);
                    return;
                }
                let targetBlockNumber: number;
                if (epochId == nextEpochId) {
                    targetBlockNumber = await blockchainDao.provider.getBlockNumber();
                } else {
                    targetBlockNumber = (await this._epochsService.getRewardEpoch(network, epochId)).blockNumber
                }
                await this.getDelegations(network, null, to, 0, targetBlockNumber, 1, 0);

                let paginatedResults: PaginatedResult<DelegationDTO[]> = new PaginatedResult<DelegationDTO[]>(page, pageSize, sortField, sortOrder, 0, []);

                if (pageSize > 0) {
                    const rewardEpochs: RewardEpoch[] = (await this._epochsService.getRewardEpochs(network, 0, rewardEpochSettings.getEndTimeForEpochId(epochId), 1, 10000)).results;
                    const delegationsSnapshot: PaginatedResult<DelegationSnapshot[]> = await persistenceDao.getDelegationsSnapshot(to, epochId, page, pageSize, sortField, sortOrder);
                    paginatedResults = new PaginatedResult<DelegationDTO[]>(delegationsSnapshot.page, delegationsSnapshot.pageSize, delegationsSnapshot.sortField, delegationsSnapshot.sortOrder, delegationsSnapshot.numResults, []);
                    paginatedResults.results = delegationsSnapshot.results.map(delegation => new DelegationDTO().fromDelegation(delegation, rewardEpochs, rewardEpochSettings));
                }
                resolve(paginatedResults);
            } catch (e) {
                this.logger.error(`Unable to get delegators. Address: ${to} - Reward epoch: ${epochId}: `, e.message);
                reject(new Error(`Unable to get delegators`));
            }
        });
    }

    async getVotePower(network: NetworkEnum, dataProviderAddress: string, rewardEpochId: number): Promise<VotePowerDTO> {
        return new Promise<VotePowerDTO>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: VotePowerDTO = await cacheDao.getVotePower(dataProviderAddress, rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getDelegators(network, dataProviderAddress, rewardEpochId, 1, 0);
                let wrappedBalance: WrappedBalance = null;
                if (isEmpty(dataProviderAddress)) {
                    wrappedBalance = await this._balanceService.getDataProviderWrappedBalancesByRewardEpoch(network, rewardEpochId);
                } else {
                    wrappedBalance = await this._balanceService.getWrappedBalance(network, dataProviderAddress, rewardEpochId);
                }

                let votePower: VotePower = new VotePower();
                if (rewardEpochId == nextEpochId) {
                    // Calcola
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    votePower = await persistenceDao.getVotePower(dataProviderAddress, rewardEpochId);
                    if (isNotEmpty(wrappedBalance)) {
                        votePower.amount += wrappedBalance.amount;
                    };
                    const votePowerDTO: VotePowerDTO = new VotePowerDTO(votePower, lastFinalizedPriceEpoch.timestamp, rewardEpochId);
                    await cacheDao.setVotePower(dataProviderAddress, rewardEpochId, votePowerDTO, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(votePowerDTO);
                } else {
                    votePower = await persistenceDao.getVotePower(dataProviderAddress, rewardEpochId);
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    if (isNotEmpty(wrappedBalance)) {
                        votePower.amount += wrappedBalance.amount;
                    }
                    const votePowerDTO: VotePowerDTO = new VotePowerDTO(votePower, rewardEpoch.votePowerTimestamp, rewardEpochId);
                    await cacheDao.setVotePower(dataProviderAddress, rewardEpochId, votePowerDTO);
                    resolve(votePowerDTO);
                }
            } catch (e) {
                this.logger.error(`Unable to get vote power. Address: ${dataProviderAddress} - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get vote power`));
            }
        });
    }

    async getDataProviderVotePowerByAddress(network: NetworkEnum, rewardEpochId: number): Promise<VotePowerDTO[]> {
        return new Promise<VotePowerDTO[]>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: VotePowerDTO[] = await cacheDao.getDataProviderVotePowerByAddress(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                this.logger.log(`${network} - getDataProviderVotePowerByAddress - ${rewardEpochId}`);
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getDelegators(network, null, rewardEpochId, 1, 0);
                let persistenceData: VotePower[] = await persistenceDao.getDataProvidersVotePower(rewardEpochId);
                let dataProviderWrappedBalances: WrappedBalance[] = await this._balanceService.getDataProviderWrappedBalancesByAddress(network, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    let results: VotePowerDTO[] = [];
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    persistenceData.map(votePower => {
                        results.push(new VotePowerDTO(votePower, lastFinalizedPriceEpoch.timestamp, rewardEpochId))
                    });
                    results.map(votePower => {
                        dataProviderWrappedBalances = dataProviderWrappedBalances.filter(dpWb => dpWb.address != votePower.address);
                        let wrappeBalance: WrappedBalance = dataProviderWrappedBalances.find(balance => balance.address == votePower.address && balance.rewardEpochId == rewardEpochId);
                        if (isNotEmpty(wrappeBalance)) {
                            votePower.amount += wrappeBalance.amount;
                        }
                    });
                    dataProviderWrappedBalances.filter(dpWb => dpWb.amount > 0).map(dpWb => {
                        results.push({ address: dpWb.address, amount: dpWb.amount, rewardEpochId: dpWb.rewardEpochId, delegations: 0, delegators: 0, timestamp: dpWb.timestamp });
                    });

                    await cacheDao.setDataProviderVotePowerByAddress(rewardEpochId, results, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(results);
                } else {
                    let results: VotePowerDTO[] = [];
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    persistenceData.map(votePower => {
                        results.push(new VotePowerDTO(votePower, rewardEpoch.timestamp, rewardEpochId));
                    });
                    results.map(votePower => {
                        dataProviderWrappedBalances = dataProviderWrappedBalances.filter(dpWb => dpWb.address != votePower.address);
                        let wrappeBalance: WrappedBalance = dataProviderWrappedBalances.find(balance => balance.address == votePower.address && balance.rewardEpochId == rewardEpochId);
                        if (isNotEmpty(wrappeBalance)) {
                            votePower.amount += wrappeBalance.amount;
                        }
                    });
                    dataProviderWrappedBalances.filter(dpWb => dpWb.amount > 0).map(dpWb => {
                        results.push({ address: dpWb.address, amount: dpWb.amount, rewardEpochId: dpWb.rewardEpochId, delegations: 0, delegators: 0, timestamp: dpWb.timestamp });
                    });
                    await cacheDao.setDataProviderVotePowerByAddress(rewardEpochId, results);
                    resolve(results);
                }


            } catch (e) {
                this.logger.error(`Unable to get data providers vote power. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers vote power`));
            }
        });
    };

    async getDataProviderVotePowerByRewardEpoch(network: NetworkEnum, rewardEpochId: number): Promise<VotePowerDTO> {
        return new Promise<VotePowerDTO>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: VotePowerDTO = await cacheDao.getDataProviderVotePowerByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getDelegators(network, null, rewardEpochId, 1, 0);
                let persistenceData: VotePower = await persistenceDao.getVotePower(null, rewardEpochId);
                let dataProviderWrappedBalance: WrappedBalance = await this._balanceService.getDataProviderWrappedBalancesByRewardEpoch(network, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);

                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    let result: VotePowerDTO = new VotePowerDTO(persistenceData, lastFinalizedPriceEpoch.timestamp, rewardEpochId);
                    if (isNotEmpty(dataProviderWrappedBalance)) {
                        result.amount += dataProviderWrappedBalance.amount;
                    }
                    await cacheDao.setDataProviderVotePowerByRewardEpoch(rewardEpochId, result, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(result);
                } else {
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    let result: VotePowerDTO = new VotePowerDTO(persistenceData, rewardEpoch.timestamp, rewardEpochId);
                    if (isNotEmpty(dataProviderWrappedBalance)) {
                        result.amount += dataProviderWrappedBalance.amount;
                    }
                    await cacheDao.setDataProviderVotePowerByRewardEpoch(rewardEpochId, result);
                    resolve(result);
                }

            } catch (e) {
                this.logger.error(`Unable to get data providers vote power. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers vote power`));
            }
        });
    };

    async getTotalVotePowerByRewardEpoch(network: NetworkEnum, rewardEpochId: number): Promise<VotePowerDTO> {
        return new Promise<VotePowerDTO>(async (resolve, reject) => {
            try {
                const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
                const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);

                if (ServiceUtils.isServiceUnavailable(persistenceDao) || ServiceUtils.isServiceUnavailable(cacheDao)) {
                    throw new Error(`Service unavailable`);
                }

                const cacheData: VotePowerDTO = await cacheDao.getTotalVotePowerByRewardEpoch(rewardEpochId);
                if (isNotEmpty(cacheData)) {
                    resolve(cacheData);
                    return;
                }
                this.logger.log(`${network} - getTotalVotePowerByRewardEpoch - ${rewardEpochId}`);
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const nextEpochId: number = rewardEpochSettings.getNextEpochId();
                await this.getDelegators(network, null, rewardEpochId, 1, 0);
                let totalWrappedBalance: WrappedBalance = await this._balanceService.getWrappedBalancesByRewardEpoch(network, rewardEpochId);
                let votePower: VotePower = await persistenceDao.getVotePower(null, rewardEpochId);
                if (rewardEpochId == nextEpochId) {
                    let result: VotePowerDTO = null;
                    const priceEpochSettings: PriceEpochSettings = await this._epochsService.getPriceEpochSettings(network);
                    const lastFinalizedPriceEpoch: PriceEpoch = await this._epochsService.getPriceEpoch(network, priceEpochSettings.getLastFinalizedEpochId());
                    result = new VotePowerDTO(null, lastFinalizedPriceEpoch.timestamp, rewardEpochId);
                    result.amount = totalWrappedBalance.amount;
                    result.delegations = votePower.delegations;
                    result.delegators = votePower.delegators;
                    await cacheDao.setTotalVotePowerByRewardEpoch(rewardEpochId, result, priceEpochSettings.getRevealEndTimeForEpochId(priceEpochSettings.getCurrentEpochId()));
                    resolve(result);
                } else {
                    let result: VotePowerDTO = null;
                    const rewardEpoch: RewardEpoch = await this._epochsService.getRewardEpoch(network, rewardEpochId);
                    result = new VotePowerDTO(null, rewardEpoch.timestamp, rewardEpochId);
                    result.amount = totalWrappedBalance.amount;
                    result.delegations = votePower.delegations;
                    result.delegators = votePower.delegators;
                    await cacheDao.setTotalVotePowerByRewardEpoch(rewardEpochId, result);
                    resolve(result);
                }


            } catch (e) {
                this.logger.error(`Unable to get data providers vote power. - Reward epoch: ${rewardEpochId}: `, e.message);
                reject(new Error(`Unable to get data providers vote power`));
            }
        });
    };
    async getDelegatedVotePowerHistory(network: NetworkEnum, dataProviderAddress: string, startTime: number, endTime: number,
        page: number,
        pageSize: number,
        sortField?: VotePowerSortEnum,
        sortOrder?: SortOrderEnum): Promise<PaginatedResult<VotePowerDTO[]>> {
        return new Promise<PaginatedResult<VotePowerDTO[]>>(async (resolve, reject) => {
            try {
                let votePowerResults: VotePowerDTO[] = [];
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const rewardEpochs: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                if (isEmpty(dataProviderAddress)) {
                    for (let i in rewardEpochs) {
                        votePowerResults.push(await this.getDataProviderVotePowerByRewardEpoch(network, rewardEpochs[i]));
                    }
                } else {
                    for (let i in rewardEpochs) {
                        votePowerResults.push(await this.getVotePower(network, dataProviderAddress, rewardEpochs[i]));
                    }
                }
                resolve(Commons.parsePaginatedResults<VotePowerDTO>(votePowerResults, page, pageSize, sortField, sortOrder));
            } catch (e) {
                this.logger.error(`Unable to get vote power history. Address: ${dataProviderAddress} - From: ${startTime} To: ${endTime}: `, e);
                reject(new Error(`Unable to get delegated vote power history`));
            }
        });
    }
    async getTotalVotePowerHistory(network: NetworkEnum, startTime: number, endTime: number,
        page: number,
        pageSize: number,
        sortField?: VotePowerSortEnum,
        sortOrder?: SortOrderEnum): Promise<PaginatedResult<VotePowerDTO[]>> {
        return new Promise<PaginatedResult<VotePowerDTO[]>>(async (resolve, reject) => {
            try {
                let votePowerResults: VotePowerDTO[] = [];
                const rewardEpochSettings: RewardEpochSettings = await this._epochsService.getRewardEpochSettings(network);
                const rewardEpochs: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(startTime, endTime);
                for (let i in rewardEpochs) {
                    votePowerResults.push(await this.getTotalVotePowerByRewardEpoch(network, rewardEpochs[i]));
                }
                resolve(Commons.parsePaginatedResults<VotePowerDTO>(votePowerResults, page, pageSize, sortField, sortOrder));
            } catch (e) {
                this.logger.error(`Unable to get total vote power history. - From: ${startTime} To: ${endTime}: `, e);
                reject(new Error(`Unable to get total vote power history`));
            }
        });
    }
}