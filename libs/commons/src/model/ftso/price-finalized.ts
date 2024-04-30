import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";
import { Price } from "./price";
import { isNotEmpty } from "class-validator";

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

export class PriceFinalizedMatrix {
    timestamp: (number | null)[];
    epochId: (number | null)[];
    symbol: (string | null)[];
    price: (number | null)[];
    rewardedSymbol: (boolean | null)[];
    lowIQRRewardPrice: (number | null)[];
    highIQRRewardPrice: (number | null)[];
    lowPctRewardPrice: (number | null)[];
    highPctRewardPrice: (number | null)[];
    toObject(data: PriceFinalizedMatrix): PriceFinalized[] {
        let results: PriceFinalized[] = [];
        data.epochId.forEach((element, idx) => {
            let obj: PriceFinalized = new PriceFinalized();
            obj.epochId = data.epochId[idx]!;
            obj.timestamp = data.timestamp[idx]!;
            obj.symbol = data.symbol[idx]!;
            obj.value = data.price[idx]!;
            obj.rewardedSymbol = data.rewardedSymbol[idx]!;
            obj.lowIQRRewardPrice = data.lowIQRRewardPrice[idx]!;
            obj.highIQRRewardPrice = data.highIQRRewardPrice[idx]!;
            obj.lowPctRewardPrice = data.lowPctRewardPrice[idx]!;
            obj.highPctRewardPrice = data.highPctRewardPrice[idx]!;
            results.push(obj);
        })
        return results;
    }
    constructor(finalizedPrices?: PriceFinalized[]) {
        if (isNotEmpty(finalizedPrices)) {
            this.timestamp = finalizedPrices.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
            this.epochId = finalizedPrices.map(item => isNotEmpty(item.epochId) ? item.epochId : null);
            this.symbol = finalizedPrices.map(item => isNotEmpty(item.symbol) ? item.symbol : null);
            this.price = finalizedPrices.map(item => isNotEmpty(item.value) ? item.value : null);
            this.rewardedSymbol = finalizedPrices.map(item => isNotEmpty(item.rewardedSymbol) ? item.rewardedSymbol : null);
            this.lowIQRRewardPrice = finalizedPrices.map(item => isNotEmpty(item.lowIQRRewardPrice) ? item.lowIQRRewardPrice : null);
            this.highIQRRewardPrice = finalizedPrices.map(item => isNotEmpty(item.highIQRRewardPrice) ? item.highIQRRewardPrice : null);
            this.lowPctRewardPrice = finalizedPrices.map(item => isNotEmpty(item.lowPctRewardPrice) ? item.lowPctRewardPrice : null);
            this.highPctRewardPrice = finalizedPrices.map(item => isNotEmpty(item.highPctRewardPrice) ? item.highPctRewardPrice : null);

        }
    }
}
export enum PriceFinalizedSortEnum {
    timestamp = 'timestamp',
    epochId = 'epochId',
    symbol = 'symbol',
    price = 'price',
    rewardedSymbol = 'rewardedSymbol'
}
