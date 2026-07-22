import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Every guarded route is RenderMode.Client (see app.routes.server.ts) specifically so this
  // guard only ever runs in the browser, where `location` exists and AuthService's client-fetched
  // session state is meaningful. Node has no `location` global — guard against writing to it if a
  // guarded route is ever mistakenly server-rendered again.
  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    globalThis.location.href = `/bff/login?returnTo=${encodeURIComponent(state.url)}`;
  }

  return false;
};
