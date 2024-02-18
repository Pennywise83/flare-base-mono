import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsNotEmpty, IsNotEmptyObject, IsOptional, ValidateNested } from 'class-validator';
import 'reflect-metadata';
import { LoggerConfig } from './logger-config';
import { NetworkConfig } from './network-config';
import { ServerSettings } from './server-settings';

export class AppConfig {
    @IsNotEmpty()
    serverSettings: ServerSettings;
    @IsOptional() @IsNotEmpty()
    logger: LoggerConfig = new LoggerConfig();
    @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => Array<NetworkConfig>)
    network: NetworkConfig[];

}



