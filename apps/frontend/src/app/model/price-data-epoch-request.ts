import { SortOrderEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";

export class PriceDataEpochRequest extends PaginatedRequest {
    epochId: number;
    sortField: PriceDataEpochRequestSortEnum;
    sortOrder: SortOrderEnum;
    constructor(epochId: number) {
        super();
        this.epochId = epochId;
        this.sortField = PriceDataEpochRequestSortEnum.timestamp;
        this.sortOrder = SortOrderEnum.desc;
        this.pageSize = 10000;
    }
}

export enum PriceDataEpochRequestSortEnum {
    timestamp="timestamp",
    value="value",
    symbol="symbol",
    epochId="epochId"
}