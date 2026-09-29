import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideNgIconsConfig } from '@ng-icons/core';
import { routes } from './app.routes';
import { appInterceptor } from './app.interceptor';
import { ssrAbsoluteUrlInterceptor } from './ssr-absolute-url.interceptor';
import { provideBrowserScrollRestorationWhenLeavingTheDocument } from '@crgolden/modules/angular';
import { AuthService } from '../auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideBrowserScrollRestorationWhenLeavingTheDocument(),
    provideHttpClient(withInterceptors([ssrAbsoluteUrlInterceptor, appInterceptor])),
    provideAppInitializer(() => inject(AuthService).initialize()),
    provideNgIconsConfig({ size: '1.5rem' }),
  ],
};
