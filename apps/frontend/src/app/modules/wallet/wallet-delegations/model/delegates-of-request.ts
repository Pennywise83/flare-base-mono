import { DelegatesOf } from "./delegates-of";

export class DelegatesOfRequest extends DelegatesOf {
    allocablePercentage: number = 0;
    existingDelegation: boolean = false;
    constructor(address: string, bips: number, allocablePercentage: number, existingDelegation: boolean) {
        super(address, bips);
        this.allocablePercentage = allocablePercentage;
        this.existingDelegation = existingDelegation;
    }
}