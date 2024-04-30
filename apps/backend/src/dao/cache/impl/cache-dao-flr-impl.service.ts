import { NetworkEnum } from "@flare-base/commons";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NetworkConfig } from "apps/backend/src/model/app-config/network-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { CacheDaoImpl } from "./cache-dao-impl.service";

export const CACHE_DAO_FLR = 'CACHE_DAO_FLR';
@Injectable()
export class CacheDaoFlrImpl extends CacheDaoImpl {
    logger: Logger = new Logger(CacheDaoFlrImpl.name);
    cacheDomain: string;
    constructor(private _configService: ConfigService) {
        super()
        this.logger.log("Initializing Cache DAO");
        
        this.status = ServiceStatusEnum.INITIALIZING;
        const networkConfig: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
        
        if (networkConfig.find(nConfig => nConfig.name == NetworkEnum.flare)) {
            this.config = networkConfig.find(nConfig => nConfig.name == NetworkEnum.flare).cacheDao;
            this.cacheDomain = this.config.prefix+'_'+NetworkEnum.flare.toUpperCase()
            this.initialize().then(() => {
                this.status = ServiceStatusEnum.STARTED
            }).catch((err) => { throw new Error(err) });
        } else {
            this.logger.log(`No configuration provided`);
            this.status = ServiceStatusEnum.STOPPED
        }
    }
}