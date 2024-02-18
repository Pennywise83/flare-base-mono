export class ClaimRewardsRequest {
    receiver: string = null;
    wrap: boolean = false;
    rewardEpochIds: number[] = [];
}