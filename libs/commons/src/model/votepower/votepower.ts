import { ApiProperty } from "@nestjs/swagger";
import { RewardEpoch, RewardEpochDTO, RewardEpochSettings } from "../epochs";
import { isNotEmpty } from "class-validator";

export class VotePower {
    address: string;
    amount: number;
    delegators: number;
    delegations: number;
    rewardEpochId: number;
}

export class VotePowerDTO {
    @ApiProperty({ description: 'The date on which the vote power was calculated, represented as a Unix timestamp in milliseconds', example: 1688670001000 })
    timestamp: number;
    @ApiProperty({ description: 'The reward epoch on which the vote power was calculated.', example: 1688670001000 })
    rewardEpochId: number;
    @ApiProperty({ description: 'Data provider address for fetching the corresponding Vote Power', example: '0x0000000000000000000000000000000000000000' })
    address: string;
    @ApiProperty({ description: 'Vote power amount.', example: 21_100_152 })
    amount: number;
    @ApiProperty({ description: 'The number of unique delegators.', example: 20 })
    delegators: number;
    @ApiProperty({ description: 'The number of delegations.', example: 25 })
    delegations: number;
    constructor(data: VotePower, timestamp: number, rewardEpochId?: number) {
        if (isNotEmpty(data)) {
            this.rewardEpochId = data.rewardEpochId;
            this.address = data.address;
            this.amount = data.amount;
            this.delegations = data.delegations;
            this.delegators = data.delegators;
        }
        this.timestamp = timestamp;
        if (isNotEmpty(rewardEpochId)) {
            this.rewardEpochId = rewardEpochId;
        }
    }
}

export enum VotePowerSortEnum {
    timestamp = 'timestamp',
    amount = 'amount',
    delegators = 'delegators',
    delegations = 'delegations',
    address = 'address'
}