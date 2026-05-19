import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TranslateService } from './i18n/translate.service';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { GcTheme } from './config/gc-theme.preset';
import { CupDatabaseService } from './services/cup-database.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    MessageService,
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: GcTheme,
        options: {
          darkModeSelector: false
        }
      }
    }),
    provideRouter(routes),
    provideAppInitializer(() => {
      const i18n = inject(TranslateService);
      document.documentElement.lang = i18n.locale();
      const db = inject(CupDatabaseService);
      const router = inject(Router);
      return db.bootstrapFromQueryParam(router);
    })
  ]
};
