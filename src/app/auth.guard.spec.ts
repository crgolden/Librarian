import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';

describe('authGuard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function configure(isAuthenticated: boolean): void {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } }],
    });
  }

  function run(): boolean {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean;
  }

  it('allows navigation when the user is authenticated', () => {
    configure(true);

    expect(run()).toBe(true);
  });

  it('redirects to /bff/login and blocks navigation when the user is anonymous', () => {
    configure(false);
    const location = { href: '' };
    vi.stubGlobal('location', location);

    expect(run()).toBe(false);
    expect(location.href).toBe('/bff/login');
  });
});
