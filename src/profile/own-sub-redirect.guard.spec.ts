import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { ownSubRedirectGuard } from './own-sub-redirect.guard';
import { AuthService } from '../auth/auth.service';
import { AppUrls, FollowListKinds, RouteParams } from '../app/app-paths';
import { newId } from '@crgolden/modules/testing';

const OWN_SUB = newId();
const OTHER_SUB = newId();

function snapshotWithSub(sub: string | null): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap(sub !== null ? { [RouteParams.sub]: sub } : {}) } as unknown as ActivatedRouteSnapshot;
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
    configure(OWN_SUB);

    const result = run(OWN_SUB, OWN_SUB, [AppUrls.library]);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(AppUrls.library);
  });

  it('allows a :sub route naming a different user through unchanged', () => {
    configure(OWN_SUB);

    expect(run(OTHER_SUB, OWN_SUB, [AppUrls.library])).toBe(true);
  });

  it('allows a bare route with no :sub through unchanged', () => {
    configure(OWN_SUB);

    expect(run(null, OWN_SUB, [AppUrls.library])).toBe(true);
  });

  it('allows the route through when nobody is signed in', () => {
    configure(null);

    expect(run(OTHER_SUB, null, [AppUrls.library])).toBe(true);
  });

  it('canonicalizes to a nested bare path', () => {
    configure(OWN_SUB);

    const result = run(OWN_SUB, OWN_SUB, [AppUrls.profile, FollowListKinds.followers]);

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(AppUrls.profileFollowers);
  });
});
