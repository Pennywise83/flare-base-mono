import { Client } from "@elastic/elasticsearch";
import { Balance, ClaimedRewardsSortEnum, DataProviderInfo, DataProviderRewardStats, DataProviderRewardStatsGroupByEnum, Delegation, DelegationSnapshot, DelegationsSortEnum, FtsoFee, FtsoFeeSortEnum, HashSubmitted, PaginatedResult, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceFinalizedSortEnum, PriceRevealed, PriceRevealedSortEnum, Reward, RewardDistributed, RewardDistributedSortEnum, RewardEpoch, RewardEpochSettings, VotePower, VoterWhitelist, WrappedBalance } from "@flare-base/commons";
import { Logger } from "@nestjs/common";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { DataProviderSubmissionStats } from "libs/commons/src/model/ftso/data-provider-submission-stats";
import { SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { ClaimedRewardHistogramElement } from "libs/commons/src/model/rewards/reward";
import { PersistenceDaoConfig } from "../../model/app-config/persistence-dao-config";
import { ServiceStatusEnum } from "../../service/network-dao-dispatcher/model/service-status.enum";
import { EpochStats } from "./impl/model/epoch-stats";
import { PersistenceMetadata, PersistenceMetadataScanInfo, PersistenceMetadataType } from "./impl/model/persistence-metadata";

export interface IPersistenceDao {

    logger: Logger;
    status: ServiceStatusEnum;
    config: PersistenceDaoConfig;
    elasticsearchClient: Client;

    // Constants
    rewardEpochSettings: RewardEpochSettings;
    priceEpochSettings: PriceEpochSettings;

    truncate(): Promise<boolean>;

    // Persistence metadata
    getPersistenceMetadata(type: PersistenceMetadataType, value: string, from: number, to: number, filter?: string): Promise<PersistenceMetadata[]>;
    storePersistenceMetadata(type: PersistenceMetadataType, value: string, epochBlocknumberFrom: number, epochBlocknumberTo: number, filter?: string): Promise<number>;
    deletePersistenceMetadata(type: PersistenceMetadataType, value: string, epochBlocknumberFrom: number, epochBlocknumberTo: number): Promise<number>;
    optimizePersistenceMetadata(type: PersistenceMetadataType, persistenceMetadata: PersistenceMetadata[], filter?: string): Promise<number>;

    // Price epochs
    getPriceEpochSettings(): Promise<PriceEpochSettings>;
    storePriceEpochSettings(blockchainData: PriceEpochSettings): Promise<number>;
    getPriceEpochStats(startTime: number, endTime: number): Promise<EpochStats>;
    getPriceEpochs(startEpoch: number, endEpoch: number, page: number, pageSize: number, sortField: EpochSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<PriceEpoch[]>>;
    storePriceEpoch(blockchainData: PriceEpoch[]): Promise<number>;

    // Reward epochs
    getRewardEpochSettings(): Promise<RewardEpochSettings>;
    storeRewardEpochSettings(blockchainData: RewardEpochSettings): Promise<number>;
    getRewardEpochs(startEpoch: number, endEpoch: number, page: number, pageSize: number, sortField: EpochSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<RewardEpoch[]>>;
    storeRewardEpochs(blockchainData: RewardEpoch[]): Promise<number>;
    getRewardEpochStats(startEpochId: number, EndEpochId: number): Promise<EpochStats>;

    // Balances
    getBalances(address: string, blockNumberTo: number): Promise<Balance[]>;
    storeBalances(blockchainData: Balance[]): Promise<number>;
    getWrappedBalance(address: string, rewardEpochId: number, blockNumberTo: number): Promise<WrappedBalance>;
    getDataProvidersWrappedBalancesByAddress(addresses: string[], rewardEpochId: number, blockNumberTo: number, timestampTo: number): Promise<WrappedBalance[]>;
    getDataProvidersWrappedBalancesByRewardEpoch(addresses: string[], rewardEpochId: number, blockNumberTo: number, timestampTo: number): Promise<WrappedBalance>;

    // Rewards
    getClaimedRewards(whoClaimed: string, dataProvider: string, sentTo: string, blockNumberFrom: number, blockNumberTo: number, page: number, pageSize: number, sortField?: ClaimedRewardsSortEnum, sortOrder?: SortOrderEnum): Promise<PaginatedResult<Reward[]>>;
    getClaimedRewardsHistogram(whoClaimed: string, dataProvider: string, startTime: number, endTime: number, groupBy: string, aggregationInterval?: string): Promise<ClaimedRewardHistogramElement[]>;
    storeClaimedRewards(blockchainData: Reward[]): Promise<number>;

    // Delegations
    getDelegations(from: string, to: string, epochBlocknumberFrom: number, epochBlocknumberTo: number, page: number, pageSize: number, sortField?: string, sortOrder?: SortOrderEnum): Promise<PaginatedResult<Delegation[]>>;
    storeDelegations(blockchainData: Delegation[]): Promise<number>;
    storeDelegationsSnapshot(blockchainData: DelegationSnapshot[], rewardEpochTimestamp: number): Promise<number>;

    getDelegators(to: string, blockNumber: number): Promise<Delegation[]>;
    getDelegationsSnapshot(to: string, rewardEpoch: number, page: number, pageSize: number, sortField: DelegationsSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<DelegationSnapshot[]>>;
    deleteDelegationsSnapshot(to: string, rewardEpoch: number): Promise<number>;

    // Vote power
    getVotePower(address: string, rewardEpochId: number): Promise<VotePower>;
    getDataProvidersVotePower(rewardEpochId: number): Promise<VotePower[]>;

    // Ftso
    getUniqueDataProviderAddressList(endTime: number): Promise<string[]>;
    getVoterWhitelist(address: string, targetBlockNumber: number): Promise<VoterWhitelist[]>;
    storeVoterWhitelist(blockchainData: VoterWhitelist[]): Promise<number>;

    getSubmittedHashes(epochId: number, submitter: string, startBlock: number, endBlock: number, page: number, pageSize: number): Promise<PaginatedResult<HashSubmitted[]>>;
    storeSubmittedHashes(blockchainData: HashSubmitted[]): Promise<number>;

    getFinalizedPrices(symbol: string, startBlock: number, endBlock: number, page: number, pageSize: number, sortField: PriceFinalizedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<PriceFinalized[]>>;
    storeFinalizedPrices(blockchainData: PriceFinalized[]): Promise<number>;

    getRevealedPrices(symbol: string, address: string, startBlock: number, endBlock: number, page: number, pageSize: number, sortField: PriceRevealedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<PriceRevealed[]>>;
    getRevealedPricesByEpochId(symbol: string, address: string, epochIdFrom: number, epochIdTo: number, page: number, pageSize: number, sortField: PriceRevealedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<PriceRevealed[]>>;
    getUnpocessedRevealedPricesPersistenceMetadata(): Promise<PersistenceMetadataScanInfo[]>;
    storeRevealedPrices(blockchainData: PriceRevealed[]): Promise<number>;

    storeFtsoFee(blockchainData: FtsoFee[]): Promise<number>;
    getFtsoFee(targetBlockNumber: number, dataProvider: string, sortField: FtsoFeeSortEnum, sortOrder: SortOrderEnum): Promise<FtsoFee[]>;
    getFtsoFeeHistory(dataProvider: string): Promise<FtsoFee[]>;

    storeRewardDistributed(blockchainData: RewardDistributed[]): Promise<number>;
    getRewardDistributed(dataProvider: string, symbol: string, startBlock: number, endBlock: number, page: number, pageSize: number, sortField: RewardDistributedSortEnum, sortOrder: SortOrderEnum): Promise<PaginatedResult<RewardDistributed[]>>;

    getDataProviderRewardStats(dataProvider: string, startBlock: number, endBlock: number, groupBy: DataProviderRewardStatsGroupByEnum): Promise<DataProviderRewardStats[]>;
    getDataProviderSubmissionStats(startBlock: number, endBlock: number): Promise<DataProviderSubmissionStats[]>;
    getAvailableSymbols(epochBlockNumberFrom: number, epochBlockNumberTo: number): Promise<string[]>;
}