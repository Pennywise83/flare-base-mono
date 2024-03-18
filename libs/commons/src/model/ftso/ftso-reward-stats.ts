import { ApiProperty } from "@nestjs/swagger";

export class FtsoRewardStats {
    @ApiProperty({ description: 'ID of the reward epoch where the rewards were accrued.' })
    epochId: number;
    @ApiProperty({ description: 'Data provider address that accrued the reward.' })
    dataProvider: string;
    @ApiProperty({ description: 'Reward rate in token for every 100 tokens delegated.' })
    rewardRate: number;
    @ApiProperty({ description: 'Sum of the accrued reward that goes to the delegators.' })
    delegatorsReward: number;
    @ApiProperty({ description: 'Sum of the accrued reward that goes to the data provider.' })
    providerReward: number;
    @ApiProperty({ description: 'Amount of the accrued reward.' })
    count: number;
}

export enum FtsoRewardStatsGroupByEnum {
    rewardEpochId='rewardEpochId',
    dataProvider='dataProvider'
}