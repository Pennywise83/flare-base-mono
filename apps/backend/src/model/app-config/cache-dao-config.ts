import { Type } from "class-transformer";
import { ArrayNotEmpty, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class CacheDaoConfig {
    @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => Array<string>)
    members: string[];
    @IsNotEmpty() @IsString()
    prefix: string
}   