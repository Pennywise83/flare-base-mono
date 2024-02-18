import { DelegationsSortEnum, SortOrderEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";

export class DelegationsRequest extends PaginatedRequest {
    from: string;
    to: string;
    startTime: number;
    endTime: number;
    sortField: DelegationsSortEnum;
    sortOrder: SortOrderEnum;
    constructor(from?: string, to?: string, startTime?: number, endTime?: number) {
        super();
        this.from = from;
        this.to = to;
        this.startTime = startTime;
        this.endTime = endTime;
        this.sortField = DelegationsSortEnum.timestamp;
        this.sortOrder = SortOrderEnum.desc;
    }
}