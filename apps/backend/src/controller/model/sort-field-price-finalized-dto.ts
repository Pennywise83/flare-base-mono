import { PriceFinalizedSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldPriceFinalizedDTO {
    @ApiProperty({ enum: PriceFinalizedSortEnum, default: PriceFinalizedSortEnum.timestamp, required: true })
    sortField: PriceFinalizedSortEnum
}

export class PriceFinalizedSortValidationPipe implements PipeTransform<string, Promise<PriceFinalizedSortEnum>> {
    transform(value: string): Promise<PriceFinalizedSortEnum> {
        if (isDefined(value) && isEnum(value, PriceFinalizedSortEnum)) {
            return PriceFinalizedSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                PriceFinalizedSortEnum
            ).map(key => PriceFinalizedSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}