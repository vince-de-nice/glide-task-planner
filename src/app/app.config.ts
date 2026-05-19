import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { VavTheme } from './config/vav-theme.preset';
import { CupDatabaseService } from './services/cup-database.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    MessageService,
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: VavTheme,
        options: {
          darkModeSelector: false
        }
      }
    }),
    provideRouter(routes),
    provideAppInitializer(() => {
      const db = inject(CupDatabaseService);
      const router = inject(Router);
      return db.bootstrapFromQueryParam(router);
    })
  ]
};
