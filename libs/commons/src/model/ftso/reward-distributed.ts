import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";
import { isNotEmpty } from "class-validator";

export class RewardDistributed extends BlockInfo {
    @ApiProperty({ description: 'Symbol of the FTSO that generated the rewards.' })
    symbol: string;
    @ApiProperty({ description: 'ID of the price epoch where the rewards were accrued.' })
    priceEpochId: number;
    @ApiProperty({ description: 'ID of the reward epoch where the rewards were accrued.' })
    rewardEpochId: number;
    @ApiProperty({ description: 'Data provider address that accrued the reward for the given price epoch id.' })
    dataProvider: string;
    @ApiProperty({ description: 'Amount of the accrued reward that goes to the delegators.' })
    reward: number;
    @ApiProperty({ description: 'Amount of the accrued reward that goes to the data provider.' })
    providerReward: number;
}
export class RewardDistributedMatrix {
    timestamp: (number | null)[];
    symbol: (string | null)[];
    priceEpochId: (number | null)[];
    rewardEpochId: (number | null)[];
    dataProvider: (string | null)[];
    reward: (number | null)[];
    providerReward: (number | null)[];
    toObject(data: RewardDistributedMatrix): RewardDistributed[] {
        let results: RewardDistributed[] = [];
        data.priceEpochId.forEach((element, idx) => {
            let obj: RewardDistributed = new RewardDistributed();
            obj.timestamp = data.timestamp[idx]!;
            obj.priceEpochId = data.priceEpochId[idx]!;
            obj.symbol = data.symbol[idx]!;
            obj.dataProvider = data.dataProvider[idx]!;
            obj.reward = data.reward[idx]!;
            obj.providerReward = data.providerReward[idx]!;
            results.push(obj);
        })
        return results;
    }
    constructor(rewardDistributed?: RewardDistributed[]) {
        if (isNotEmpty(rewardDistributed)) {
            this.timestamp = rewardDistributed.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
            this.priceEpochId = rewardDistributed.map(item => isNotEmpty(item.priceEpochId) ? item.priceEpochId : null);
            this.symbol = rewardDistributed.map(item => isNotEmpty(item.symbol) ? item.symbol : null);
            this.dataProvider = rewardDistributed.map(item => isNotEmpty(item.dataProvider) ? item.dataProvider : null);
            this.reward = rewardDistributed.map(item => isNotEmpty(item.reward) ? item.reward : null);
            this.providerReward = rewardDistributed.map(item => isNotEmpty(item.providerReward) ? item.providerReward : null);
        }
    }
}


export enum RewardDistributedSortEnum {
    timestamp = 'timestamp',
    priceEpochId = 'priceEpochId',
    symbol = 'symbol',
    dataProvider = 'dataProvider',
    reward = 'reward',
    providerReward = 'providerReward'
}