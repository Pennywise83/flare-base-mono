export class TimeRangeDefinition {
    id: string;
    label: string;
    timeDiff: number;
    isSelected: boolean; 
    constructor(id: string, label: string, timeDiff: number ) {
        this.id = id;
        this.label = label;
        this.timeDiff = timeDiff;
    }
    getTimeRange():TimeRange {
        let timeRange: TimeRange = new TimeRange();
        timeRange.start = new Date().getTime()-this.timeDiff-5000;
        timeRange.end = new Date().getTime()-5000;
        return timeRange;
    }
}

export class TimeRange {
    start: number;
    end: number;
}