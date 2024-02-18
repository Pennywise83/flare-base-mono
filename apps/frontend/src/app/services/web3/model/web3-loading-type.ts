export class Web3LoadingType {
    type: Web3LoadingTypeEnum;
    loading: boolean;
    constructor(type: Web3LoadingTypeEnum, loading: boolean) {
        this.type = type;
        this.loading = loading;
    }
}
export enum Web3LoadingTypeEnum {
    GLOBAL = <any>'LOADING',
    BALANCES = <any>'BALANCES',
    DELEGATIONS = <any>'DELEGATIONS',
    UNCLAIMED_REWARDS = <any>'UNCLAIMED_REWARDS'
}