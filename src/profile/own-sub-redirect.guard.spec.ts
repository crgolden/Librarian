import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { ownSubRedirectGuard } from './own-sub-redirect.guard';
import { AuthService } from '../auth/auth.service';

function snapshotWithSub(sub: string | null): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } as unknown as ActivatedRouteSnapshot;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

function run(routeSub: string | null, ownSub: string | null, barePath: string[]): boolean | UrlTree {
  return TestBed.runInInjectionContext(() =>
    ownSubRedirectGuard(barePath)(snapshotWithSub(routeSub), {} as never),
  ) as boolean | UrlTree;
}

describe('ownSubRedirectGuard', () => {
  function configure(ownSub: string | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceWithSub(ownSub) }],
    });
  }

  it('canonicalizes a :sub route to its bare path when :sub is the signed-in user', () => {
    configure('own-sub');

    const result = run('own-sub', 'own-sub', ['/library']);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/library');
  });

  it('allows a :sub route naming a different user through unchanged', () => {
    configure('own-sub');

    expect(run('other-sub', 'own-sub', ['/library'])).toBe(true);
  });

  it('allows a bare route with no :sub through unchanged', () => {
    configure('own-sub');

    expect(run(null, 'own-sub', ['/library'])).toBe(true);
  });

  it('allows the route through when nobody is signed in', () => {
    configure(null);

    expect(run('other-sub', null, ['/library'])).toBe(true);
  });

  it('canonicalizes to a nested bare path', () => {
    configure('own-sub');

    const result = run('own-sub', 'own-sub', ['/profile', 'followers']);

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/profile/followers');
  });
});
