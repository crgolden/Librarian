import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';
import { loginUrlReturningTo } from '../shared/bff-contract';
import { AppUrls } from './app-paths';
import { AngularPlatformIds } from '../testing/angular-constants';

describe('authGuard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function configure(
    isAuthenticated: boolean,
    extraProviders: { provide: unknown; useValue: unknown }[] = [],
  ): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        ...extraProviders,
      ],
    });
  }

  function run(url = AppUrls.account): boolean {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean;
  }

  it('allows navigation when the user is authenticated', () => {
    configure(true);

    expect(run()).toBe(true);
  });

  it('redirects to /bff/login with the requested path as returnTo and blocks navigation when the user is anonymous (browser)', () => {
    configure(false);
    const location = { href: '' };
    vi.stubGlobal('location', location);

    expect(run(AppUrls.account)).toBe(false);
    expect(location.href).toBe(loginUrlReturningTo(AppUrls.account));
  });

  it('blocks navigation without touching globalThis.location on the server (defensive — guarded routes are always Client-rendered)', () => {
    configure(false, [{ provide: PLATFORM_ID, useValue: AngularPlatformIds.server }]);
    const location = { href: '' };
    vi.stubGlobal('location', location);

    expect(run(AppUrls.account)).toBe(false);
    expect(location.href).toBe('');
  });
});
