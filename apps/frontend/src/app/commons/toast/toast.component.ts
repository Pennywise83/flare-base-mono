import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ToastMessage } from './toast-message';
import { ToastPosition } from './toast-position.enum';
import { ToastService } from './toast.service';
import { fuseAnimations } from '@fuse/animations';
import { ToastType } from './toast-type.enum';

@Component({
    selector: 'toast-container',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.scss'],
    animations: fuseAnimations

})
export class ToastComponent implements OnInit, OnDestroy {
    @Input()
    public position: ToastPosition;
    public toastTypes = ToastType;
    private _toasterSubject$: Subject<void>;
    public messages: ToastMessage[];

    constructor(private _toastService: ToastService) {
        this.position = ToastPosition.BOTTOM_RIGHT;
        this._toasterSubject$ = new Subject<void>();
        this.messages = [];
    }

    ngOnInit(): void {
        this._toastService.onToastMessage()
            .pipe(takeUntil(this._toasterSubject$))
            .subscribe(message => this._handleToastMessage(message))
    }

    private _handleToastMessage(message: ToastMessage) {
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

     _removeMessage(message: ToastMessage) {
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
