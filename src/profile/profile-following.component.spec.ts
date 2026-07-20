import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ProfileFollowingComponent } from './profile-following.component';
import { FollowListResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function activatedRouteWithSub(sub: string | null): ActivatedRoute {
  return { snapshot: { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } } as unknown as ActivatedRoute;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

/** getFollowing() always appends limit/offset query params, so a plain string match against the
 * bare path never matches -- match on the path only, like curator.service.spec.ts's pattern. */
function expectFollowingRequest(httpMock: HttpTestingController, sub: string) {
  return httpMock.expectOne((r) => r.url === `/curator/api/users/${sub}/following`);
}

describe('ProfileFollowingComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, ownSub: string | null): void {
    TestBed.configureTestingModule({
      imports: [ProfileFollowingComponent],
      providers: [
        provideHttpClient(),
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

  it('redirects to /profile/following without fetching when :sub equals the signed-in user\'s own sub', () => {
    configure('own-sub', 'own-sub');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/profile', 'following'], { replaceUrl: true });
    httpMock.expectNone('/curator/api/users/own-sub/following');
  });

  it('owner mode fetches following using the signed-in user\'s own sub', () => {
    configure(null, 'own-sub');
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();
    expectFollowingRequest(httpMock, 'own-sub').flush({ entries: [], total: 0 } satisfies FollowListResponse);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not following anyone yet.');
  });

  it('viewer mode renders another user\'s following list, each entry linking to /u/{sub}', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();
    expectFollowingRequest(httpMock, 'other-sub').flush({
      entries: [{ sub: 'followed-1', psn_account_id: 'psn-followed-1', followed_at: '2026-01-01T00:00:00Z' }],
      total: 1,
    } satisfies FollowListResponse);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('1 total');
    expect(compiled.textContent).toContain('psn-followed-1');
    expect(compiled.querySelector('a[href="/u/followed-1"]')).not.toBeNull();
  });

  it('shows an error message when loading following fails', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();
    expectFollowingRequest(httpMock, 'other-sub').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load following.');
  });
});
