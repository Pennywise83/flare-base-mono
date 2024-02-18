import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";
import { RewardEpochDTO } from "../epochs";

export class Balance extends BlockInfo {
    addressA: string;
    addressB: string;
    amount: number;
}


export class Transaction {
    from: string;
    to: string;
    type: TransferTypeEnum;
    amount: number;
    timestamp: number;
    constructor(data: Balance) {
        this.timestamp = data.timestamp;
        if (data.addressB == '0x00') {
            if (data.amount > 0) {
                this.from = data.addressB;
                this.to = data.addressA;
                this.type = TransferTypeEnum.wrap;
            } else {
                this.from = data.addressA;
                this.to = data.addressB;
                this.type = TransferTypeEnum.unwrap
            }
        } else {
            if (data.amount > 0) {
                this.from = data.addressB;
                this.to = data.addressA;
                this.type = TransferTypeEnum.transferIn;
            } else {

                this.from = data.addressA;
                this.to = data.addressB;
                this.type = TransferTypeEnum.transferIn;
            }
        }
    }
}
export class WrappedBalance {
    @ApiProperty({ description: 'The address on which the balance snapshot was taken.', example: '0x0000000000000000000000000000000000000000' })
    address: string;
    @ApiProperty({ description: 'The amount of wrapped token balance available wen the snapshot was taken.', example: '9835.00517181026' })
    amount: number;
    @ApiProperty({ description: 'The number of transactions executed by the address.', example: '27' })
    transactionsCount: number;
    @ApiProperty({ name: 'timestamp', description: 'The timestamp indicating when the balance snapshot was taken', example: '1688972200000' })
    timestamp: number;
    @ApiProperty({ description: 'ID of the reward epoch where the balance snapshot was taken.', example: '100' })
    rewardEpochId: number;

    constructor(address: string, rewardEpochId: number, amount: number, transactionsCount: number) {
        this.address = address;
        this.rewardEpochId = rewardEpochId;
        this.amount = amount;
        this.transactionsCount = transactionsCount;
    }
}

export enum BalanceSortEnum {
    timestamp = 'timestamp',
    blockNumber = 'blockNumber',
    address = 'address',
    amount = 'amount'
}
export enum TransactionSortEnum {
    timestamp = 'timestamp',
    from = 'from',
    to = 'from',
    amount = 'amount',
    type = 'type'
}
export enum BalanceSnapshotSortEnum {
    timestamp = 'timestamp',
    rewardEpoch = 'rewardEpoch',
    address = 'address',
    amount = 'amount',
}

export enum TransferTypeEnum {
    wrap = "Wrap",
    unwrap = "Unwrap",
    transferIn = "Transfer in",
    transferOut = "Transfer out"
}