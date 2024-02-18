import { BlockInfo } from "../blockchain";
import { Price } from "./price";

export class PriceFinalized extends Price {
    rewardedSymbol: boolean; 
    lowIQRRewardPrice: number;
    highIQRRewardPrice: number;
    lowElasticBandRewardPrice: number;
    highElasticBandRewardPrice: number;
}
