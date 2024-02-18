import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, Input, OnDestroy, OnInit, forwardRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { NavigationService } from '../../../navigation.service';
import { VerticalNavigationComponent } from '../../vertical.component';
import { VerticalNavigationBasicItemComponent } from '../basic/basic.component';
import { VerticalNavigationDividerItemComponent } from '../divider/divider.component';
import { VerticalNavigationGroupItemComponent } from '../group/group.component';
import { VerticalNavigationSpacerItemComponent } from '../spacer/spacer.component';
import { NavigationItem } from '../../../navigation';
import { animations } from 'app/commons/animations';

@Component({
    selector       : 'vertical-navigation-collapsable-item',
    templateUrl    : './collapsable.component.html',
    animations     : animations,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone     : true,
    imports        : [NgClass, MatTooltipModule, NgIf, MatIconModule, NgFor, VerticalNavigationBasicItemComponent, forwardRef(() => VerticalNavigationCollapsableItemComponent), VerticalNavigationDividerItemComponent, VerticalNavigationGroupItemComponent, VerticalNavigationSpacerItemComponent],
})
export class VerticalNavigationCollapsableItemComponent implements OnInit, OnDestroy
{
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_autoCollapse: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() autoCollapse: boolean;
    @Input() item: NavigationItem;
    @Input() name: string;

    isCollapsed: boolean = true;
    isExpanded: boolean = false;
    private _verticalNavigationComponent: VerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _navigationService: NavigationService,
    )
    {
    }
    @HostBinding('class') get classList(): any
    {
        /* eslint-disable @typescript-eslint/naming-convention */
        return {
            'vertical-navigation-item-collapsed': this.isCollapsed,
            'vertical-navigation-item-expanded' : this.isExpanded,
        };
        /* eslint-enable @typescript-eslint/naming-convention */
    }

    ngOnInit(): void
    {
        this._verticalNavigationComponent = this._navigationService.getComponent(this.name);
        if ( this._hasActiveChild(this.item, this._router.url) )
        {
            this.expand();
        }
        else
        {
            if ( this.autoCollapse )
            {
                this.collapse();
            }
        }
        this._verticalNavigationComponent.onCollapsableItemCollapsed
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((collapsedItem) =>
            {
                if ( collapsedItem === null )
                {
                    return;
                }
                if ( this._isChildrenOf(collapsedItem, this.item) )
                {
                    this.collapse();
                }
            });

        if ( this.autoCollapse )
        {
            this._verticalNavigationComponent.onCollapsableItemExpanded
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((expandedItem) =>
                {
                    if ( expandedItem === null )
                    {
                        return;
                    }

                    if ( this._isChildrenOf(this.item, expandedItem) )
                    {
                        return;
                    }
                    if ( this._hasActiveChild(this.item, this._router.url) )
                    {
                        return;
                    }
                    if ( this.item === expandedItem )
                    {
                        return;
                    }
                    this.collapse();
                });
        }

        this._router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntil(this._unsubscribeAll),
            )
            .subscribe((event: NavigationEnd) =>
            {
                if ( this._hasActiveChild(this.item, event.urlAfterRedirects) )
                {
                    this.expand();
                }
                else
                {
                    if ( this.autoCollapse )
                    {
                        this.collapse();
                    }
                }
            });

        this._verticalNavigationComponent.onRefreshed.pipe(
            takeUntil(this._unsubscribeAll),
        ).subscribe(() =>
        {
            this._changeDetectorRef.markForCheck();
        });
    }

    ngOnDestroy(): void
    {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    collapse(): void
    {
        if ( this.item.disabled )
        {
            return;
        }
        if ( this.isCollapsed )
        {
            return;
        }

        this.isCollapsed = true;
        this.isExpanded = !this.isCollapsed;
        this._changeDetectorRef.markForCheck();
        this._verticalNavigationComponent.onCollapsableItemCollapsed.next(this.item);
    }

    expand(): void
    {
        if ( this.item.disabled )
        {
            return;
        }
        if ( !this.isCollapsed )
        {
            return;
        }

        this.isCollapsed = false;
        this.isExpanded = !this.isCollapsed;
        this._changeDetectorRef.markForCheck();
        this._verticalNavigationComponent.onCollapsableItemExpanded.next(this.item);
    }

    toggleCollapsable(): void
    {
        if ( this.isCollapsed )
        {
            this.expand();
        }
        else
        {
            this.collapse();
        }
    }

    trackByFn(index: number, item: any): any
    {
        return item.id || index;
    }
    private _hasActiveChild(item: NavigationItem, currentUrl: string): boolean
    {
        const children = item.children;

        if ( !children )
        {
            return false;
        }

        for ( const child of children )
        {
            if ( child.children )
            {
                if ( this._hasActiveChild(child, currentUrl) )
                {
                    return true;
                }
            }

            if ( child.link && this._router.isActive(child.link, child.exactMatch || false) )
            {
                return true;
            }
        }

        return false;
    }

    private _isChildrenOf(parent: NavigationItem, item: NavigationItem): boolean
    {
        const children = parent.children;

        if ( !children )
        {
            return false;
        }

        if ( children.indexOf(item) > -1 )
        {
            return true;
        }

        for ( const child of children )
        {
            if ( child.children )
            {
                if ( this._isChildrenOf(child, item) )
                {
                    return true;
                }
            }
        }

        return false;
    }
}
