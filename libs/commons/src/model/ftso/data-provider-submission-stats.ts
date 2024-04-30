import { ApiProperty } from "@nestjs/swagger";

export class DataProviderSubmissionStats {
    @ApiProperty({ description: 'Address of the data provider.' })
    dataProvider: string;
    @ApiProperty({ description: 'FTSO symbol to which the score refers. If the value is null, the score is considered global.' })
    symbol: string = null;
    @ApiProperty({ description: 'The quantity of data samples during the specified interval.' })
    numberOfCases: number = 0;
    @ApiProperty({ description: 'The percentage of revealed data samples over the number of finalized samples.' })
    availability: number = 0;
    @ApiProperty({ description: 'The percentage of samples inside the primary (interquartile) reward bands.' })
    innerIQR: number = 0;
    @ApiProperty({ description: 'The percentage of samples inside the secondary (elastic) reward bands.' })
    innerPct: number = 0;
    @ApiProperty({ description: 'The percentage of samples on the borders the primary (interquartile) reward bands.' })
    borderIQR: number = 0;
    @ApiProperty({ description: 'The percentage of samples on the borders the secondary (elastic) reward bands.' })
    borderPct: number = 0;
    @ApiProperty({ description: 'The percentage of samples outside the primary (interquartile) reward bands.' })
    outIQR: number = 0;
    @ApiProperty({ description: 'The percentage of samples outside the secondary (elastic) reward bands.' })
    outPct: number = 0;
    @ApiProperty({ description: 'The success rate of the data provider relative to the primary (interquartile) reward bands. The value is  represented as a percentage and calculated by the formula `innerPct + (borderPct/2)`.' })
    successRateIQR: number = 0;
    @ApiProperty({ description: 'The success rate of the data provider relative to the secondary (elastic) reward bands. The value is  represented as a percentage and calculated by the formula `innerPct + (borderPct/2)`.' })
    successRatePct: number = 0;
    @ApiProperty({ description: 'The success rate of the data provider. The value is  represented as a percentage and calculated by the formula `(successRateIQR + successRatePct) / 2`.' })
    successRate: number = 0;

    get innerIQRCases(): number {
        return (this.numberOfCases / 100) * this.innerIQR;
    }
    get innerPctCases(): number {
        return (this.numberOfCases / 100) * this.innerPct;
    }
    get borderIQRCases(): number {
        return (this.numberOfCases / 100) * this.borderIQR;
    }
    get borderPctCases(): number {
        return (this.numberOfCases / 100) * this.borderPct;
    }
    get outIQRCases(): number {
        return (this.numberOfCases / 100) * this.outIQR;
    }
    get outPctCases(): number {
        return (this.numberOfCases / 100) * this.outPct;
    }
    get successRateIQRCases(): number {
        return Math.ceil((this.numberOfCases / 100) * this.successRateIQR);
    }
    get successRatePctCases(): number {
        return Math.ceil((this.numberOfCases / 100) * this.successRatePct);
    }
    get successRateCases(): number {
        return Math.ceil((this.numberOfCases / 100) * this.successRate);
    }

    constructor() {
    }

    calculateSymbolStats(dataProvider: string, symbol: string, expectedCases: number, numberOfCases: number, innerIQR: number, innerPct: number, borderIQR: number, borderPct: number, outIQR: number, outPct: number): DataProviderSubmissionStats {
        let stats: DataProviderSubmissionStats = new DataProviderSubmissionStats();
        stats.dataProvider = dataProvider;
        stats.symbol = symbol;
        stats.numberOfCases = numberOfCases;
        stats.innerIQR = (100 * innerIQR) / numberOfCases;
        stats.innerPct = (100 * innerPct) / numberOfCases;
        stats.borderIQR = (100 * borderIQR) / numberOfCases;
        stats.borderPct = (100 * borderPct) / numberOfCases;
        stats.outIQR = (100 * outIQR) / numberOfCases;
        stats.outPct = (100 * outPct) / numberOfCases;
        stats.successRatePct = stats.innerPct + (stats.borderPct / 2);
        stats.successRateIQR = stats.innerIQR + (stats.borderIQR / 2);
        stats.successRate = (stats.successRateIQR + stats.successRatePct) / 2;
        stats.availability = (numberOfCases * 100) / expectedCases;
        return stats;
    }

    calculateGlobalStats(submissionStats: DataProviderSubmissionStats[], dataProvider: string, expectedCases: number, numberOfSymbols: number): DataProviderSubmissionStats {
        let stats: DataProviderSubmissionStats = new DataProviderSubmissionStats();
        stats.dataProvider = dataProvider;

        let allInnerIQR: number = 0;
        let allInnerPct: number = 0;
        let allBorderIQR: number = 0;
        let allBorderPct: number = 0;
        let allOutIQR: number = 0;
        let allOutPct: number = 0;
        let allNumberOfCases: number = 0;
        let allSuccessIQR: number = 0;
        submissionStats.map(submissionStat => {
            allInnerIQR += submissionStat.innerIQR;
            allInnerPct += submissionStat.innerPct;
            allBorderIQR += submissionStat.borderIQR;
            allBorderPct += submissionStat.borderPct;
            allOutIQR += submissionStat.outIQR;
            allOutPct += submissionStat.outPct;
            allSuccessIQR += submissionStat.successRateIQR;
            allNumberOfCases += submissionStat.numberOfCases;
        });
        stats.innerIQR = allInnerIQR / numberOfSymbols;
        stats.innerPct = allInnerPct / numberOfSymbols;
        stats.borderIQR = allBorderIQR / numberOfSymbols;
        stats.borderPct = allBorderPct / numberOfSymbols;
        stats.outIQR = allOutIQR / numberOfSymbols;
        stats.outPct = allOutPct / numberOfSymbols;
        stats.successRatePct = stats.innerPct + (stats.borderPct / 2);
        stats.successRateIQR = allSuccessIQR / numberOfSymbols;
        stats.successRate = (stats.successRateIQR + stats.successRatePct) / 2;
        stats.availability = (allNumberOfCases * 100) / expectedCases;
        stats.numberOfCases = allNumberOfCases;
        return stats;
    }
}