import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, forwardRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { VerticalNavigationComponent } from '../../vertical.component';
import { VerticalNavigationBasicItemComponent } from '../basic/basic.component';
import { VerticalNavigationCollapsableItemComponent } from '../collapsable/collapsable.component';
import { VerticalNavigationDividerItemComponent } from '../divider/divider.component';
import { VerticalNavigationSpacerItemComponent } from '../spacer/spacer.component';
import { NavigationService } from '../../../navigation.service';
import { NavigationItem } from '../../../navigation';

@Component({
    selector: 'vertical-navigation-group-item',
    templateUrl: './group.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgClass, NgIf, MatIconModule, NgFor, VerticalNavigationBasicItemComponent, VerticalNavigationCollapsableItemComponent, VerticalNavigationDividerItemComponent, forwardRef(() => VerticalNavigationGroupItemComponent), VerticalNavigationSpacerItemComponent],
})
export class VerticalNavigationGroupItemComponent implements OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_autoCollapse: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() autoCollapse: boolean;
    @Input() item: NavigationItem;
    @Input() name: string;

    private _verticalNavigationComponent: VerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _navigationService: NavigationService,
    ) {
    }
    ngOnInit(): void {
        this._verticalNavigationComponent = this._navigationService.getComponent(this.name);
        this._verticalNavigationComponent.onRefreshed.pipe(
            takeUntil(this._unsubscribeAll),
        ).subscribe(() => {
            this._changeDetectorRef.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
