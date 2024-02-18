import { isNotEmpty } from "class-validator";
export class WalletBalance {
    nativeTokenBalance: number;
    wrappedTokenBalance: number;
    constructor(balances?: number[]) {
        if (isNotEmpty(balances)) {
            this.nativeTokenBalance = balances[0];
            this.wrappedTokenBalance = balances[1];
        } else {
            this.nativeTokenBalance = 0;
            this.wrappedTokenBalance = 0;
        }
    }
}