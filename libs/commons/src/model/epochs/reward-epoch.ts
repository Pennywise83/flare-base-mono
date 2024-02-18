import { ApiProperty } from '@nestjs/swagger';
import { isNotEmpty } from 'class-validator';
import { RewardEpochSettings } from './reward-epoch-settings';
import { BlockInfo } from '../blockchain';

export class RewardEpoch extends BlockInfo {
    id: number;
    votePowerBlockNumber: number;
    votePowerTimestamp: number;
    constructor() {
        super();
    }
}
export class RewardEpochDTO {
    @ApiProperty({ description: 'The unique identifier for the reward epoch', example: '100' })
    id: number;
    @ApiProperty({ description: 'The start time of the reward epoch, represented as a Unix timestamp in milliseconds', example: 1688670001000 })
    startTime: number;
    @ApiProperty({ description: 'The block number at which the epoch began.', example: 10472753 })
    startBlockNumber: number;
    @ApiProperty({ description: 'The end time of the reward epoch, represented as a Unix timestamp in milliseconds', example: 1688972400000 })
    endTime: number;
    /* @ApiProperty({ description: 'The block number at which the epoch concluded.', example: 10588757 })
    endBlockNumber: number; */
    @ApiProperty({ description: 'The timestamp indicating when the vote power snapshot was recorded during the preceding reward epoch, represented as a Unix timestamp in milliseconds.', example: 1688601405000 })
    votePowerTime: number;
    @ApiProperty({ description: 'The block number that represents the vote-power block. It is randomly selected from the last blocks of the previous epoch.', example: 10448541 })
    votePowerBlockNumber: number;
    constructor(data?: RewardEpoch, epochSettings?: RewardEpochSettings) {
        if (isNotEmpty(data) && isNotEmpty(epochSettings)) {
            this.id = data!.id;
            this.startTime = data!.timestamp!;
            this.startBlockNumber = data!.blockNumber;
            this.endTime = epochSettings!.getEndTimeForEpochId(data!.id);
            this.votePowerTime = data!.votePowerTimestamp;
            this.votePowerBlockNumber = data!.votePowerBlockNumber;
        }
    }

    fromResponse(data: RewardEpochResponse): RewardEpochDTO[] {
        let results: RewardEpochDTO[] = [];
        data.id.forEach((element, idx) => {
            let obj: RewardEpochDTO = new RewardEpochDTO();
            obj.id = data.id[idx]!;
            obj.startTime = data.startTime[idx]!;
            obj.endTime = data.endTime[idx]!;
            obj.votePowerTime = data.votePowerTime[idx]!;
            obj.votePowerBlockNumber = data.votePowerBlockNumber[idx]!;
            results.push(obj);
        })
        return results;
    }
}


export class RewardEpochResponse {
    id: (number | null)[];
    startTime: (number | null)[];
    startBlockNumber: (number | null)[];
    endTime: (number | null)[];
    votePowerTime: (number | null)[];
    votePowerBlockNumber: (number | null)[];

    constructor(rewardEpochList: RewardEpochDTO[]) {
        this.id = rewardEpochList.map(item => item.id !== undefined && item.id !== null ? item.id : null);
        this.startTime = rewardEpochList.map(item => item.startTime !== undefined && item.startTime !== null ? item.startTime : null);
        this.startBlockNumber = rewardEpochList.map(item => item.startBlockNumber !== undefined && item.startBlockNumber !== null ? item.startBlockNumber : null);
        this.endTime = rewardEpochList.map(item => item.endTime !== undefined && item.endTime !== null ? item.endTime : null);
        this.votePowerTime = rewardEpochList.map(item => item.votePowerTime !== undefined && item.votePowerTime !== null ? item.votePowerTime : null);
        this.votePowerBlockNumber = rewardEpochList.map(item => item.votePowerBlockNumber !== undefined && item.votePowerBlockNumber !== null ? item.votePowerBlockNumber : null);
    }
}