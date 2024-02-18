import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
    selector: 'error-404',
    standalone: true,
    templateUrl: './error-404.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Error404Component {
    /**
     * Constructor
     */
    constructor() {
    }
}
