import { ApiProperty } from "@nestjs/swagger";

export class PageDTO {
    @ApiProperty({default: 1, required: false})
    page: Number
  }