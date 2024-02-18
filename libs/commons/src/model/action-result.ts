import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiProperty, getSchemaPath } from '@nestjs/swagger';
export class ActionResult<T> {
    @ApiProperty({ description: 'The duration of the action in milliseconds', example: 0 })
    duration: number = 0;
    @ApiProperty({ description: 'A message related to the action result', example: 'Operation completed successfully' })
    message: string | null = null;
    @ApiProperty({ description: 'The timestamp when the action started in milliseconds', example: 1635367649000 })
    start: number = 0;
    @ApiProperty({ description: 'The status of the action (e.g., "OK" for success, "KO" for failure)', example: 'OK' })
    status: string | null = null;
    result: T | null = null;
    constructor() {
        this.start = new Date().getTime();
        this.status = 'KO';
        this.result = null;
    }
}
export const ApiActionResultArray = <DataDto extends Type<unknown>>(dataDto: DataDto, description?: string) =>
    applyDecorators(
        ApiExtraModels(ActionResult, dataDto),
        ApiOkResponse({
            description: description,
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ActionResult) },
                    {
                        properties: {
                            result: {
                                type: 'array',
                                items: { $ref: getSchemaPath(dataDto) },
                            },
                        },
                    },
                ],
            },
        }),
    )

export const ApiActionResult = <DataDto extends Type<unknown>>(dataDto: DataDto, description?: string) =>
    applyDecorators(
        ApiExtraModels(ActionResult, dataDto),
        ApiOkResponse({
            description: description,
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ActionResult) },
                    {
                        properties: {
                            result: {
                                $ref: getSchemaPath(dataDto),
                            },
                        },
                    },
                ],
            },
        }),
    )