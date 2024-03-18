import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";

export class Price extends BlockInfo {
    @ApiProperty({ description: 'The ID of the epoch which the price refers' })
    epochId: number;
    @ApiProperty({ description: 'The FTSO symbol to which the price refers.' })
    symbol: string;
    @ApiProperty({ description: 'The asset\'s price for that epoch.' })
    price: number;
}