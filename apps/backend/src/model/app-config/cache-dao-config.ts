import { Type } from "class-transformer";
import { ArrayNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class CacheDaoConfig {
    @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => Array<string>)
    members: string[];
}   