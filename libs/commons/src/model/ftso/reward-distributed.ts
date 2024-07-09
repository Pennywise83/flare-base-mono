import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";
import { isNotEmpty } from "class-validator";
import { RewardEpochSettings } from "../epochs";

export class RewardDistributed extends BlockInfo {
    @ApiProperty({ description: 'Symbol of the FTSO that generated the rewards.' })
    symbol: string;
    @ApiProperty({ description: 'ID of the price epoch where the rewards were accrued.' })
    priceEpochId: number;
    @ApiProperty({ description: 'Data provider address that accrued the reward for the given price epoch id.' })
    dataProvider: string;
    @ApiProperty({ description: 'Amount of the accrued reward that goes to the delegators.' })
    reward: number;
    @ApiProperty({ description: 'Amount of the accrued reward that goes to the data provider.' })
    providerReward: number;
}
export class RewardDistributedDto extends RewardDistributed {
    @ApiProperty({ description: 'ID of the reward epoch where the rewards were accrued.' })
    rewardEpochId: number;
    constructor(rewardDistributed?: RewardDistributed, rewardEpochSettings?: RewardEpochSettings) {
        super()
        this.blockNumber = rewardDistributed.blockNumber;
        this.dataProvider= rewardDistributed.dataProvider;
        this.priceEpochId = rewardDistributed.priceEpochId;
        this.providerReward = rewardDistributed.providerReward;
        this.reward = rewardDistributed.reward;
        this.symbol = rewardDistributed.symbol;
        this.timestamp = rewardDistributed.timestamp;
        if (isNotEmpty(rewardDistributed) && isNotEmpty(rewardEpochSettings)) {
            this.rewardEpochId = rewardEpochSettings.getEpochIdForTime(rewardDistributed.timestamp);
        }
    }
}
export class RewardDistributedMatrix {
    timestamp: (number | null)[];
    symbol: (string | null)[];
    priceEpochId: (number | null)[];
    rewardEpochId: (number | null)[];
    dataProvider: (string | null)[];
    reward: (number | null)[];
    providerReward: (number | null)[];
    toObject(data: RewardDistributedMatrix): RewardDistributedDto[] {
        let results: RewardDistributedDto[] = [];
        data.priceEpochId.forEach((element, idx) => {
            let obj: RewardDistributedDto = new RewardDistributedDto();
            obj.timestamp = data.timestamp[idx]!;
            obj.priceEpochId = data.priceEpochId[idx]!;
            obj.rewardEpochId = data.rewardEpochId[idx]!;
            obj.symbol = data.symbol[idx]!;
            obj.dataProvider = data.dataProvider[idx]!;
            obj.reward = data.reward[idx]!;
            obj.providerReward = data.providerReward[idx]!;
            results.push(obj);
        })
        return results;
    }
    constructor(rewardDistributed?: RewardDistributedDto[]) {
        if (isNotEmpty(rewardDistributed)) {
            this.timestamp = rewardDistributed.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
            this.priceEpochId = rewardDistributed.map(item => isNotEmpty(item.priceEpochId) ? item.priceEpochId : null);
            this.rewardEpochId = rewardDistributed.map(item => isNotEmpty(item.rewardEpochId) ? item.rewardEpochId : null);
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