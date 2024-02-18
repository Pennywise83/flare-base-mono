import { ApiProperty } from "@nestjs/swagger";

export class PageSizeDTO {
    @ApiProperty({default: 25, required: false})
    pageSize: Number
  }