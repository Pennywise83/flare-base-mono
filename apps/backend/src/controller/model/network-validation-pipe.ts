import { NetworkEnum } from "@flare-base/commons";
import { BadRequestException, PipeTransform } from "@nestjs/common";
import { isDefined, isEnum } from "class-validator";

export class NetworkValidationPipe implements PipeTransform<string, Promise<NetworkEnum>> {
    transform(value: string): Promise<NetworkEnum> {
        if (isDefined(value) && isEnum(value, NetworkEnum)) {
            return NetworkEnum[value];
        } else {
            const errorMessage = `The value ${value} is not valid. See the acceptable values: ${Object.keys(
                NetworkEnum
            ).map(key => NetworkEnum[key])}`;
            throw new BadRequestException(errorMessage);
        }
    }
}