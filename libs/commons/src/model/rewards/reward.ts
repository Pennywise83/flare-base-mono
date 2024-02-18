import { isNotEmpty } from "class-validator";
import { BlockInfo } from "../blockchain";
import { RewardEpochDTO } from "../epochs";
import { ApiProperty } from "@nestjs/swagger";

export class Reward extends BlockInfo {
    @ApiProperty({ name: 'timestamp', description: 'The timestamp indicating when the reward claim was made.', example: '1689972400000' })
    @ApiProperty({ description: 'ID of the reward epoch where the reward was accrued.', example: '100' })
    rewardEpochId: number;
    @ApiProperty({ description: 'The address that actually performed the claim.', example: '0x0000000000000000000000000000000000000000' })
    whoClaimed: string;
    @ApiProperty({ description: 'The address that received the reward.', example: '0x0000000000000000000000000000000000000000' })
    sentTo: string;
    @ApiProperty({ description: 'The data provider address from wich comes the reward.', example: '0x0000000000000000000000000000000000000000' })
    dataProvider: string;
    @ApiProperty({ description: 'Amount of rewarded native tokens.', example: 12.46 })
    amount: number;
    constructor() {
        super();
    }
}

export class UnclaimedReward extends Reward {
    claimable: boolean;
    claimed: boolean;
}

export class ClaimedRewardStats {
    @ApiProperty({ description: 'The total count of rewards claimed by the user during the selected time period.' })
    count: number;
    @ApiProperty({ description: 'The minimum value of the claimed rewards during the selected time period.' })
    min: number;
    @ApiProperty({ description: 'The maximum value of the claimed rewards during the selected time period.' })
    max: number;
    @ApiProperty({ description: 'The average value of the claimed rewards during the selected time period.' })
    average: number;
    @ApiProperty({ description: 'The sum of all claimed rewards during the selected time period.' })
    sum: number;
    @ApiProperty({ description: 'The number of unique data providers from which the user claimed rewards during the selected time period.' })
    dataProviderCount: number;
}
export class RewardDTO extends Reward {
    @ApiProperty({ description: 'The start time of the reward epoch, represented as a Unix timestamp in milliseconds', example: 1688670001000 })
    rewardEpochStartTime: number;
    @ApiProperty({ description: 'The end time of the reward epoch, represented as a Unix timestamp in milliseconds', example: 1688972400000 })
    rewardEpochEndTime: number;

    constructor(data?: Reward, rewardEpoch?: RewardEpochDTO) {
        super()
        if (isNotEmpty(data) && isNotEmpty(rewardEpoch)) {
            this.amount = data?.amount!;
            this.blockNumber = data?.blockNumber!;
            this.dataProvider = data?.dataProvider!;
            this.whoClaimed = data?.whoClaimed!;
            this.sentTo = data?.sentTo!;
            this.timestamp = data?.timestamp!;
            this.amount = data?.amount!;
            this.rewardEpochId = data?.rewardEpochId!;
            this.rewardEpochStartTime = rewardEpoch?.startTime!;
            this.rewardEpochEndTime = rewardEpoch?.endTime!;
        }
    }


    fromResponse(data: RewardResponse): RewardDTO[] {
        let results: RewardDTO[] = [];
        data.rewardEpochId.forEach((element, idx) => {
            let obj: RewardDTO = new RewardDTO();
            obj.timestamp = data.timestamp[idx]!;
            obj.rewardEpochId = data.rewardEpochId[idx]!;
            obj.rewardEpochStartTime = data.rewardEpochStartTime[idx]!;
            obj.rewardEpochEndTime = data.rewardEpochEndTime[idx]!;
            obj.whoClaimed = data.whoClaimed[idx]!;
            obj.sentTo = data.sentTo[idx]!;
            obj.dataProvider = data.dataProvider[idx]!;
            obj.amount = data.amount[idx]!;
            results.push(obj);
        })
        return results;
    }
}


export class RewardResponse {
    timestamp: (number | null)[];
    rewardEpochId: (number | null)[];
    rewardEpochStartTime: (number | null)[];
    rewardEpochEndTime: (number | null)[];
    whoClaimed: (string | null)[];
    sentTo: (string | null)[];
    dataProvider: (string | null)[];
    amount: (number | null)[];


    constructor(rewardList: RewardDTO[]) {
        this.timestamp = rewardList.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
        this.rewardEpochId = rewardList.map(item => isNotEmpty(item.rewardEpochId) ? item.rewardEpochId : null);
        this.rewardEpochStartTime = rewardList.map(item => isNotEmpty(item.rewardEpochStartTime) ? item.rewardEpochStartTime : null);
        this.rewardEpochEndTime = rewardList.map(item => isNotEmpty(item.rewardEpochEndTime) ? item.rewardEpochEndTime : null);
        this.whoClaimed = rewardList.map(item => isNotEmpty(item.whoClaimed) ? item.whoClaimed : null);
        this.sentTo = rewardList.map(item => isNotEmpty(item.sentTo) ? item.sentTo : null);
        this.dataProvider = rewardList.map(item => isNotEmpty(item.dataProvider) ? item.dataProvider : null);
        this.amount = rewardList.map(item => isNotEmpty(item.amount) ? item.amount : null);

    }
}

export enum ClaimedRewardsSortEnum {
    timestamp = 'timestamp',
    blockNumber = 'blockNumber',
    rewardEpochId = 'rewardEpochId',
    whoClaimed = 'whoClaimed',
    sentTo = 'sentTo',
    dataProvider = 'dataProvider',
    amount = 'amount'
}