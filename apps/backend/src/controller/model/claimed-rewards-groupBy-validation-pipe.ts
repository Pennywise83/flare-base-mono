import { ClaimedRewardsGroupByEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class ClaimedRewardsGroupByDTO {
    @ApiProperty({ enum: ClaimedRewardsGroupByEnum, default: ClaimedRewardsGroupByEnum.timestamp, required: true })
    groupBy: ClaimedRewardsGroupByEnum;
}
export class ClaimedRewardsGroupByValidationPipe implements PipeTransform<string, Promise<ClaimedRewardsGroupByEnum>> {
    transform(value: string): Promise<ClaimedRewardsGroupByEnum> {
        if (isDefined(value) && isEnum(value, ClaimedRewardsGroupByEnum)) {
            return ClaimedRewardsGroupByEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                ClaimedRewardsGroupByEnum
            ).map(key => ClaimedRewardsGroupByEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}

