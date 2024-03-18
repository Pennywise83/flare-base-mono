import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";

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


export enum RewardDistributedSortEnum {
    timestamp = 'timestamp',
    priceEpochId = 'priceEpochId',
    symbol = 'symbol',
    dataProvider = 'dataProvider',
    reward = 'reward',
    providerReward = 'providerReward'
}