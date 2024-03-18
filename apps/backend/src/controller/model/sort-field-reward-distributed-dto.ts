import { RewardDistributedSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldRewardDistributedDTO {
    @ApiProperty({ enum: RewardDistributedSortEnum, default: RewardDistributedSortEnum.timestamp, required: true })
    sortField: RewardDistributedSortEnum
}

export class RewardDistributedSortValidationPipe implements PipeTransform<string, Promise<RewardDistributedSortEnum>> {
    transform(value: string): Promise<RewardDistributedSortEnum> {
        if (isDefined(value) && isEnum(value, RewardDistributedSortEnum)) {
            return RewardDistributedSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                RewardDistributedSortEnum
            ).map(key => RewardDistributedSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}