import * as Redis from 'ioredis';
import { CacheDaoConfig } from "../../../model/app-config/cache-dao-config";
import { ServiceStatusEnum } from "../../../service/network-dao-dispatcher/model/service-status.enum";
import { ICacheDao } from "../i-cache-dao.service";
import { Logger } from '@nestjs/common';
import { DataProviderExtendedInfo, DelegationDTO, DelegationSnapshot, PriceEpoch, RewardEpoch, VotePowerDTO, WrappedBalance } from '@flare-base/commons';
import { isEmpty, isNotEmpty } from 'class-validator';

export abstract class CacheDaoImpl implements ICacheDao {
    abstract logger: Logger;
    status: ServiceStatusEnum;
    config: CacheDaoConfig;
    redisCluster: Redis.Cluster;
    abstract cacheDomain: string;
    constructor() { }




    initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let nodes: { host: string, port: number }[] = [];
            this.config.members.map(member => {
                nodes.push({ host: member.split(':')[0], port: parseInt(member.split(':')[1]) });
            })
            this.redisCluster = new Redis.Cluster(nodes, {
                scaleReads: 'all',
                enableOfflineQueue: true,
                enableAutoPipelining: false,

            });
            try {
                this.logger.log("Cache DAO initialized");

                resolve();
            } catch (e) {
                this.logger.error(`Unable to initialize Cache DAO: `, e.message);
                reject(new Error(`Unable to initialize Cache DAO`));
            }
        });
    }

    // Persistence DAO
    async getFullScanCache(indexName: string, query: string): Promise<any[]> {
        const cacheKey: string = `fullScan_${indexName}_${query}`;
        return await this._get<any>(cacheKey);
    }
    async setFullScanCache(indexName: string, query: string, results: any[], endTime: number): Promise<void> {
        const cacheKey: string = `fullScan_${indexName}_${query}`;
        return await this._set<any>(cacheKey, results, endTime);

    }

    // Epochs

    async getRewardEpoch(id: number): Promise<RewardEpoch> {
        const cacheKey: string = `rewardEpoch_${id.toString()}`;
        return await this._get<RewardEpoch>(cacheKey);
    }
    async setRewardEpoch(rewardEpoch: RewardEpoch): Promise<void> {
        const cacheKey: string = `rewardEpoch_${rewardEpoch.id.toString()}`;
        return await this._set<RewardEpoch>(cacheKey, rewardEpoch);
    }

    async getPriceEpoch(priceEpochId: number): Promise<PriceEpoch> {
        const cacheKey: string = `priceEpoch_${priceEpochId.toString()}`;
        return await this._get<PriceEpoch>(cacheKey);
    }
    async setPriceEpoch(priceEpochId: number, priceEpoch: PriceEpoch, endTime?: number): Promise<void> {
        const cacheKey: string = `priceEpoch_${priceEpochId.toString()}`;
        return await this._set<PriceEpoch>(cacheKey, priceEpoch);

    }

    // Ftso
    async getDataProvidersData(rewardEpochId: number): Promise<DataProviderExtendedInfo[]> {
        const cacheKey: string = `dataProvidersData_${rewardEpochId}`;
        return await this._get<DataProviderExtendedInfo[]>(cacheKey);
    }
    async setDataProvidersData(rewardEpochId: number, results: DataProviderExtendedInfo[], endTime?: number): Promise<void> {
        const cacheKey: string = `dataProvidersData_${rewardEpochId}`;
        return await this._set<DataProviderExtendedInfo[]>(cacheKey, results, endTime);
    }

    async getWrappedBalancesByRewardEpoch(rewardEpochId: number): Promise<WrappedBalance> {
        const cacheKey: string = `wrappedBalancesByRewardEpoch_${rewardEpochId}`;
        return await this._get<WrappedBalance>(cacheKey);
    }
    async setWrappedBalancesByRewardEpoch(rewardEpochId: number, wrappedBalance: WrappedBalance, endTime?: number): Promise<void> {
        const cacheKey: string = `wrappedBalancesByRewardEpoch_${rewardEpochId}`;
        return await this._set<WrappedBalance>(cacheKey, wrappedBalance, endTime);
    }

    async getDataProviderWrappedBalancesByRewardEpoch(rewardEpochId: number): Promise<WrappedBalance> {
        const cacheKey: string = `dataProviderWrappedBalancesByRewardEpoch_${rewardEpochId}`;
        return await this._get<WrappedBalance>(cacheKey);
    }
    async setDataProviderWrappedBalancesByRewardEpoch(rewardEpochId: number, wrappedBalance: WrappedBalance, endTime?: number): Promise<void> {
        const cacheKey: string = `dataProviderWrappedBalancesByRewardEpoch_${rewardEpochId}`;
        return await this._set<WrappedBalance>(cacheKey, wrappedBalance, endTime);
    }

    async getWrappedBalance(rewardEpochId: number, dataProviderAddress: string): Promise<WrappedBalance> {
        const cacheKey: string = `wrappedBalance_${dataProviderAddress}_${rewardEpochId}`;
        return await this._get<WrappedBalance>(cacheKey);
    }

    async setWrappedBalance(rewardEpochId: number, dataProviderAddress: string, wrappedBalance: WrappedBalance, endTime?: number): Promise<void> {
        const cacheKey: string = `wrappedBalance_${dataProviderAddress}_${rewardEpochId}`;
        return await this._set<WrappedBalance>(cacheKey, wrappedBalance, endTime);
    }

    async getDataProviderWrappedBalancesByAddress(rewardEpochId: number): Promise<WrappedBalance[]> {
        const cacheKey: string = `dataProviderWrappedBalancesByAddress_${rewardEpochId}`;
        return await this._get<WrappedBalance[]>(cacheKey);
    }

    async setDataProviderWrappedBalancesByAddress(rewardEpochId: number, wrappedBalances: WrappedBalance[], endTime?: number): Promise<void> {
        const cacheKey: string = `dataProviderWrappedBalancesByAddress_${rewardEpochId}`;
        return await this._set<WrappedBalance[]>(cacheKey, wrappedBalances, endTime);
    }



    async getUniqueDataProviderAddressList(rewardEpochId: number): Promise<string[]> {
        const cacheKey: string = `uniqueDataProviderAddressList_${rewardEpochId}`;
        return await this._get<string[]>(cacheKey);
    }
    async setUniqueDataProviderAddressList(rewardEpochId: number, addresses: string[], endTime?: number): Promise<void> {
        const cacheKey: string = `uniqueDataProviderAddressList_${rewardEpochId}`;
        return await this._set<string[]>(cacheKey, addresses, endTime);
    }


    async getVotePower(dataProviderAddress: string, rewardEpochId: number): Promise<VotePowerDTO> {
        const cacheKey: string = `votePower_${dataProviderAddress}_${rewardEpochId}`;
        return await this._get<VotePowerDTO>(cacheKey);

    }
    async setVotePower(dataProviderAddress: string, rewardEpochId: number, votePowerDTO: VotePowerDTO, endTime?: number): Promise<void> {
        const cacheKey: string = `votePower_${dataProviderAddress}_${rewardEpochId}`;
        return await this._set<VotePowerDTO>(cacheKey, votePowerDTO, endTime)
    }

    async setDataProviderVotePowerByAddress(rewardEpochId: number, results: VotePowerDTO[], endTime?: number): Promise<void> {
        const cacheKey: string = `dataProviderVotePowerByAddress_${rewardEpochId}`;
        return await this._set<VotePowerDTO[]>(cacheKey, results, endTime)
    }

    async getDataProviderVotePowerByAddress(rewardEpochId: number): Promise<VotePowerDTO[]> {
        const cacheKey: string = `dataProviderVotePowerByAddress_${rewardEpochId}`;
        return await this._get<VotePowerDTO[]>(cacheKey);
    }

    async setDataProviderVotePowerByRewardEpoch(rewardEpochId: number, result: VotePowerDTO, endTime?: number): Promise<void> {
        const cacheKey: string = `dataProviderVotePowerByRewardEpoch_${rewardEpochId}`;
        return await this._set<VotePowerDTO>(cacheKey, result, endTime)
    }
    async getDataProviderVotePowerByRewardEpoch(rewardEpochId: number): Promise<VotePowerDTO> {
        const cacheKey: string = `dataProviderVotePowerByRewardEpoch_${rewardEpochId}`;
        return await this._get<VotePowerDTO>(cacheKey);
    }

    async getTotalVotePowerByRewardEpoch(rewardEpochId: number): Promise<VotePowerDTO> {
        const cacheKey: string = `totalVotePowerByRewardEpoch_${rewardEpochId}`;
        return await this._get<VotePowerDTO>(cacheKey);
    }

    async setTotalVotePowerByRewardEpoch(rewardEpochId: number, result: VotePowerDTO, endTime?: number): Promise<void> {
        const cacheKey: string = `totalVotePowerByRewardEpoch_${rewardEpochId}`;
        return await this._set<VotePowerDTO>(cacheKey, result, endTime)
    }

    async getDelegators(to: string, epochId: number): Promise<DelegationDTO[]> {
        const cacheKey: string = `delegators_${to}_${epochId}`;
        return await this._get<DelegationDTO[]>(cacheKey);
    }
    async setDelegators(to: string, epochId: number, delegationsSnapshot: DelegationSnapshot[], endTime?: number): Promise<void> {
        const cacheKey: string = `delegators_${to}_${epochId}`;
        return await this._set<DelegationSnapshot[]>(cacheKey, delegationsSnapshot, endTime)
    }

    private async _set<T>(key: string, value: T, endTime?: number): Promise<void> {
        try {
            if (isNotEmpty(endTime)) {
                const now = new Date().getTime();
                const ttl: number = Math.floor((endTime - now) / 1000);
                if (ttl > 0) {
                    await this.redisCluster.set(`${this.cacheDomain}_${key}`, JSON.stringify(value), 'EX', ttl);
                }
            } else {
                await this.redisCluster.set(`${this.cacheDomain}_${key}`, JSON.stringify(value));
            }

            return;
        } catch (e) {
            this.logger.error(`Unable to set cache key '${this.cacheDomain}_${key}}: '`, e.message);
            return;
        }
    }

    private async _get<T>(key: string): Promise<T | null> {
        try {
            let cacheObject: string = await this.redisCluster.get(`${this.cacheDomain}_${key}`);
            if (isNotEmpty(cacheObject)) {
                return JSON.parse(cacheObject);
            }
        } catch (e) {
            this.logger.error(`Unable to get cache key '${this.cacheDomain}_${key}}: '`, e.message);
            return null;
        }
    }
}
