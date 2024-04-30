import { DataProviderRewardStats, RewardEpochSettings } from "../../../../../../../../libs/commons/src";

export class DataProviderRewardStatsDTO extends DataProviderRewardStats {
    timestamp: number;
    constructor(rewardStat: DataProviderRewardStats, rewardEpochSettings: RewardEpochSettings) {
        super()
        this.count = rewardStat.count;
        this.providerReward = rewardStat.providerReward;
        this.delegatorsReward = rewardStat.delegatorsReward;
        this.dataProvider = rewardStat.dataProvider;
        this.epochId = rewardStat.epochId;
        this.rewardRate = rewardStat.rewardRate;
        this.timestamp = rewardEpochSettings.getStartTimeForEpochId(rewardStat.epochId);
    }
}