import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ProfileFollowersComponent } from './profile-followers.component';
import { FollowListResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function activatedRouteWithSub(sub: string | null): ActivatedRoute {
  return { snapshot: { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } } as unknown as ActivatedRoute;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

/** getFollowers() always appends limit/offset query params, so a plain string match against the
 * bare path never matches -- match on the path only, like curator.service.spec.ts's pattern. */
function expectFollowersRequest(httpMock: HttpTestingController, sub: string) {
  return httpMock.expectOne((r) => r.url === `/curator/api/users/${sub}/followers`);
}

describe('ProfileFollowersComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, ownSub: string | null): void {
    TestBed.configureTestingModule({
      imports: [ProfileFollowersComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(routeSub) },
        { provide: AuthService, useValue: authServiceWithSub(ownSub) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('redirects to /profile/followers without fetching when :sub equals the signed-in user\'s own sub', () => {
    configure('own-sub', 'own-sub');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/profile', 'followers'], { replaceUrl: true });
    httpMock.expectNone('/curator/api/users/own-sub/followers');
  });

  it('owner mode fetches followers using the signed-in user\'s own sub', () => {
    configure(null, 'own-sub');
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();
    expectFollowersRequest(httpMock, 'own-sub').flush({ entries: [], total: 0 } satisfies FollowListResponse);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No followers yet.');
  });

  it('viewer mode renders another user\'s followers, each entry linking to /u/{sub}', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();
    expectFollowersRequest(httpMock, 'other-sub').flush({
      entries: [
        { sub: 'follower-1', psn_account_id: 'psn-follower-1', followed_at: '2026-01-01T00:00:00Z' },
        { sub: 'follower-2', psn_account_id: null, followed_at: '2026-01-02T00:00:00Z' },
      ],
      total: 2,
    } satisfies FollowListResponse);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('2 total');
    expect(compiled.textContent).toContain('psn-follower-1');
    expect(compiled.textContent).toContain('Unlinked user');
    expect(compiled.querySelector('a[href="/u/follower-1"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/u/follower-2"]')).not.toBeNull();
  });

  it('lists followers even when the profile is private -- follow lists are always visible', () => {
    // The mock response itself is the contract under test here: this asserts the component simply
    // renders whatever GET /users/{sub}/followers returns, with no client-side is_public gating of
    // its own -- follower/following visibility is a server-side invariant, not a UI decision.
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();
    expectFollowersRequest(httpMock, 'other-sub').flush({
      entries: [{ sub: 'follower-1', psn_account_id: null, followed_at: '2026-01-01T00:00:00Z' }],
      total: 1,
    } satisfies FollowListResponse);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 total');
  });

  it('shows an error message when loading followers fails', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();
    expectFollowersRequest(httpMock, 'other-sub').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load followers.');
  });
});
