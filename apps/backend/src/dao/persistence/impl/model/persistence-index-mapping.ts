import { isNotEmpty } from "class-validator";

export class PersistenceIndexMapping {
    type: string;
    mapping: any;
    rollInterval: PersistenceRollIntervalEnum;
    constructor(type: string, mapping: any, rollInterval?: PersistenceRollIntervalEnum) {
        this.type = type;
        this.mapping = mapping;
        if (isNotEmpty(rollInterval)) {
            this.rollInterval = rollInterval;
        }
    }
}

export enum PersistenceRollIntervalEnum {
    YEARLY = "YEARLY",
    QUARTERLY = "QUARTERLY",
    HALF_YEARLY = "HALF_YEARLY",
    MONTHLY = "MONTHLY"
}
