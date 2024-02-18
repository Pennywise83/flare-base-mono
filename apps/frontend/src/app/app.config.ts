import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { LuxonDateAdapter } from '@angular/material-luxon-adapter';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideRouter,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { appRoutes } from './app.routes';
import { provideIcons } from './services/icons/icons.provider';
import { provideUi } from './services/ui/ui.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation(),withComponentInputBinding()),
    {
      provide: DateAdapter,
      useClass: LuxonDateAdapter
      ,
    },
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        parse: {
          dateInput: 'D',
        },
        display: {
          dateInput: 'DDD',
          monthYearLabel: 'LLL yyyy',
          dateA11yLabel: 'DD',
          monthYearA11yLabel: 'LLLL yyyy',
        },
      },
    },
    provideIcons(),
    provideUi({
      ui: {
        scheme: 'auto',
        screens: {
          sm: '600px',
          md: '960px',
          lg: '1280px',
          xl: '1440px',
        }
      },
    }),
  ],
};
