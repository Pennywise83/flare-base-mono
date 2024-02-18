import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class ServerSettings {
    @IsOptional() @IsNotEmpty() @IsNumber()
    port: number = 3000;
    frontendStaticPath: string;
    @IsNotEmpty()
    redisMembers: string[];
}