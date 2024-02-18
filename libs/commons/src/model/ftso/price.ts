import { BlockInfo } from "../blockchain";

export class Price extends BlockInfo {
    epochId: number;
    symbol: string;
    price: number;
}