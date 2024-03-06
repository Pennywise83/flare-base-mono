import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { isNotEmpty } from "class-validator";
import { AggregationInterval, AggregationIntervalEnum } from "libs/commons/src/model/aggregation-intervals";

export class AggregationIntervalDTO {
    @ApiProperty({ enum: AggregationIntervalEnum, default: '1d', required: false })
    aggregationInterval?: string;
}
export class AggregationIntervalValidationPipe implements PipeTransform<string, Promise<string>> {
    transform(value: string): Promise<string> {
        if (isNotEmpty(value)) {
            if (AggregationInterval.hasOwnProperty(value)) {
                return Promise.resolve(value);
            } else {
                const errorMessage = `The value ${AggregationInterval[value]} is not valid. See the acceptable values: ${Object.keys(
                    AggregationInterval
                ).join(', ')}`;
                throw new BadRequestException(errorMessage);
            }
        }
    }
}

