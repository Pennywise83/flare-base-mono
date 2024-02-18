import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'addressTrim',
    standalone: true
})
export class AddressTrimPipe implements PipeTransform {
    transform(value: string, numChars: number): string {
        if (!value) {
            return '';
        }

        const length = value.length;
        const trimmedString =
            value.slice(0, numChars) +
            '...' +
            value.slice(length - numChars, length);

        return trimmedString;
    }
}