import { BooleanInput } from '@angular/cdk/coercion';
import { CommonModule, NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, ViewChild, forwardRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NavigationItem } from '../../../navigation';
import { NavigationService } from '../../../navigation.service';
import { HorizontalNavigationComponent } from '../../horizontal.component';
import { HorizontalNavigationBasicItemComponent } from '../basic/basic.component';
import { HorizontalNavigationDividerItemComponent } from '../divider/divider.component';

@Component({
    selector: 'horizontal-navigation-branch-item',
    templateUrl: './branch.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, NgClass, CommonModule, MatMenuModule, NgTemplateOutlet, NgFor, HorizontalNavigationBasicItemComponent, RouterModule, forwardRef(() => HorizontalNavigationBranchItemComponent), HorizontalNavigationDividerItemComponent, MatTooltipModule, MatIconModule],
})
export class HorizontalNavigationBranchItemComponent implements OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_child: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() child: boolean = false;
    @Input() item: NavigationItem;
    @Input() name: string;
    @ViewChild('matMenu', { static: true }) matMenu: MatMenu;

    private _horizontalNavigationComponent: HorizontalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _navigationService: NavigationService,
        private _route: ActivatedRoute,
        private _router: Router
    ) {

    }

    private _isItemActive(currentUrl: string): void {
        if (currentUrl.split('/')[2] == this.item.id) {
            this.item.active = true;
        } else {
            this.item.active = false;
        }
    }
    ngOnInit(): void {
        this._horizontalNavigationComponent = this._navigationService.getComponent(this.name);
        const currentUrl = this._router.url;
        this._isItemActive(currentUrl)

        this._router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this._isItemActive(event.url)
            }
        });
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

    triggerChangeDetection(): void {
        this._changeDetectorRef.markForCheck();
    }



    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
