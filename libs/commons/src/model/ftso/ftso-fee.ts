import { ApiProperty } from "@nestjs/swagger";
import { BlockInfo } from "../blockchain";

export class FtsoFee extends BlockInfo {
    @ApiProperty({ description: 'Address of the data provider.' })
    dataProvider: string;
    @ApiProperty({ description: 'Fee percentage.' })
    value: number;
    @ApiProperty({ description: 'The reward epoch from which the fee takes effect.' })
    validFromEpoch: number;
}

export enum FtsoFeeSortEnum {
    timestamp = 'timestamp',
    validFromEpoch = 'validFromEpoch',
    dataProvider = 'dataProvider',
    value = 'value',
}
