export const AggregationInterval: { [interval: string]: number } = {
    "1h": 3600000,
    "2h": 7200000,
    "6h": 21600000,
    "12h": 43200000,
    "1d": 86400000,
    "2d": 172800000,
    "3d": 259200000,
    "1w": 604800000,
    "1M": 2592000000
} as const;

export enum AggregationIntervalEnum {
    OneHour = "1h",
    TwoHours = "2h",
    SixHours = "6h",
    TwelveHours = "12h",
    OneDay = "1d",
    TwoDays = "2d",
    ThreeDays = "3d",
    OneWeek = "1w",
    OneMonth = "1M"
}