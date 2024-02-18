import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class AddressValidationPipe implements PipeTransform<string, Promise<string>> {
    private readonly regex = /^0x[0-9a-fA-F]{40}$/;
    async transform(value: string, metadata: ArgumentMetadata): Promise<string> {
        if (value && !this.regex.test(value)) {
            const errorMessage = `Invalid ERC20 address: ${value}`;
            throw new BadRequestException(errorMessage);
        }

        if (value) {
            return value.toLowerCase();
        } else {
            return null
        }
    }
}
