import { VotePowerSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldVotePowerDTO {
    @ApiProperty({ enum: VotePowerSortEnum, default: VotePowerSortEnum.timestamp, required: true })
    sortField: VotePowerSortEnum
}

export class VotePowerSortValidationPipe implements PipeTransform<string, Promise<VotePowerSortEnum>> {
    transform(value: string): Promise<VotePowerSortEnum> {
        if (isDefined(value) && isEnum(value, VotePowerSortEnum)) {
            return VotePowerSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                VotePowerSortEnum
            ).map(key => VotePowerSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}
