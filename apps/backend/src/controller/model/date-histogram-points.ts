import { SortOrderEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isDefined, isEnum } from "class-validator";

export class DateHistogramPointsDTO {
  @ApiProperty({ default: 60, required: true })
  dateHistogramPoints: 10|20|30|60;
}

export class DateHistogramPointsValidationPipe implements PipeTransform<string, Promise<number>> {
  private readonly validPoints: number[] = [10, 20, 30, 60];

  transform(value: string): Promise<number> {
    const parsedValue = parseInt(value, 10);
    if (!isNaN(parsedValue) && this.validPoints.includes(parsedValue)) {
      return Promise.resolve(parsedValue);
    } else {
      const errorMessage = `The value ${value} is not valid. Acceptable values: ${this.validPoints.join(', ')}`;
      throw new BadRequestException(errorMessage);
    }
  }
}