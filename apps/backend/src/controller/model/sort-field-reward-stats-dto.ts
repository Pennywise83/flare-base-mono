import { DataProviderRewardStatsGroupByEnum, RewardDistributedSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldRewardStatsDTO {
    @ApiProperty({ enum: DataProviderRewardStatsGroupByEnum, default: DataProviderRewardStatsGroupByEnum.rewardEpochId, required: true })
    sortField: DataProviderRewardStatsGroupByEnum
}

export class RewardStatsSortValidationPipe implements PipeTransform<string, Promise<DataProviderRewardStatsGroupByEnum>> {
    transform(value: string): Promise<DataProviderRewardStatsGroupByEnum> {
        if (isDefined(value) && isEnum(value, DataProviderRewardStatsGroupByEnum)) {
            return DataProviderRewardStatsGroupByEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                DataProviderRewardStatsGroupByEnum
            ).map(key => DataProviderRewardStatsGroupByEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}