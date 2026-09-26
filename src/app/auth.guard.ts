import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { loginUrlReturningTo } from '../shared/bff-contract';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    globalThis.location.href = loginUrlReturningTo(state.url);
  }

  return false;
};
