import { ApiProperty } from "@nestjs/swagger";

export class BlockInfo {
    timestamp: number;
    @ApiProperty({ description: 'The block number at which the event occurred.', example: '10294341' })
    blockNumber?: number;
    nonce: string;
}