import { ClaimedRewardsSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldClaimedRewardsDTO {
    @ApiProperty({ enum: ClaimedRewardsSortEnum, default: ClaimedRewardsSortEnum.rewardEpochId, required: true })
    sortField: ClaimedRewardsSortEnum
}

export class ClaimedRewardsSortValidationPipe implements PipeTransform<string, Promise<ClaimedRewardsSortEnum>> {
    transform(value: string): Promise<ClaimedRewardsSortEnum> {
        if (isDefined(value) && isEnum(value, ClaimedRewardsSortEnum)) {
            return ClaimedRewardsSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                ClaimedRewardsSortEnum
            ).map(key => ClaimedRewardsSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}