import { ApiProperty } from "@nestjs/swagger";
import { Price } from "./price";

export class PriceRevealed extends Price {
    @ApiProperty({ description: 'Address of the data provider.' })
    dataProvider: string;
    @ApiProperty({ description: 'The number of samples inside the primary (interquartile) reward bands.' })
    innerIQR: boolean;
    @ApiProperty({ description: 'The number of samples on the borders the primary (interquartile) reward bands.' })
    borderIQR: boolean;
    @ApiProperty({ description: 'The number of samples outside the primary (interquartile) reward bands.' })
    outIQR: boolean;
    @ApiProperty({ description: 'The number of samples inside the secondary (elastic) reward bands.' })
    innerPct: boolean;
    @ApiProperty({ description: 'The number of samples on the borders the secondary (elastic) reward bands.' })
    borderPct: boolean;
    @ApiProperty({ description: 'The number of samples outside the secondary (elastic) reward bands.' })
    outPct: boolean;
}

export enum PriceRevealedSortEnum {
    timestamp = 'timestamp',
    epochId = 'epochId',
    symbol = 'symbol',
    price = 'price',
    dataProvider = 'dataProvider',
    innerIQR='innerIQR',
    outIQR='outIQR',
    borderIQR='borderIQR',
    innerPct='innerPct',
    outPct='outPct',
    borderPct='borderPct'
}
