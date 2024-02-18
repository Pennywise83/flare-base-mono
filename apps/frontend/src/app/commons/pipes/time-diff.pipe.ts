import { Pipe, PipeTransform } from '@angular/core';

export const INTERVALS = {
    'y': 31536000,
    'M': 2592000,
    'w': 604800,
    'd': 86400,
    'h': 3600,
    'm': 60,
    's': 1
};

@Pipe({
    name: 'timeDiff',
    standalone: true
})
export class TimeDiffPipe implements PipeTransform {

    transform(value: any, displayUnit: string = 's', formatHtml: boolean): any {
        if (!value) {
            return value;
        }

        if (typeof formatHtml == 'undefined') {
            formatHtml = false;
        }
        const expiryDate = +new Date(value);
        const now = +new Date();
        let seconds = (expiryDate - now) / 1000;
        let sign = Math.sign(seconds)
        let suffix = " left" // if the time is yet to come.
        if (sign === -1) {
            seconds = Math.floor(seconds * sign) // removign the sign and the float part -25.5  = 25 seconds 
            suffix = " ago" // if time is already expired.
        }

        const allIntervals = ['y', 'M', 'w', 'd', 'h', 'm', 's'];
        let result = '';

        for (let i = 0; i < allIntervals.length; i++) {
            const interval = allIntervals[i];
            const counter = Math.floor(seconds / INTERVALS[interval]);

            if (counter > 0) {
                result += this.calculateTime(counter, interval, formatHtml);

                if (interval === displayUnit) {
                    break;
                }

                seconds -= counter * INTERVALS[interval];

                if (interval !== 's' && displayUnit !== 's') {
                    result += ' ';
                }
            }
        }

        return result + ' ' + suffix;
    }

    calculateTime(counter: number, timeUnit: string, formatHtml: boolean) {
        if (formatHtml) {
            return `${counter}<small class="text-secondary">${timeUnit}</small> `;
        } else {
            return counter + timeUnit + ' ';

        }
    }
}
