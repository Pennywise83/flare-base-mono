import { IsIn, IsNotEmpty, IsOptional } from "class-validator";

export class LoggerConfig {
    @IsNotEmpty()
    loggerFileName: string = 'flare-base';
    @IsOptional() @IsNotEmpty()
    path: string = '/tmp/flare-base-logs/';
    @IsOptional() @IsIn(['error', 'warn', 'info', 'debug'])
    level: string = 'info';

    toString(): string {
        return this.level + ' -- ' + this.path;
    }
}