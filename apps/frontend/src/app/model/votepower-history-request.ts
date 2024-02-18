import { DelegationsSortEnum, SortOrderEnum, VotePowerSortEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";

export class VotePowerHistoryRequest extends PaginatedRequest {
    address: string;
    startTime: number;
    endTime: number;
    sortField: VotePowerSortEnum;
    sortOrder: SortOrderEnum;
    constructor(address: string, startTime: number, endTime: number) {
        super();
        this.address = address;
        this.startTime = startTime;
        this.endTime = endTime;
        this.sortField = VotePowerSortEnum.timestamp;
        this.sortOrder = SortOrderEnum.desc;
    }
}