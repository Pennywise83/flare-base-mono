import { HashSubmitted } from "./hash-submitted";
import { PriceFinalized } from "./price-finalized";
import { PriceRevealed } from "./price-revealed";
import { RewardDistributed } from "./reward-distributed";

export class RealTimeFtsoData {
    hashSubmitted: HashSubmittedRealTimeData[] = [];
    revealedPrices: PriceRevealed[] = [];
    finalizedPrices: PriceFinalized[] = [];
    distributedRewards: RewardDistributed[] = [];
}


export interface IRealTimeData {
    type: RealTimeDataTypeEnum;
    timestamp: number;
}
export class HashSubmittedRealTimeData extends HashSubmitted implements IRealTimeData{
    type: RealTimeDataTypeEnum = RealTimeDataTypeEnum.hashSubmitted;
    constructor(data: HashSubmitted) {
        super();
        this.blockNumber = data.blockNumber;
        this.timestamp = data.timestamp;
        this.epochId = data.epochId;
        this.submitter = data.submitter;
    }
}

export class PriceRevealedRealTimeData extends PriceRevealed implements IRealTimeData {
    type: RealTimeDataTypeEnum = RealTimeDataTypeEnum.revealedPrice;
    constructor(data: PriceRevealed) {
        super();
        this.blockNumber = data.blockNumber;
        this.timestamp = data.timestamp;
        this.epochId = data.epochId;
        this.symbol = data.symbol;
        this.value = data.value;
        this.dataProvider = data.dataProvider;
        this.borderIQR = data.borderIQR;
        this.borderPct = data.borderPct;
        this.innerIQR = data.innerIQR;
        this.innerPct = data.innerPct;
        this.outIQR = data.outIQR;
        this.outPct = data.outPct;
    }
}
export class PriceFinalizedRealTimeData extends PriceFinalized implements IRealTimeData {
    type: RealTimeDataTypeEnum = RealTimeDataTypeEnum.finalizedPrice;
    constructor(data: PriceFinalized) {
        super();
        this.blockNumber = data.blockNumber;
        this.timestamp = data.timestamp;
        this.epochId = data.epochId;
        this.symbol = data.symbol;
        this.value = data.value;
        this.highIQRRewardPrice = data.highIQRRewardPrice;
        this.highPctRewardPrice = data.highPctRewardPrice;
        this.lowIQRRewardPrice = data.lowIQRRewardPrice;
        this.lowPctRewardPrice = data.lowPctRewardPrice;
        this.rewardedSymbol = data.rewardedSymbol;

    }
}

export class RewardDistributedRealTimeData extends RewardDistributed  implements IRealTimeData{
    type: RealTimeDataTypeEnum = RealTimeDataTypeEnum.rewardDistributed;
    constructor(data: RewardDistributed) {
        super();
        this.blockNumber = data.blockNumber;
        this.timestamp = data.timestamp;
        this.priceEpochId = data.priceEpochId;
        this.providerReward = data.providerReward;
        this.reward = data.reward;
        this.symbol = data.symbol;
    }
}
export enum RealTimeDataTypeEnum {
    hashSubmitted,
    revealedPrice,
    finalizedPrice,
    rewardDistributed
}