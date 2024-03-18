import { PriceRevealedSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldPriceRevealedDTO {
    @ApiProperty({ enum: PriceRevealedSortEnum, default: PriceRevealedSortEnum.timestamp, required: true })
    sortField: PriceRevealedSortEnum
}

export class PriceRevealedSortValidationPipe implements PipeTransform<string, Promise<PriceRevealedSortEnum>> {
    transform(value: string): Promise<PriceRevealedSortEnum> {
        if (isDefined(value) && isEnum(value, PriceRevealedSortEnum)) {
            return PriceRevealedSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                PriceRevealedSortEnum
            ).map(key => PriceRevealedSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}