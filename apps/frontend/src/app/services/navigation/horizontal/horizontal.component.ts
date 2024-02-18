import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { ReplaySubject, Subject } from 'rxjs';
import { NavigationService } from '../navigation.service';
import { HorizontalNavigationBasicItemComponent } from './components/basic/basic.component';
import { HorizontalNavigationBranchItemComponent } from './components/branch/branch.component';
import { HorizontalNavigationSpacerItemComponent } from './components/spacer/spacer.component';
import { NavigationItem } from '../navigation';
import { animations } from 'app/commons/animations';

@Component({
    selector: 'horizontal-navigation',
    templateUrl: './horizontal.component.html',
    styleUrls: ['./horizontal.component.scss'],
    animations: animations,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'horizontalNavigation',
    standalone: true,
    imports: [NgFor, NgIf, HorizontalNavigationBasicItemComponent, HorizontalNavigationBranchItemComponent, HorizontalNavigationSpacerItemComponent],
})
export class HorizontalNavigationComponent implements OnChanges, OnInit, OnDestroy {
    @Input() name: string = this._navigationService.randomId();
    @Input() navigation: NavigationItem[];

    onRefreshed: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _navigationService: NavigationService
    ) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Navigation
        if ('navigation' in changes) {
            // Mark for check
            this._changeDetectorRef.markForCheck();
        }
    }

    ngOnInit(): void {
        if (this.name === '') {
            this.name = this._navigationService.randomId();
        }

        this._navigationService.registerComponent(this.name, this);
    }

    ngOnDestroy(): void {
        this._navigationService.deregisterComponent(this.name);
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    refresh(): void {
        this._changeDetectorRef.markForCheck();
        this.onRefreshed.next(true);
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
