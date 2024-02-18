import { IsBoolean, IsNotEmpty, IsNumber, IsString, Matches } from "class-validator";
import { BlockchainDaoConfig } from "./blockchain-dao-config";
import { PersistenceDaoConfig } from "./persistence-dao-config";
import { CacheDaoConfig } from "./cache-dao-config";

export class NetworkConfig {
    @IsNotEmpty() @IsString() @Matches(/^[a-zA-Z]+$/, { message: 'Cannot include number or special characters.' })
    name: string;


    @IsNotEmpty()
    blockchainDao: BlockchainDaoConfig = new BlockchainDaoConfig();
    @IsNotEmpty()
    persistenceDao: PersistenceDaoConfig = new PersistenceDaoConfig();
    @IsNotEmpty()
    cacheDao: CacheDaoConfig = new CacheDaoConfig();

    @IsBoolean()
    scanActive: boolean = false;

    @IsNumber()
    collectBlockchainDataIntervalSeconds: number = 900;

    @IsNumber()
    towoLabsFtsoFetchEveryMinutes: number = 1440;
}