
export class PriceEpochSettings {
    firstEpochStartTime: number;     // in milliseconds
    priceEpochDurationMillis: number;            // in milliseconds
    revealEpochDurationMillis: number;            // in milliseconds


    public getEpochIdsFromTimeRange(startTime: number, endTime: number): Array<number> {
        const epochIds: Array<number> = [];
        let firstEpochStartTime:number = this.firstEpochStartTime;
        let epochId:number = 0;
        const currentEpochId: number = this.getCurrentEpochId();
        while (firstEpochStartTime <= endTime) {
            const epochStartTime: number = firstEpochStartTime;
            const epochEndTime: number = epochStartTime + this.priceEpochDurationMillis;
            const epochRevealTime: number = epochStartTime + this.priceEpochDurationMillis + this.revealEpochDurationMillis;
            if (epochRevealTime >= startTime   && endTime >= epochRevealTime && epochId < currentEpochId) {
                epochIds.push(epochId);
            }
            firstEpochStartTime += this.priceEpochDurationMillis;
            epochId++;
        }
        return epochIds;
    }

    public getEpochIdForTime(timeInMillis: number): number {
        let diff: number = timeInMillis - this.firstEpochStartTime;
        return Math.floor((diff) / (this.priceEpochDurationMillis));
    }

    public getCurrentEpochId(): number {
        return this.getEpochIdForTime(new Date().getTime());
    }
    public getLastFinalizedEpochId(): number {
        const now: number = new Date().getTime();
        const currentEpochId: number = this.getCurrentEpochId();
        const currentStartTime: number = this.getStartTimeForEpochId(currentEpochId);
        const currentEndTime: number = currentStartTime + this.priceEpochDurationMillis;
        const currentRevealTime: number = currentStartTime + this.priceEpochDurationMillis + this.revealEpochDurationMillis;
        if (now < currentRevealTime && now < currentEndTime) {
            return currentEpochId - 2;
        } else if (now < currentRevealTime && now > currentEndTime) {
            return currentEpochId - 1;
        } else {
            return currentEpochId;
        }
    }

    public getStartTimeForEpochId(epochId: number): number {
        let epochStartTime = this.firstEpochStartTime;
        let currentEpochId = 0;
        while (epochStartTime + (this.priceEpochDurationMillis) <= new Date().getTime() && currentEpochId < epochId) {
            epochStartTime += (this.priceEpochDurationMillis);
            currentEpochId++;
        }

        return epochStartTime;
    }

    public getEndTimeForEpochId(epochId: number): number {
        const epochStartTime = this.getStartTimeForEpochId(epochId);
        const epochEndTime = epochStartTime + this.priceEpochDurationMillis; // Conversione in millisecondi
        return epochEndTime;
    }
    public getRevealEndTimeForEpochId(epochId: number): number {
        const epochStartTime = this.getStartTimeForEpochId(epochId);
        const epochRevealEndTime = epochStartTime + this.priceEpochDurationMillis + this.revealEpochDurationMillis; // Conversione in millisecondi
        return epochRevealEndTime;
    }
}