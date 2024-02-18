import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { NotificationMessage } from './notification-message';
import { ToastType } from '../toast/toast-type.enum';

@Injectable({
    providedIn: 'root'
})
export class UiNotificationsService {
    private _defaultDuration: number;
    private _NotificationMessageSource: Subject<NotificationMessage>
    constructor() {
        this._defaultDuration = 5000;
        this._NotificationMessageSource = new Subject<NotificationMessage>();
    }

    public toast(title: string, message: string, type: ToastType, duration: number = this._defaultDuration): void {
        this._NotificationMessageSource.next(new NotificationMessage(title, message, type, duration));
    }

    public success(title: string,message: string, duration: number = this._defaultDuration): void {
        this.toast(title, message, ToastType.SUCCESS, duration);
    }

    public info(title: string,message: string, duration: number = this._defaultDuration): void {
        this.toast(title, message, ToastType.INFO, duration);
    }

    public warning(title: string,message: string, duration: number = this._defaultDuration): void {
        this.toast(title, message, ToastType.WARNING, duration);
    }

    public error(title: string,message: string, duration: number = this._defaultDuration): void {
        this.toast(title, message, ToastType.DANGER, duration);
    }

    public onNotificationMessage(): Observable<NotificationMessage> {
        return this._NotificationMessageSource.asObservable();
    }
}