import { NetworkEnum } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NetworkConfig } from "apps/backend/src/model/app-config/network-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { CacheDaoImpl } from "./cache-dao-impl.service";

export const CACHE_DAO_SGB = 'CACHE_DAO_SGB';
@Injectable()
export class CacheDaoSgbImpl extends CacheDaoImpl {
    logger: Logger = new Logger(CacheDaoSgbImpl.name);
    cacheDomain: string;
    constructor(private _configService: ConfigService) {
        super()
        this.logger.log("Initializing Cache DAO");
        this.status = ServiceStatusEnum.INITIALIZING;
        const networkConfig: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
        if (networkConfig.find(nConfig => nConfig.name == NetworkEnum.songbird)) {
            this.config = networkConfig.find(nConfig => nConfig.name == NetworkEnum.songbird).cacheDao;
            this.cacheDomain = this.config.prefix + '_' + NetworkEnum.songbird.toUpperCase()
            this.initialize().then(() => this.status = ServiceStatusEnum.STARTED).catch((err) => { throw new Error(err) });
        } else {
            this.logger.log(`No configuration provided`);
            this.status = ServiceStatusEnum.STOPPED
        }
    }
}