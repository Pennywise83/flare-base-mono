import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NavigationService } from '../../../navigation.service';
import { HorizontalNavigationComponent } from '../../horizontal.component';
import { NavigationItem } from '../../../navigation';

@Component({
    selector: 'horizontal-navigation-spacer-item',
    templateUrl: './spacer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgClass],
})
export class HorizontalNavigationSpacerItemComponent implements OnInit, OnDestroy {
    @Input() item: NavigationItem;
    @Input() name: string;

    private _horizontalNavigationComponent: HorizontalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _avigationService: NavigationService,
    ) {
    }

    ngOnInit(): void {
        this._horizontalNavigationComponent = this._avigationService.getComponent(this.name);
        this._horizontalNavigationComponent.onRefreshed.pipe(
            takeUntil(this._unsubscribeAll),
        ).subscribe(() => {
            this._changeDetectorRef.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
