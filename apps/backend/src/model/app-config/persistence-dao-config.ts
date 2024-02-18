import { Type } from "class-transformer";
import { ArrayNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class PersistenceDaoConfig {
    @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => Array<string>)
    members: string[];
    @IsOptional() @IsString()
    prefix: string = 'persistence';
    @IsOptional() @IsNumber()
    replica: number = 0;
    @IsOptional() @IsNumber()
    shard: number = 5;
    @IsOptional() @IsNumber()
    persistenceMetadataCleanTimeMinutes: number = 60;
}   