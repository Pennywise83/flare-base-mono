import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, Provider, importProvidersFrom, inject } from '@angular/core';
import { MATERIAL_SANITY_CHECKS } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { UI_CONFIG } from '../config/config.constants';
import { UiConfig } from '../config/config.types';
import { MediaWatcherService } from '../media-watcher';
import { SplashScreenService } from '../splash-screen';


export type UiProviderConfig = {
    ui?: UiConfig
}

export const provideUi = (config: UiProviderConfig): Array<Provider | EnvironmentProviders> => {
    const providers: Array<Provider | EnvironmentProviders> = [
        {
            provide: MATERIAL_SANITY_CHECKS,
            useValue: {
                doctype: true,
                theme: false,
                version: true,
            },
        },
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'fill',
            },
        },
        {
            provide: UI_CONFIG,
            useValue: config?.ui ?? {},
        },

        importProvidersFrom(MatDialogModule),
        {
            provide: ENVIRONMENT_INITIALIZER,
            useValue: () => inject(MediaWatcherService),
            multi: true,
        },
        {
            provide: ENVIRONMENT_INITIALIZER,
            useValue: () => inject(SplashScreenService),
            multi: true,
        }
    ];

    return providers;
};
