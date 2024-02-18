import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ToastMessage } from './toast-message';
import { ToastType } from './toast-type.enum';

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private _defaultDuration: number;
    private _toastMessageSource: Subject<ToastMessage>
    constructor() {
        this._defaultDuration = 5000;
        this._toastMessageSource = new Subject<ToastMessage>();
    }

    public toast(message: string, type: ToastType, duration: number = this._defaultDuration): void {
        this._toastMessageSource.next(new ToastMessage(message, type, duration));
    }

    public success(message: string, duration: number = this._defaultDuration): void {
        this.toast(message, ToastType.SUCCESS, duration);
    }

    public info(message: string, duration: number = this._defaultDuration): void {
        this.toast(message, ToastType.INFO, duration);
    }

    public warning(message: string, duration: number = this._defaultDuration): void {
        this.toast(message, ToastType.WARNING, duration);
    }

    public error(message: string, duration: number = this._defaultDuration): void {
        this.toast(message, ToastType.DANGER, duration);
    }

    public onToastMessage(): Observable<ToastMessage> {
        return this._toastMessageSource.asObservable();
    }
}