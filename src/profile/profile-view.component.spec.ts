import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ProfileViewComponent } from './profile-view.component';
import { PublicProfileResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function activatedRouteWithSub(sub: string | null): ActivatedRoute {
  return { snapshot: { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } } as unknown as ActivatedRoute;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

function profile(overrides: Partial<PublicProfileResponse> = {}): PublicProfileResponse {
  return {
    sub: 'other-sub',
    psn_account_id: null,
    is_public: false,
    viewer_is_owner: false,
    viewer_is_following: false,
    follower_count: 0,
    following_count: 0,
    library_visible: false,
    collections_visible: false,
    trophies: null,
    identity: null,
    ...overrides,
  };
}

describe('ProfileViewComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, ownSub: string | null): void {
    TestBed.configureTestingModule({
      imports: [ProfileViewComponent],
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

  function createAndLoad(response: PublicProfileResponse, url: string): ComponentFixture<ProfileViewComponent> {
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();
    httpMock.expectOne(url).flush(response);
    fixture.detectChanges();
    return fixture;
  }

  it('redirects to /profile without fetching when :sub equals the signed-in user\'s own sub', () => {
    configure('own-sub', 'own-sub');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/profile'], { replaceUrl: true });
    httpMock.expectNone('/curator/api/users/own-sub/profile');
  });

  it('owner mode (bare /profile route) fetches using the signed-in user\'s own sub', () => {
    configure(null, 'own-sub');
    const fixture = createAndLoad(
      profile({ sub: 'own-sub', viewer_is_owner: true, library_visible: true, collections_visible: true }),
      '/curator/api/users/own-sub/profile',
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('button')).toBeNull(); // no Follow/Unfollow button for the owner
    expect(compiled.querySelector('a[href="/library"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/collections"]')).not.toBeNull();
  });

  it('shows "Unlinked user" when psn_account_id is null', () => {
    configure('other-sub', null);
    const fixture = createAndLoad(profile({ psn_account_id: null }), '/curator/api/users/other-sub/profile');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unlinked user');
  });

  it('shows the PSN online id as the heading when identity is available, never the raw account id', () => {
    configure('other-sub', null);
    const fixture = createAndLoad(
      profile({ psn_account_id: 'psn-account-other', identity: { online_id: 'other_gamer' } }),
      '/curator/api/users/other-sub/profile',
    );

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain('other_gamer');
    expect(heading).not.toContain('psn-account-other');
  });

  it('falls back to a generic label (never the raw account id) when linked but identity is unavailable', () => {
    configure('other-sub', null);
    const fixture = createAndLoad(
      profile({ psn_account_id: 'psn-account-other', identity: null }),
      '/curator/api/users/other-sub/profile',
    );

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain('PlayStation account');
    expect(heading).not.toContain('psn-account-other');
  });

  it('uses singular "follower" when the count is exactly 1', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({ follower_count: 1, following_count: 0 }),
      '/curator/api/users/other-sub/profile',
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('1 follower');
    expect(compiled.textContent).not.toContain('1 followers');
    expect(compiled.textContent).toContain('0 following');
  });

  it('viewing another\'s private (default) profile shows only counts, no library/collections/trophies/identity links', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({
        follower_count: 3,
        following_count: 1,
        library_visible: false,
        collections_visible: false,
        trophies: null,
        identity: null,
      }),
      '/curator/api/users/other-sub/profile',
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('3 followers');
    expect(compiled.textContent).toContain('1 following');
    expect(compiled.querySelector('a[href="/library/other-sub"]')).toBeNull();
    expect(compiled.querySelector('a[href="/collections/other-sub"]')).toBeNull();
    expect(compiled.querySelector('.psn-category-card')).toBeNull();
  });

  it('viewing another\'s fully public profile shows library/collections links, trophies, and identity', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({
        psn_account_id: 'psn-account-other',
        is_public: true,
        library_visible: true,
        collections_visible: true,
        trophies: { level: 42, tier: 3, earned: { bronze: 120, silver: 45, gold: 12, platinum: 3 } },
        identity: { online_id: 'other_gamer' },
      }),
      '/curator/api/users/other-sub/profile',
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('a[href="/library/other-sub"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/collections/other-sub"]')).not.toBeNull();
    expect(compiled.textContent).toContain('Level 42');
    expect(compiled.textContent).toContain('180 trophies earned');
    expect(compiled.textContent).toContain('other_gamer');
  });

  it('show_trophies true but the viewer has no PSN link -> no trophies section, no error', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({ is_public: true, trophies: null, identity: null }),
      '/curator/api/users/other-sub/profile',
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.psn-category-card')).toBeNull();
    expect(compiled.querySelector('.text-error')).toBeNull();
  });

  it('shows a Follow button when not owner and not already following', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(profile({ viewer_is_following: false }), '/curator/api/users/other-sub/profile');

    const button = fixture.nativeElement.querySelector('button.btn-primary');
    expect(button?.textContent).toContain('Follow');
  });

  it('shows an Unfollow button when already following', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(profile({ viewer_is_following: true }), '/curator/api/users/other-sub/profile');

    const button = fixture.nativeElement.querySelector('button.btn-ghost');
    expect(button?.textContent).toContain('Unfollow');
  });

  it('follow() posts to the follow endpoint and increments the follower count optimistically', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({ viewer_is_following: false, follower_count: 5 }),
      '/curator/api/users/other-sub/profile',
    );
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-primary')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('6 followers');
    expect(compiled.querySelector('button.btn-ghost')?.textContent).toContain('Unfollow');
  });

  it('unfollow() deletes the follow endpoint and decrements the follower count', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({ viewer_is_following: true, follower_count: 5 }),
      '/curator/api/users/other-sub/profile',
    );
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-ghost')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('4 followers');
  });

  it('shows an error message when follow() fails, without changing the button state', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = createAndLoad(
      profile({ viewer_is_following: false, follower_count: 5 }),
      '/curator/api/users/other-sub/profile',
    );
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-primary')?.click();
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/users/other-sub/follow').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Unable to follow this user.');
    expect(compiled.textContent).toContain('5 followers');
  });

  it('shows an error message when loading the profile fails', () => {
    configure('other-sub', 'viewer-sub');
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/users/other-sub/profile').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this profile.');
  });
});
