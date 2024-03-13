import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";
import { Price } from "./price";

export class PriceFinalized extends Price {
    @ApiProperty({ description: 'Indicates whether the price symbol has been selected for rewards distribution.' })
    rewardedSymbol: boolean;
    @ApiProperty({ description: 'Lowest price in the primary (interquartile) reward band.' })
    lowIQRRewardPrice: number;
    @ApiProperty({ description: 'Highest price in the primary (interquartile) reward band.' })
    highIQRRewardPrice: number;
    @ApiProperty({ description: 'Lowest price in the secondary (elastic) reward band.' })
    lowPctRewardPrice: number;
    @ApiProperty({ description: 'Highest price in the secondary (elastic) reward band.' })
    highPctRewardPrice: number;
}

export enum PriceFinalizedSortEnum {
    timestamp = 'timestamp',
    epochId = 'epochId',
    symbol = 'symbol',
    price = 'price',
    rewardedSymbol = 'rewardedSymbol'
}
