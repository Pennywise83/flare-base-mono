
export class DelegatesOf {
    address: string;
    percentage: number;
    constructor(address: string, bips: number) {
        this.address = address;
        this.percentage = bips / 100
    }
}
