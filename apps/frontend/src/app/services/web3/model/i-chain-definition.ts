import { NetworkEnum } from "../../../../../../../libs/commons/src";

export interface IChainDefinition {
    network: NetworkEnum;
    chainId: number;
    rpcUrls: string[];
    chainName: string;
    nativeCurrency: IChainCurrencyDefinition;
    wrappedCurrency: IChainCurrencyDefinition;
    blockExplorerUrls: string[];
    priceSubmitterContract: string;
    rewardDistributorContractAddress:string;
    

}

export interface IChainCurrencyDefinition {
    name: string;
    symbol: string;
    decimals: number;
    icon: string;
}