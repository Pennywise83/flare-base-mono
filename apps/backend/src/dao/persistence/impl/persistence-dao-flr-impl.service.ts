import { NetworkEnum } from "@flare-base/commons";
import { InjectQueue, Processor } from "@nestjs/bull";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NetworkConfig } from "apps/backend/src/model/app-config/network-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { Queue } from "bull";
import { ICacheDao } from "../../cache/i-cache-dao.service";
import { CACHE_DAO_FLR } from "../../cache/impl/cache-dao-flr-impl.service";
import { PersistenceConstants } from "./model/persistence-constants";
import { PersistenceDaoImpl } from "./persistence-dao-impl.service";

export const PERSISTENCE_DAO_FLR = 'PERSISTENCE_DAO_FLR';
export const PERSISTENCE_DAO_FLR_QUEUE = 'PERSISTENCE_DAO_FLR_QUEUE';


@Injectable()
@Processor(PERSISTENCE_DAO_FLR_QUEUE)
export class PersistenceDaoFlrImpl extends PersistenceDaoImpl {
    logger: Logger = new Logger(PersistenceDaoFlrImpl.name);
    readonly _network: string = NetworkEnum.flare;

    constructor(private _configService: ConfigService, @InjectQueue(PERSISTENCE_DAO_FLR_QUEUE) _persistenceDaoQueue: Queue, @Inject(CACHE_DAO_FLR) _cacheDao: ICacheDao) {
        super();
        const networkConfig: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');

        if (networkConfig.find(nConfig => nConfig.name == this._network)) {
            this.logger.log(`Initializing Persistence DAO...`);
            this.status = ServiceStatusEnum.INITIALIZING;
            this._persistenceDaoQueue = _persistenceDaoQueue;
            this._cacheDao = _cacheDao;
            this.config = networkConfig.find(nConfig => nConfig.name == this._network).persistenceDao;
            this.initialize().then();
        } else {
            this.logger.log(`No configuration provided`);
            this.status = ServiceStatusEnum.STOPPED;
        }
    }

    initializeIndicesMappings(): void {
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.CONSTANTS_INDEX}`] = PersistenceConstants.CONSTANTS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.METADATA_INDEX}`] = PersistenceConstants.METADATA_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.REWARD_EPOCHS_INDEX}`] = PersistenceConstants.REWARD_EPOCHS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.PRICE_EPOCHS_INDEX}`] = PersistenceConstants.PRICE_EPOCHS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.CLAIMED_REWARDS_INDEX}`] = PersistenceConstants.CLAIMED_REWARDS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.BALANCES_INDEX}`] = PersistenceConstants.BALANCES_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.DELEGATIONS_INDEX}`] = PersistenceConstants.DELEGATORS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.DELEGATIONS_SNAPSHOT_INDEX}`] = PersistenceConstants.DELEGATORS_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.FTSO_INFO_INDEX}`] = PersistenceConstants.FTSO_INFO_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.VOTER_WHITELIST_INDEX}`] = PersistenceConstants.VOTER_WHITELIST_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.FINALIZED_PRICES_V1_INDEX}`] = PersistenceConstants.FINALIZED_PRICES_V1_INDEX_MAPPING;
        this.indicesMapping[`${this._network}_${this.config.prefix}_${PersistenceConstants.REVEALED_PRICES_V1_INDEX}`] = PersistenceConstants.REVEALED_PRICES_V1_INDEX_MAPPING;
        
    }

    getIndex(indexType: string): string {
        if (typeof this.indicesList[`${this._network}_${this.config.prefix}_${indexType}`] != 'undefined' && this.indicesList[`${this._network}_${this.config.prefix}_${indexType}`].length > 0) {

            return this.indicesList[`${this._network}_${this.config.prefix}_${indexType}`].join(',');
        } else {
            return "";
        }
    }

}