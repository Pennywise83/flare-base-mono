import { BlockInfo } from "../blockchain";

export class VoterWhitelist extends BlockInfo {
    address: string;
    symbol: string;
    whitelisted: boolean;
}