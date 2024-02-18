import { ApiProperty } from "@nestjs/swagger";

export enum NetworkEnum {
    flare = "flare",
    songbird = "songbird"
}
export class NetworkDTO {
    @ApiProperty({ enum: NetworkEnum, default: NetworkEnum.flare, required: true, description: "The blockchain network" })
    network: NetworkEnum;
}

