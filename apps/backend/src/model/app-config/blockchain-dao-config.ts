import { IsNotEmpty, IsNumber, IsString, IsUrl, Matches } from "class-validator";

export class BlockchainDaoConfig {
    @IsNotEmpty() @IsNumber()
    chainId: number;
    @IsNotEmpty() @IsString()
    priceSubmitterContractAddress: string;
    @IsNotEmpty() @IsString() @Matches(/^[a-zA-Z]+$/, { message: 'Cannot include number or special characters.' })
    prefix: string;
    @IsUrl() @IsNotEmpty()
    rpcUrl: string;
    @IsString()
    ftsoManagerWrapperPath: string;
    @IsNumber()
    missingPriceEpochTreshold: number;
}