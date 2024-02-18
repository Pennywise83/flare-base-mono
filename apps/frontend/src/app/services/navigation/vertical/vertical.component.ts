import { animate, AnimationBuilder, AnimationPlayer, style } from '@angular/animations';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ScrollStrategy, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { DOCUMENT, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, HostListener, Inject, Input, OnChanges, OnDestroy, OnInit, Output, QueryList, Renderer2, SimpleChanges, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { animations } from 'app/commons/animations';
import { ScrollbarDirective } from 'app/commons/directives/scrollbar';
import { delay, filter, merge, ReplaySubject, Subject, Subscription, takeUntil } from 'rxjs';
import { NavigationItem, VerticalNavigationAppearance, VerticalNavigationMode, VerticalNavigationPosition } from '../navigation';
import { NavigationService } from '../navigation.service';
import { VerticalNavigationAsideItemComponent } from './components/aside/aside.component';
import { VerticalNavigationBasicItemComponent } from './components/basic/basic.component';
import { VerticalNavigationCollapsableItemComponent } from './components/collapsable/collapsable.component';
import { VerticalNavigationDividerItemComponent } from './components/divider/divider.component';
import { VerticalNavigationGroupItemComponent } from './components/group/group.component';
import { VerticalNavigationSpacerItemComponent } from './components/spacer/spacer.component';

@Component({
    selector: 'vertical-navigation',
    templateUrl: './vertical.component.html',
    styleUrls: ['./vertical.component.scss'],
    animations: animations,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'verticalNavigation',
    standalone: true,
    imports: [ScrollbarDirective, NgFor, NgIf, VerticalNavigationAsideItemComponent, VerticalNavigationBasicItemComponent, VerticalNavigationCollapsableItemComponent, VerticalNavigationDividerItemComponent, VerticalNavigationGroupItemComponent, VerticalNavigationSpacerItemComponent],
})
export class VerticalNavigationComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_inner: BooleanInput;
    static ngAcceptInputType_opened: BooleanInput;
    static ngAcceptInputType_transparentOverlay: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() appearance: VerticalNavigationAppearance = 'default';
    @Input() autoCollapse: boolean = true;
    @Input() inner: boolean = false;
    @Input() mode: VerticalNavigationMode = 'side';
    @Input() name: string = this._navigationService.randomId();
    @Input() navigation: NavigationItem[];
    @Input() opened: boolean = true;
    @Input() position: VerticalNavigationPosition = 'left';
    @Input() transparentOverlay: boolean = false;
    @Output() readonly appearanceChanged: EventEmitter<VerticalNavigationAppearance> = new EventEmitter<VerticalNavigationAppearance>();
    @Output() readonly modeChanged: EventEmitter<VerticalNavigationMode> = new EventEmitter<VerticalNavigationMode>();
    @Output() readonly openedChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
    @Output() readonly positionChanged: EventEmitter<VerticalNavigationPosition> = new EventEmitter<VerticalNavigationPosition>();
    @ViewChild('navigationContent') private _navigationContentEl: ElementRef;

    activeAsideItemId: string | null = null;
    onCollapsableItemCollapsed: ReplaySubject<NavigationItem> = new ReplaySubject<NavigationItem>(1);
    onCollapsableItemExpanded: ReplaySubject<NavigationItem> = new ReplaySubject<NavigationItem>(1);
    onRefreshed: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
    private _animationsEnabled: boolean = false;
    private _asideOverlay: HTMLElement;
    private readonly _handleAsideOverlayClick: any;
    private readonly _handleOverlayClick: any;
    private _hovered: boolean = false;
    private _mutationObserver: MutationObserver;
    private _overlay: HTMLElement;
    private _player: AnimationPlayer;
    private _scrollStrategy: ScrollStrategy = this._scrollStrategyOptions.block();
    private _scrollbarDirectives!: QueryList<ScrollbarDirective>;
    private _scrollbarDirectivesSubscription: Subscription;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _animationBuilder: AnimationBuilder,
        private _changeDetectorRef: ChangeDetectorRef,
        @Inject(DOCUMENT) private _document: Document,
        private _elementRef: ElementRef,
        private _renderer2: Renderer2,
        private _router: Router,
        private _scrollStrategyOptions: ScrollStrategyOptions,
        private _navigationService: NavigationService
    ) {
        this._handleAsideOverlayClick = (): void => {
            this.closeAside();
        };
        this._handleOverlayClick = (): void => {
            this.close();
        };
    }

    @HostBinding('class') get classList(): any {
        /* eslint-disable @typescript-eslint/naming-convention */
        return {
            'vertical-navigation-animations-enabled': this._animationsEnabled,
            [`vertical-navigation-appearance-${this.appearance}`]: true,
            'vertical-navigation-hover': this._hovered,
            'vertical-navigation-inner': this.inner,
            'vertical-navigation-mode-over': this.mode === 'over',
            'vertical-navigation-mode-side': this.mode === 'side',
            'vertical-navigation-opened': this.opened,
            'vertical-navigation-position-left': this.position === 'left',
            'vertical-navigation-position-right': this.position === 'right',
        };
        /* eslint-enable @typescript-eslint/naming-convention */
    }
    @HostBinding('style') get styleList(): any {
        return {
            'visibility': this.opened ? 'visible' : 'hidden',
        };
    }

    @ViewChildren(ScrollbarDirective)
    set scrollbarDirectives(scrollbarDirectives: QueryList<ScrollbarDirective>) {
        this._scrollbarDirectives = scrollbarDirectives;
        if (scrollbarDirectives.length === 0) {
            return;
        }
        if (this._scrollbarDirectivesSubscription) {
            this._scrollbarDirectivesSubscription.unsubscribe();
        }
        this._scrollbarDirectivesSubscription =
            merge(
                this.onCollapsableItemCollapsed,
                this.onCollapsableItemExpanded,
            )
                .pipe(
                    takeUntil(this._unsubscribeAll),
                    delay(250),
                )
                .subscribe(() => {
                    scrollbarDirectives.forEach((scrollbarDirective) => {
                        scrollbarDirective.update();
                    });
                });
    }

    @HostListener('mouseenter')
    private _onMouseenter(): void {
        this._enableAnimations();
        this._hovered = true;
    }

    @HostListener('mouseleave')
    private _onMouseleave(): void {
        this._enableAnimations();
        this._hovered = false;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('appearance' in changes) {
            this.appearanceChanged.next(changes.appearance.currentValue);
        }
        if ('inner' in changes) {
            this.inner = coerceBooleanProperty(changes.inner.currentValue);
        }
        if ('mode' in changes) {
            const currentMode = changes.mode.currentValue;
            const previousMode = changes.mode.previousValue;
            this._disableAnimations();
            if (previousMode === 'over' && currentMode === 'side') {
                this._hideOverlay();
            }
            if (previousMode === 'side' && currentMode === 'over') {
                this.closeAside();
                if (this.opened) {
                    this._showOverlay();
                }
            }
            this.modeChanged.next(currentMode);
            setTimeout(() => {
                this._enableAnimations();
            }, 500);
        }

        if ('navigation' in changes) {
            this._changeDetectorRef.markForCheck();
        }
        if ('opened' in changes) {
            this.opened = coerceBooleanProperty(changes.opened.currentValue);
            this._toggleOpened(this.opened);
        }

        if ('position' in changes) {
            this.positionChanged.next(changes.position.currentValue);
        }

        if ('transparentOverlay' in changes) {
            this.transparentOverlay = coerceBooleanProperty(changes.transparentOverlay.currentValue);
        }
    }

    ngOnInit(): void {
        if (this.name === '') {
            this.name = this._navigationService.randomId();
        }

        this._navigationService.registerComponent(this.name, this);

        // Subscribe to the 'NavigationEnd' event
        this._router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                takeUntil(this._unsubscribeAll),
            )
            .subscribe(() => {
                // If the mode is 'over' and the navigation is opened...
                if (this.mode === 'over' && this.opened) {
                    // Close the navigation
                    this.close();
                }

                // If the mode is 'side' and the aside is active...
                if (this.mode === 'side' && this.activeAsideItemId) {
                    // Close the aside
                    this.closeAside();
                }
            });
    }

    /**
     * After view init
     */
    ngAfterViewInit(): void {
        // Fix for Firefox.
        //
        // Because 'position: sticky' doesn't work correctly inside a 'position: fixed' parent,
        // adding the '.cdk-global-scrollblock' to the html element breaks the navigation's position.
        // This fixes the problem by reading the 'top' value from the html element and adding it as a
        // 'marginTop' to the navigation itself.
        this._mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const mutationTarget = mutation.target as HTMLElement;
                if (mutation.attributeName === 'class') {
                    if (mutationTarget.classList.contains('cdk-global-scrollblock')) {
                        const top = parseInt(mutationTarget.style.top, 10);
                        this._renderer2.setStyle(this._elementRef.nativeElement, 'margin-top', `${Math.abs(top)}px`);
                    }
                    else {
                        this._renderer2.setStyle(this._elementRef.nativeElement, 'margin-top', null);
                    }
                }
            });
        });
        this._mutationObserver.observe(this._document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        setTimeout(() => {
            // Return if 'navigation content' element does not exist
            if (!this._navigationContentEl) {
                return;
            }

            // If 'navigation content' element doesn't have
            // perfect scrollbar activated on it...
            if (!this._navigationContentEl.nativeElement.classList.contains('ps')) {
                // Find the active item
                const activeItem = this._navigationContentEl.nativeElement.querySelector('.vertical-navigation-item-active');

                // If the active item exists, scroll it into view
                if (activeItem) {
                    activeItem.scrollIntoView();
                }
            }
            // Otherwise
            else {
                // Go through all the scrollbar directives
                this._scrollbarDirectives.forEach((scrollbarDirective) => {
                    // Skip if not enabled
                    if (!scrollbarDirective.isEnabled()) {
                        return;
                    }

                    // Scroll to the active element
                    scrollbarDirective.scrollToElement('.vertical-navigation-item-active', -120, true);
                });
            }
        });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        this._mutationObserver.disconnect();
        this.close();
        this.closeAside();
        this._navigationService.deregisterComponent(this.name);
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    refresh(): void {
        this._changeDetectorRef.markForCheck();
        this.onRefreshed.next(true);
    }

    open(): void {
        if (this.opened) {
            return;
        }
        this._toggleOpened(true);
    }

    close(): void {
        if (!this.opened) {
            return;
        }
        this.closeAside();
        this._toggleOpened(false);
    }
    toggle(): void {
        if (this.opened) {
            this.close();
        }
        else {
            this.open();
        }
    }

    openAside(item: NavigationItem): void {
        if (item.disabled || !item.id) {
            return;
        }

        this.activeAsideItemId = item.id;
        this._showAsideOverlay();
        this._changeDetectorRef.markForCheck();
    }

    closeAside(): void {
        this.activeAsideItemId = null;
        this._hideAsideOverlay();
        this._changeDetectorRef.markForCheck();
    }
    toggleAside(item: NavigationItem): void {
        if (this.activeAsideItemId === item.id) {
            this.closeAside();
        }
        else {
            this.openAside(item);
        }
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    private _enableAnimations(): void {
        if (this._animationsEnabled) {
            return;
        }
        this._animationsEnabled = true;
    }

    private _disableAnimations(): void {
        if (!this._animationsEnabled) {
            return;
        }
        this._animationsEnabled = false;
    }

    private _showOverlay(): void {
        if (this._asideOverlay) {
            return;
        }
        this._overlay = this._renderer2.createElement('div');
        this._overlay.classList.add('vertical-navigation-overlay');
        if (this.transparentOverlay) {
            this._overlay.classList.add('vertical-navigation-overlay-transparent');
        }
        this._renderer2.appendChild(this._elementRef.nativeElement.parentElement, this._overlay);
        this._scrollStrategy.enable();
        this._player = this._animationBuilder.build([
            animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ opacity: 1 })),
        ]).create(this._overlay);
        this._player.play();
        this._overlay.addEventListener('click', this._handleOverlayClick);
    }

    private _hideOverlay(): void {
        if (!this._overlay) {
            return;
        }
        this._player = this._animationBuilder.build([
            animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ opacity: 0 })),
        ]).create(this._overlay);

        this._player.play();
        this._player.onDone(() => {
            if (this._overlay) {
                this._overlay.removeEventListener('click', this._handleOverlayClick);
                this._overlay.parentNode.removeChild(this._overlay);
                this._overlay = null;
            }
            this._scrollStrategy.disable();
        });
    }

    private _showAsideOverlay(): void {
        if (this._asideOverlay) {
            return;
        }

        this._asideOverlay = this._renderer2.createElement('div');
        this._asideOverlay.classList.add('vertical-navigation-aside-overlay');
        this._renderer2.appendChild(this._elementRef.nativeElement.parentElement, this._asideOverlay);
        this._player =
            this._animationBuilder
                .build([
                    animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ opacity: 1 })),
                ]).create(this._asideOverlay);
        this._player.play();
        this._asideOverlay.addEventListener('click', this._handleAsideOverlayClick);
    }
    private _hideAsideOverlay(): void {
        if (!this._asideOverlay) {
            return;
        }
        this._player =
            this._animationBuilder
                .build([
                    animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ opacity: 0 })),
                ]).create(this._asideOverlay);

        this._player.play();
        this._player.onDone(() => {
            if (this._asideOverlay) {
                this._asideOverlay.removeEventListener('click', this._handleAsideOverlayClick);
                this._asideOverlay.parentNode.removeChild(this._asideOverlay);
                this._asideOverlay = null;
            }
        });
    }

    private _toggleOpened(open: boolean): void {
        this.opened = open;
        this._enableAnimations();
        if (this.mode === 'over') {
            if (this.opened) {
                this._showOverlay();
            }
            else {
                this._hideOverlay();
            }
        }
        this.openedChanged.next(open);
    }
}
