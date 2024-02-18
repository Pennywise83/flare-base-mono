import { BlockInfo } from "../blockchain";

export class RewardDistributed extends BlockInfo {
    symbol: string;
    epochId: number;
    address: string;
    reward: number;
    providerReward: number;
}