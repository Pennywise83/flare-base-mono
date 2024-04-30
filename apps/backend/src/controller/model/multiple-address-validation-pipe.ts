import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class MultipleAddressValidationPipe implements PipeTransform<string, Promise<string>> {
    private readonly regex = /^0x[0-9a-fA-F]{40}$/;
    async transform(value: string, metadata: ArgumentMetadata): Promise<string> {
        let singleValues: string[] = value.split(',');
        singleValues.map(singleValue => {
            if (singleValue && !this.regex.test(singleValue)) {
                const errorMessage = `Invalid ERC20 address: ${singleValue}`;
                throw new BadRequestException(errorMessage);
            }
        })
        

        if (value) {
            return value.toLowerCase();
        } else {
            return null
        }
    }
}
