import { NetworkEnum } from "@flare-base/commons";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IBlockchainDao } from "../../dao/blockchain/i-blockchain-dao.service";
import { BLOCKCHAIN_DAO_FLR } from "../../dao/blockchain/impl/blockchain-dao-flr-impl.service";
import { BLOCKCHAIN_DAO_SGB } from "../../dao/blockchain/impl/blockchain-dao-sgb-impl.service";
import { ICacheDao } from "../../dao/cache/i-cache-dao.service";
import { CACHE_DAO_FLR } from "../../dao/cache/impl/cache-dao-flr-impl.service";
import { CACHE_DAO_SGB } from "../../dao/cache/impl/cache-dao-sgb-impl.service";
import { IPersistenceDao } from "../../dao/persistence/i-persistence-dao.service";
import { PERSISTENCE_DAO_FLR } from "../../dao/persistence/impl/persistence-dao-flr-impl.service";
import { PERSISTENCE_DAO_SGB } from "../../dao/persistence/impl/persistence-dao-sgb-impl.service";
import { NetworkConfig } from "../../model/app-config/network-config";
import { ServiceStatusEnum } from "./model/service-status.enum";

@Injectable()
export class NetworkDaoDispatcherService {
    constructor(
        private readonly _configService: ConfigService,
        @Inject(BLOCKCHAIN_DAO_FLR) private readonly _flrBlockchainDao: IBlockchainDao,
        @Inject(PERSISTENCE_DAO_FLR) private readonly _flrPersistenceDao: IPersistenceDao,
        @Inject(CACHE_DAO_FLR) private readonly _flrCacheDao: ICacheDao,
        @Inject(BLOCKCHAIN_DAO_SGB) private readonly _sgbBlockchainDao: IBlockchainDao,
        @Inject(PERSISTENCE_DAO_SGB) private readonly _sgbPersistenceDao: IPersistenceDao,
        @Inject(CACHE_DAO_SGB) private readonly _sgbCacheDao: ICacheDao,
    ) {
    }

    public async getAvailableNetworks(): Promise<Array<NetworkEnum>> {
        return new Promise<Array<NetworkEnum>>(async (resolve, reject) => {
            const networkConfigurations: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network')
            let results: Array<NetworkEnum> = [];
            for (let i in networkConfigurations) {
                const networkConfig: NetworkConfig = networkConfigurations[i];
                let blockchainDao: IBlockchainDao = await this.getBlockchainDao(NetworkEnum[networkConfig.name]);
                let persistenceDao: IPersistenceDao = await this.getPersistenceDao(NetworkEnum[networkConfig.name]);
                let cacheDao: ICacheDao = await this.getCacheDao(NetworkEnum[networkConfig.name]);
                if (blockchainDao.status == ServiceStatusEnum.STARTED && persistenceDao.status == ServiceStatusEnum.STARTED && cacheDao.status == ServiceStatusEnum.STARTED) {
                    results.push(NetworkEnum[networkConfig.name]);
                }
            }
            resolve(results);
        });
    }

    public async getBlockchainDao(network: NetworkEnum): Promise<IBlockchainDao> {
        const maxWait: number = 300;
        let counter: number = 0;
        switch (network) {
            case NetworkEnum.flare:
                while (this._flrBlockchainDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._flrBlockchainDao;
                break;

            case NetworkEnum.songbird:
                while (this._sgbBlockchainDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._sgbBlockchainDao;
                break;

            default:
                return null;
                break;
        }
    }

    public async getPersistenceDao(network: NetworkEnum): Promise<IPersistenceDao> {
        const maxWait: number = 5;
        let counter: number = 0;
        switch (network) {
            case "flare":
                while (this._flrPersistenceDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._flrPersistenceDao;
                break;

            case "songbird":
                while (this._sgbPersistenceDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._sgbPersistenceDao;
                break;

            default:
                return null;
                break;
        }
    }
    public async getCacheDao(network: NetworkEnum): Promise<ICacheDao> {
        const maxWait: number = 5;
        let counter: number = 0;
        switch (network) {
            case "flare":
                while (this._flrCacheDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._flrCacheDao;
                break;

            case "songbird":
                while (this._sgbCacheDao.status === ServiceStatusEnum.INITIALIZING && counter <= maxWait) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    counter++;
                }
                return this._sgbCacheDao;
                break;

            default:
                return null;
                break;
        }
    }
}