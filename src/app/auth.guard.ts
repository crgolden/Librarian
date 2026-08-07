import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    globalThis.location.href = `/bff/login?returnTo=${encodeURIComponent(state.url)}`;
  }

  return false;
};
