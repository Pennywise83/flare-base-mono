import { isNotEmpty } from "class-validator";
import { BlockInfo } from "../blockchain";
import { PriceEpochSettings } from "./price-epoch-settings";
import { ApiProperty } from "@nestjs/swagger";

/**
 * timestamp: Timestamp of the block where the ftso price has been finalized.
 */
export class PriceEpoch extends BlockInfo {
    id: number;
    constructor() {
        super();
    }
}

export class PriceEpochDTO {
    @ApiProperty({ description: 'The unique identifier of the price epoch', example: 160250 })
    id: number;
    @ApiProperty({ description: 'The start time of the price epoch, represented as a Unix timestamp in milliseconds', example: 1686585870000 })
    startTime: number;
    @ApiProperty({ description: 'The end time of the price epoch, represented as a Unix timestamp in milliseconds', example: 1686586050000 })
    endTime: number;
    @ApiProperty({ description: 'The time when the price epoch reveal phase ends, in Unix timestamp format', example: 1686586140000 })
    revealEndTime: number;
    @ApiProperty({ description: 'The block number at which the price epoch\'s reveal phase ends', example: 9640762 })
    revealEndBlockNumber: number;
    constructor(data?: PriceEpoch, epochSettings?: PriceEpochSettings, previousPriceEpoch?: PriceEpochDTO) {
        if (isNotEmpty(previousPriceEpoch)) {
            this.id = data!.id;
            this.startTime = previousPriceEpoch?.startTime! + epochSettings?.priceEpochDurationMillis!;
            this.endTime = previousPriceEpoch?.endTime! + epochSettings?.priceEpochDurationMillis!;;
            this.revealEndTime = previousPriceEpoch?.revealEndTime! + epochSettings?.priceEpochDurationMillis!;
            this.revealEndBlockNumber = data.blockNumber;
        } else {
            if (isNotEmpty(data) && isNotEmpty(epochSettings)) {
                this.id = data!.id;
                this.startTime = epochSettings!.getStartTimeForEpochId(data!.id)
                this.endTime = this.startTime + epochSettings!.priceEpochDurationMillis;
                this.revealEndTime = this.startTime + epochSettings!.priceEpochDurationMillis + epochSettings!.revealEpochDurationMillis;
                this.revealEndBlockNumber = data.blockNumber;

            }
        }
    }
    fromResponse(data: PriceEpochResponse): PriceEpochDTO[] {
        let results: PriceEpochDTO[] = [];
        data.id.forEach((element, idx) => {
            let obj: PriceEpochDTO = new PriceEpochDTO();
            obj.id = data.id[idx]!;
            obj.startTime = data.startTime[idx]!;
            obj.endTime = data.endTime[idx]!;
            obj.revealEndTime = data.revealEndTime[idx]!;
            results.push(obj);
        })
        return results;
    }
}

export class PriceEpochResponse {
    id: (number | null)[];
    startTime: (number | null)[];
    endTime: (number | null)[];
    revealEndTime: (number | null)[];

    constructor(rewardEpochList: PriceEpochDTO[]) {
        this.id = rewardEpochList.map(item => item.id !== undefined && item.id !== null ? item.id : null);
        this.startTime = rewardEpochList.map(item => item.startTime !== undefined && item.startTime !== null ? item.startTime : null);
        this.endTime = rewardEpochList.map(item => item.endTime !== undefined && item.endTime !== null ? item.endTime : null);
        this.revealEndTime = rewardEpochList.map(item => item.revealEndTime !== undefined && item.revealEndTime !== null ? item.revealEndTime : null);
    }
}


export enum EpochSortEnum {
    id = 'id',
    timestamp = 'timestamp',
    blockNumber = 'blockNumber',
}