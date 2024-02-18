import { DelegationsSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum, isNotEmpty } from "class-validator";

export class SortFieldDelegationsDTO {
    @ApiProperty({ enum: DelegationsSortEnum, default: DelegationsSortEnum.timestamp, required: true })
    sortField: DelegationsSortEnum
}

export class DelegationsSortValidationPipe implements PipeTransform<string, Promise<DelegationsSortEnum>> {
    transform(value: string): Promise<DelegationsSortEnum> {
        if (isDefined(value) && isEnum(value, DelegationsSortEnum)) {
            return DelegationsSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                DelegationsSortEnum
            ).map(key => DelegationsSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}