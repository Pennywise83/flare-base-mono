import { Type, applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { ActionResult } from "./action-result";

export class PaginatedResult<T> {
    @ApiProperty({ example: 50, description: 'Total number of available results in the pagination.' })
    numResults: number = 0;
    @ApiProperty({ example: 1, description: 'Current page number in the pagination.' })
    page: number = 0;
    @ApiProperty({ example: 25, description: 'Page size representing the maximum number of results displayed per page.' })
    pageSize: number = 25;
    @ApiProperty({ example: 'timestamp', description: "Field by which to sort the results." })
    sortField: string = 'timestamp';
    @ApiProperty({ example: 'desc', description: "Sorting order of the results, either 'asc' (ascending) or 'desc' (descending)." })
    sortOrder: SortOrderEnum = SortOrderEnum.desc;
    results: T = null!;
    constructor(page: number, pageSize: number, sortField: string, sortOrder: SortOrderEnum, numResults?: number, results?: T) {
        this.page = page;
        this.pageSize = pageSize;
        this.sortField = sortField;
        this.sortOrder = sortOrder;
        if (typeof numResults != 'undefined') {
            this.numResults = numResults
        }
        if (typeof results != 'undefined') {
            this.results = results;
        }
    }
}
export enum SortOrderEnum {
    asc = 'asc',
    desc = 'desc'
}
export const ApiPaginatedResult = (dataDto: Type<unknown>, description: string) =>
    applyDecorators(
        ApiExtraModels(ActionResult, PaginatedResult, dataDto),
        ApiOkResponse({
            description: description,
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ActionResult) },
                    {
                        properties: {
                            result: {
                                allOf: [
                                    { $ref: getSchemaPath(PaginatedResult) },
                                    {
                                        properties: {
                                            results: {
                                                type: 'array',
                                                items: { $ref: getSchemaPath(dataDto) },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                ],
            },
        }),
    );