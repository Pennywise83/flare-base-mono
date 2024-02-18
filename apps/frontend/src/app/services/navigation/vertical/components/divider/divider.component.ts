import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { VerticalNavigationComponent } from '../../vertical.component';
import { NavigationService } from '../../../navigation.service';
import { NavigationItem } from '../../../navigation';

@Component({
    selector: 'vertical-navigation-divider-item',
    templateUrl: './divider.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgClass],
})
export class VerticalNavigationDividerItemComponent implements OnInit, OnDestroy {
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
}
