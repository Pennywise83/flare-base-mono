import { DataProviderRewardStatsGroupByEnum, DelegationsSortEnum, SortOrderEnum, VotePowerSortEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";

export class RewardsHistoryRequest extends PaginatedRequest {
    address: string;
    startTime: number;
    endTime: number;
    sortField: DataProviderRewardStatsGroupByEnum;
    sortOrder: SortOrderEnum;
    constructor(address: string, startTime: number, endTime: number) {
        super();
        this.address = (address && address != null) ? address.split(',')[0] : address;
        this.startTime = startTime;
        this.endTime = endTime;
        this.sortField = DataProviderRewardStatsGroupByEnum.rewardEpochId;
        this.sortOrder = SortOrderEnum.desc;
    }
}