import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { NavigationService } from '../../../navigation.service';
import { VerticalNavigationComponent } from '../../vertical.component';
import { VerticalNavigationBasicItemComponent } from '../basic/basic.component';
import { VerticalNavigationCollapsableItemComponent } from '../collapsable/collapsable.component';
import { VerticalNavigationDividerItemComponent } from '../divider/divider.component';
import { VerticalNavigationGroupItemComponent } from '../group/group.component';
import { VerticalNavigationSpacerItemComponent } from '../spacer/spacer.component';
import { NavigationItem } from '../../../navigation';

@Component({
    selector: 'vertical-navigation-aside-item',
    templateUrl: './aside.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgClass, MatTooltipModule, NgIf, MatIconModule, NgFor, VerticalNavigationBasicItemComponent, VerticalNavigationCollapsableItemComponent, VerticalNavigationDividerItemComponent, VerticalNavigationGroupItemComponent, VerticalNavigationSpacerItemComponent],
})
export class VerticalNavigationAsideItemComponent implements OnChanges, OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_autoCollapse: BooleanInput;
    static ngAcceptInputType_skipChildren: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() activeItemId: string;
    @Input() autoCollapse: boolean;
    @Input() item: NavigationItem;
    @Input() name: string;
    @Input() skipChildren: boolean;

    active: boolean = false;
    private _verticalNavigationComponent: VerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _navigationService: NavigationService,
    ) {
    }
    ngOnChanges(changes: SimpleChanges): void {
        if ('activeItemId' in changes) {
            this._markIfActive(this._router.url);
        }
    }

    ngOnInit(): void {
        this._markIfActive(this._router.url);
        this._router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntil(this._unsubscribeAll),
            )
            .subscribe((event: NavigationEnd) => {
                this._markIfActive(event.urlAfterRedirects);
            });

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

    private _hasActiveChild(item: NavigationItem, currentUrl: string): boolean {
        const children = item.children;

        if (!children) {
            return false;
        }

        for (const child of children) {
            if (child.children) {
                if (this._hasActiveChild(child, currentUrl)) {
                    return true;
                }
            }
            if (child.type !== 'basic') {
                continue;
            }
            if (child.link && this._router.isActive(child.link, child.exactMatch || false)) {
                return true;
            }
        }

        return false;
    }


    private _markIfActive(currentUrl: string): void {
        this.active = this.activeItemId === this.item.id;
        if (this._hasActiveChild(this.item, currentUrl)) {
            this.active = true;
        }
        this._changeDetectorRef.markForCheck();
    }
}
