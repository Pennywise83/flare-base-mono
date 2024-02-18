import { Inject, Injectable } from '@angular/core';
import { UI_CONFIG } from './config.constants';
import { merge } from 'lodash-es';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({providedIn: 'root'})
export class ConfigService
{
    private _config: BehaviorSubject<any>;
    constructor(@Inject(UI_CONFIG) config: any)
    {
        this._config = new BehaviorSubject(config);
    }
    set config(value: any)
    {
        const config = merge({}, this._config.getValue(), value);
        this._config.next(config);
    }

    // eslint-disable-next-line @typescript-eslint/member-ordering
    get config$(): Observable<any>
    {
        return this._config.asObservable();
    }

    reset(): void
    {
        this._config.next(this.config);
    }
}
