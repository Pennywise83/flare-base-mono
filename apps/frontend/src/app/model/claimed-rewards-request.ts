import { PaginatedRequest } from "app/model/paginated-request";
import { ClaimedRewardsSortEnum, SortOrderEnum } from "../../../../../libs/commons/src";

export class ClaimedRewardsRequest extends PaginatedRequest {
    whoClaimed: string;
    sentTo: string;
    dataProvider: string;
    startTime: number;
    endTime: number;
    sortField: ClaimedRewardsSortEnum;
    sortOrder: SortOrderEnum;
    constructor(whoClaimed: string, dataProvider: string, startTime: number, endTime: number) {
        super();
        this.whoClaimed = whoClaimed;
        this.dataProvider = dataProvider;
        this.startTime = startTime;
        this.endTime = endTime;
        this.sortField = ClaimedRewardsSortEnum.timestamp;
        this.sortOrder = SortOrderEnum.desc;
    }
}