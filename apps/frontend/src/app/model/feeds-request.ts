import { start } from "repl";
import { DelegationsSortEnum, PriceFinalizedSortEnum, PriceRevealedSortEnum, RewardDistributedSortEnum, SortOrderEnum } from "../../../../../libs/commons/src";
import { PaginatedRequest } from "./paginated-request";
import { isNumber } from "class-validator";
import { single } from "rxjs";

export class FeedsRequest extends PaginatedRequest {
    address: string;
    symbol: string;
    startTime: number;
    endTime: number;
    
    get addressList(): string[] {
        let result: string[] =[];
        const regex = /^0x[0-9a-fA-F]{40}$/;
        this.address.split(',').map(singleAddress => {
            if (regex.test(singleAddress)) {
                result.push(singleAddress);
            }
        })
        return result;
    }
    constructor(address: string, startTime: number, endTime: number) {
        super();
        this.address = address;
        if (isNumber(startTime)) {
            this.startTime = startTime;
        }
        if (isNumber(endTime)) {
            this.endTime = endTime;
        }
    }
}
export class FinalizedPricesFeedsRequest extends FeedsRequest {
    sortField: PriceFinalizedSortEnum;
    sortOrder: SortOrderEnum;
}
export class RevealedPricesFeedsRequest extends FeedsRequest {
    sortField: PriceRevealedSortEnum;
    sortOrder: SortOrderEnum;
}
export class RewardsDistributedRequest extends FeedsRequest {
    sortField: RewardDistributedSortEnum;
    sortOrder: SortOrderEnum;
}