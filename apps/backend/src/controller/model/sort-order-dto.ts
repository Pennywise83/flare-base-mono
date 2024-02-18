import { SortOrderEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortOrderDTO {
    @ApiProperty({ enum: SortOrderEnum, default: SortOrderEnum.desc, required: true })
    sortOrder: SortOrderEnum;
}

export class SortOrderValidationPipe implements PipeTransform<string, Promise<SortOrderEnum>> {
    transform(value: string): Promise<SortOrderEnum> {
        if (isDefined(value) && isEnum(value, SortOrderEnum)) {
            return SortOrderEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                SortOrderEnum
            ).map(key => SortOrderEnum[key])}`;
            throw new BadRequestException(errorMessage);

        }
    }
}