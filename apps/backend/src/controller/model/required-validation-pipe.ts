import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class RequiredValidationPipe implements PipeTransform<any> {
    transform(value: any, metadata: ArgumentMetadata): any {
        if (value === undefined || value === null) {
            throw new BadRequestException(`${metadata.data} is required`);
        }
        return value;
    }
}