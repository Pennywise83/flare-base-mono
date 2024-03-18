import { FtsoFeeSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldFtsoFeeDTO {
    @ApiProperty({ enum: FtsoFeeSortEnum, default: FtsoFeeSortEnum.timestamp, required: true })
    sortField: FtsoFeeSortEnum
}

export class FtsoFeeSortValidationPipe implements PipeTransform<string, Promise<FtsoFeeSortEnum>> {
    transform(value: string): Promise<FtsoFeeSortEnum> {
        if (isDefined(value) && isEnum(value, FtsoFeeSortEnum)) {
            return FtsoFeeSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                FtsoFeeSortEnum
            ).map(key => FtsoFeeSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}