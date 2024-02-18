
export class RewardEpochSettings {
    firstEpochStartTime: number;
    rewardEpochDurationMillis: number;


    public getEpochIdsFromTimeRange(startTime: number, endTime: number): Array<number> {
        const epochIds: Array<number> = [];
        let epochStartTime = this.firstEpochStartTime;
        let epochIdIterator = 0;
        let currentEpochId: number = this.getCurrentEpochId();
        let nextEpochId: number = this.getNextEpochId();
        
        while (epochIdIterator <= nextEpochId+1) { // 0 -> 155
            const epochEndTime = epochStartTime + this.rewardEpochDurationMillis;
            if (startTime < epochEndTime && endTime > epochStartTime) {
                epochIds.push(epochIdIterator);
            }
            epochIdIterator++;
            epochStartTime += this.rewardEpochDurationMillis;
        }
        return epochIds;
    }

    public getEpochIdForTime(timeInMillis: number): number {
        let diff: number = timeInMillis - this.firstEpochStartTime;
        return Math.floor((diff) / (this.rewardEpochDurationMillis));
    }

    public getNextEpochId(): number {
        return this.getCurrentEpochId() + 1;
    }

    public getCurrentEpochId(): number {
        return this.getEpochIdForTime(new Date().getTime());
    }
    public getStartTimeForEpochId(epochId: number): number {
        let epochStartTime = this.firstEpochStartTime;
        let currentEpochId = 0;
        while ((epochStartTime + this.rewardEpochDurationMillis) <= (new Date().getTime() + this.rewardEpochDurationMillis) && currentEpochId < epochId) {

            epochStartTime += this.rewardEpochDurationMillis;
            currentEpochId++;
        }

        return epochStartTime;
    }

    public getEndTimeForEpochId(epochId: number): number {
        const epochStartTime = this.getStartTimeForEpochId(epochId);
        const epochEndTime = epochStartTime + this.rewardEpochDurationMillis;
        return epochEndTime;
    }


}