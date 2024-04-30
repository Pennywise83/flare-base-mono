import { DelegationsSortEnum, SortOrderEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";

export class DelegatorsRequest extends PaginatedRequest {
    address: string;
    epochId: number;
    sortField: DelegationsSortEnum;
    sortOrder: SortOrderEnum;

    constructor(address: string, epochId: number) {
        super();
        this.address = (address && address!=null) ? address.split(',')[0] : address;
        this.epochId = epochId;
        this.sortField = DelegationsSortEnum.timestamp;
        this.sortOrder = SortOrderEnum.desc;
    }
}