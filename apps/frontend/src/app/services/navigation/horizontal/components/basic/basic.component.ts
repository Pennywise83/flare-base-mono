import { CommonModule, NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NavigationService } from '../../../navigation.service';
import { HorizontalNavigationComponent } from '../../horizontal.component';
import { NavigationItem } from '../../../navigation';

@Component({
    selector: 'horizontal-navigation-basic-item',
    templateUrl: './basic.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgClass, NgIf, CommonModule, RouterLink, RouterLinkActive, MatTooltipModule, NgTemplateOutlet, MatMenuModule, MatIconModule],
})
export class HorizontalNavigationBasicItemComponent implements OnInit, OnDestroy {
    @Input() item: NavigationItem;
    @Input() name: string;

    isActiveMatchOptions: IsActiveMatchOptions;
    private _horizontalNavigationComponent: HorizontalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _navigationService: NavigationService
    ) {
        this.isActiveMatchOptions = this._navigationService.subsetMatchOptions;
    }

    ngOnInit(): void {

        this.isActiveMatchOptions =
            this.item.isActiveMatchOptions ?? this.item.exactMatch
                ? this._navigationService.exactMatchOptions
                : this._navigationService.subsetMatchOptions;

        this._horizontalNavigationComponent = this._navigationService.getComponent(this.name);

        this._changeDetectorRef.markForCheck();

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
