import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";

export class SortFieldEpochsDTO {
    @ApiProperty({ enum: EpochSortEnum, default: EpochSortEnum.id, required: true })
    sortField: EpochSortEnum
}
export class EpochsSortValidationPipe implements PipeTransform<string, Promise<EpochSortEnum>> {
    transform(value: string): Promise<EpochSortEnum> {
        if (isDefined(value) && isEnum(value, EpochSortEnum)) {
            return EpochSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                EpochSortEnum
            ).map(key => EpochSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}