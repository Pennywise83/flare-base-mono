import { DataProviderExtendedInfo, DelegationDTO, DelegationSnapshot, PriceEpoch, RewardEpoch, VotePowerDTO, WrappedBalance } from "@flare-base/commons";
import { Logger } from "@nestjs/common";
import * as Redis from 'ioredis';
import { CacheDaoConfig } from "../../model/app-config/cache-dao-config";
import { ServiceStatusEnum } from "../../service/network-dao-dispatcher/model/service-status.enum";

export interface ICacheDao {


    logger: Logger;
    status: ServiceStatusEnum;
    config: CacheDaoConfig;
    redisCluster: Redis.Cluster;
    cacheDomain: string;

    initialize(): Promise<void>;


    // PersistenceDAO
    getFullScanCache(indexName: string, query: string): Promise<any[]>;
    setFullScanCache(indexName: string, query: string, results: any[], endTime: number): Promise<void>;


    // Epochs
    getRewardEpoch(id: number): Promise<RewardEpoch>;
    setRewardEpoch(rewardEpoch: RewardEpoch): Promise<void>;

    getPriceEpoch(priceEpochId: number): Promise<PriceEpoch>;
    setPriceEpoch(priceEpochId: number, priceEpoch: PriceEpoch, endTime?: number): Promise<void>;


    // Ftso

    getDataProvidersData(rewardEpochId: number): Promise<DataProviderExtendedInfo[]>;
    setDataProvidersData(rewardEpochId: number, results: DataProviderExtendedInfo[], endTime?: number): Promise<void>;

    // Balances
    setUniqueDataProviderAddressList(rewardEpochId: number, addresses: string[], endTime?: number): Promise<void>;
    getUniqueDataProviderAddressList(rewardEpochId: number): Promise<string[]>;

    getWrappedBalancesByRewardEpoch(rewardEpochId: number): Promise<WrappedBalance>;
    setWrappedBalancesByRewardEpoch(rewardEpochId: number, wrappedBalance: WrappedBalance, endTime?: number): Promise<void>;

    getDataProviderWrappedBalancesByRewardEpoch(rewardEpochId: number): Promise<WrappedBalance>;
    setDataProviderWrappedBalancesByRewardEpoch(rewardEpochId: number, wrappedBalance: WrappedBalance, endTime?: number): Promise<void>;

    getWrappedBalance(rewardEpochId: number, dataProviderAddress: string): Promise<WrappedBalance>;
    setWrappedBalance(rewardEpochId: number, dataProviderAddress: string, wrappedBalance: WrappedBalance, endTime?: number): Promise<void>;

    getDataProviderWrappedBalancesByAddress(rewardEpochId: number): Promise<WrappedBalance[]>;
    setDataProviderWrappedBalancesByAddress(rewardEpochId: number, wrappedBalances: WrappedBalance[], endTime?: number): Promise<void>;

    // Delegations
    getVotePower(dataProviderAddress: string, rewardEpochId: number): Promise<VotePowerDTO>;
    setVotePower(dataProviderAddress: string, rewardEpochId: number, votePowerDTO: VotePowerDTO, endTime?: number): Promise<void>;

    getDataProviderVotePowerByAddress(rewardEpochId: number): Promise<VotePowerDTO[]>;
    setDataProviderVotePowerByAddress(rewardEpochId: number, results: VotePowerDTO[], endTime?: number): Promise<void>;

    getDataProviderVotePowerByRewardEpoch(rewardEpochId: number): Promise<VotePowerDTO>;
    setDataProviderVotePowerByRewardEpoch(rewardEpochId: number, result: VotePowerDTO, endTime?: number): Promise<void>;

    getTotalVotePowerByRewardEpoch(rewardEpochId: number): Promise<VotePowerDTO>;
    setTotalVotePowerByRewardEpoch(rewardEpochId: number, result: VotePowerDTO, endTime?: number): Promise<void>;
}