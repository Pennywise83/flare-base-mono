import { ApiProperty } from "@nestjs/swagger";

export class DataProviderScore {
    @ApiProperty({ description: 'Representing the address of the data provider.' })
    dataProvider: string;
    @ApiProperty({ description: 'It represents the FTSO symbol to which the score refers. If the value is null, the score is considered global.' })
    symbol: string = null;
    @ApiProperty({ description: 'The quantity of data samples during the specified interval.' })
    numberOfCases: number = 0;
    @ApiProperty({ description: ' The percentage of samples inside the primary (interquartile) reward bands.' })
    innerIQR: number = 0;
    @ApiProperty({ description: ' The percentage of samples inside the secondary (elastic) reward bands.' })
    innerPct: number = 0;
    @ApiProperty({ description: ' The percentage of samples on the borders the primary (interquartile) reward bands.' })
    borderIQR: number = 0;
    @ApiProperty({ description: ' The percentage of samples on the borders the secondary (elastic) reward bands.' })
    borderPct: number = 0;
    @ApiProperty({ description: ' The percentage of samples outside the primary (interquartile) reward bands.' })
    outIQR: number = 0;
    @ApiProperty({ description: ' The percentage of samples outside the secondary (elastic) reward bands.' })
    outPct: number = 0;
    @ApiProperty({ description: ' The success rate of the data relative to the primary (interquartile) reward bands. The value is  represented as a percentage and calculated by the formula `innerPct + 0.5(borderPct)`.' })
    successRateIQR: number = 0;
    @ApiProperty({ description: ' The success rate of the data relative to the secondary (elastic) reward bands. The value is  represented as a percentage and calculated by the formula `innerPct + 0.5(borderPct)`.' })
    successRatePct: number = 0;
    @ApiProperty({ description: ' The success rate of the data. The value is  represented as a percentage and calculated by the formula `(successRateIQR + successRatePct) / 2`.' })
    successRate: number = 0;
}