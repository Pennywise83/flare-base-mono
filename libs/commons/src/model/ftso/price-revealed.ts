import { ApiProperty } from "@nestjs/swagger";
import { isNotEmpty } from "class-validator";
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

    get isWinning(): boolean {
        return (this.innerIQR || this.innerPct || this.borderIQR || this.borderPct);
    }
}

export class PriceRevealedMatrix {
    timestamp: (number | null)[];
    epochId: (number | null)[];
    symbol: (string | null)[];
    value: (number | null)[];
    dataProvider: (string | null)[];
    innerIQR: (boolean | null)[];
    borderIQR: (boolean | null)[];
    outIQR: (boolean | null)[];
    innerPct: (boolean | null)[];
    borderPct: (boolean | null)[];
    outPct: (boolean | null)[];
    toObject(data: PriceRevealedMatrix): PriceRevealed[] {
        let results: PriceRevealed[] = [];
        data.epochId.forEach((element, idx) => {
            let obj: PriceRevealed = new PriceRevealed();
            obj.epochId = data.epochId[idx]!;
            obj.timestamp = data.timestamp[idx]!;
            obj.symbol = data.symbol[idx]!;
            obj.value = data.value[idx]!;
            obj.dataProvider = data.dataProvider[idx]!;
            obj.innerIQR = data.innerIQR[idx]!;
            obj.borderIQR = data.borderIQR[idx]!;
            obj.outIQR = data.outIQR[idx]!;
            obj.innerPct = data.innerPct[idx]!;
            obj.borderPct = data.borderPct[idx]!;
            obj.outPct = data.outPct[idx]!;
            results.push(obj);
        })
        return results;
    }
    constructor(revealedPrices?: PriceRevealed[]) {
        if (isNotEmpty(revealedPrices)) {
            this.timestamp = revealedPrices.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
            this.epochId = revealedPrices.map(item => isNotEmpty(item.epochId) ? item.epochId : null);
            this.symbol = revealedPrices.map(item => isNotEmpty(item.symbol) ? item.symbol : null);
            this.value = revealedPrices.map(item => isNotEmpty(item.value) ? item.value : null);
            this.dataProvider = revealedPrices.map(item => isNotEmpty(item.dataProvider) ? item.dataProvider : null);
            this.innerIQR = revealedPrices.map(item => isNotEmpty(item.innerIQR) ? item.innerIQR : null);
            this.outIQR = revealedPrices.map(item => isNotEmpty(item.outIQR) ? item.outIQR : null);
            this.borderIQR = revealedPrices.map(item => isNotEmpty(item.borderIQR) ? item.borderIQR : null);
            this.innerPct = revealedPrices.map(item => isNotEmpty(item.innerPct) ? item.innerPct : null);
            this.outPct = revealedPrices.map(item => isNotEmpty(item.outPct) ? item.outPct : null);
            this.borderPct = revealedPrices.map(item => isNotEmpty(item.borderPct) ? item.borderPct : null);
        }
    }
}

export enum PriceRevealedSortEnum {
    timestamp = 'timestamp',
    epochId = 'epochId',
    symbol = 'symbol',
    value = 'value',
    dataProvider = 'dataProvider',
    innerIQR = 'innerIQR',
    outIQR = 'outIQR',
    borderIQR = 'borderIQR',
    innerPct = 'innerPct',
    outPct = 'outPct',
    borderPct = 'borderPct'
}
