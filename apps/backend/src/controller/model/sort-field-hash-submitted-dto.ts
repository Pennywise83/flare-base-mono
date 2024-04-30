import { HashSubmittedSortEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class SortFieldHashSubmittedDTO {
    @ApiProperty({ enum: HashSubmittedSortEnum, default: HashSubmittedSortEnum.submitter, required: true })
    sortField: HashSubmittedSortEnum
}

export class HashSubmittedSortValidationPipe implements PipeTransform<string, Promise<HashSubmittedSortEnum>> {
    transform(value: string): Promise<HashSubmittedSortEnum> {
        if (isDefined(value) && isEnum(value, HashSubmittedSortEnum)) {
            return HashSubmittedSortEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                HashSubmittedSortEnum
            ).map(key => HashSubmittedSortEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}