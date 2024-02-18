import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationMessage } from './notification-message';
import { UiNotificationsService } from './ui-notifications.service';
import { animations } from '../animations';
import { ToastPosition } from '../toast/toast-position.enum';
import { ToastType } from '../toast/toast-type.enum';


@Component({
    selector: 'toast-container',
    templateUrl: './ui-notifications.component.html',
    styleUrls: ['./ui-notifications.component.scss'],
    animations: animations

})
export class UiNotificationsComponent implements OnInit, OnDestroy {
    @Input()
    public position: ToastPosition;
    public toastTypes = ToastType;
    private _toasterSubject$: Subject<void>;
    public messages: NotificationMessage[];

    constructor(private _uiNotificationsService: UiNotificationsService) {
        this.position = ToastPosition.BOTTOM_RIGHT;
        this._toasterSubject$ = new Subject<void>();
        this.messages = [];
    }

    ngOnInit(): void {
        this._uiNotificationsService.onNotificationMessage()
            .pipe(takeUntil(this._toasterSubject$))
            .subscribe(message => this._handleToastMessage(message))
    }

    private _handleToastMessage(message: NotificationMessage) {
        if (this._isToasterPositionTop()) {
            this.messages.unshift(message);
        } else {
            this.messages.push(message);
        }
        setTimeout(() => this._removeMessage(message), message.duration);
    }

    private _isToasterPositionTop() {
        return this.position === ToastPosition.TOP_LEFT ||
            this.position === ToastPosition.TOP_CENTER ||
            this.position === ToastPosition.TOP_RIGHT;
    }

    _removeMessage(message: NotificationMessage) {
        const index: number = this.messages.findIndex(e => e.id === message.id);
        if (index > -1) {
            this.messages.splice(index, 1);
        }
    }

    ngOnDestroy(): void {
        this._toasterSubject$.next();
        this._toasterSubject$.complete();
    }
}
