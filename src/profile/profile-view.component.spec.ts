import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileViewComponent } from './profile-view.component';
import { ResolvedProfile } from './profile.resolver';
import { PublicProfileResponse } from '../curator/curator.models';

function activatedRoute(sub: string | null, resolved: ResolvedProfile): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { sub } : {}),
      data: { profile: resolved },
    },
  } as unknown as ActivatedRoute;
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
    created_at: null,
    library_count: null,
    collections_count: null,
    trophies_hidden_by_owner_setting: false,
    profile_links: [],
    ...overrides,
  };
}

function statValue(compiled: HTMLElement, stat: string): string | undefined {
  return compiled.querySelector(`[data-stat="${stat}"] .stat-value`)?.textContent?.trim();
}

describe('ProfileViewComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, resolved: ResolvedProfile): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileViewComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRoute(routeSub, resolved) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(routeSub: string | null, response: PublicProfileResponse): ComponentFixture<ProfileViewComponent> {
    configure(routeSub, { status: 'ok', profile: response });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('owner mode (bare /profile route) renders the resolved profile with no request of its own', () => {
    const fixture = createAndLoad(
      null,
      profile({ sub: 'own-sub', viewer_is_owner: true, library_visible: true, collections_visible: true }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('button')).toBeNull();
    expect(compiled.querySelector('a[href="/library"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/collections"]')).not.toBeNull();
    httpMock.expectNone((r) => r.url.endsWith('/profile'));
  });

  it('shows "Unlinked user" when psn_account_id is null', () => {
    const fixture = createAndLoad('other-sub', profile({ psn_account_id: null }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unlinked user');
  });

  it('shows the PSN online id as the heading when identity is available, never the raw account id', () => {
    const fixture = createAndLoad(
      'other-sub',
      profile({ psn_account_id: 'psn-account-other', identity: { online_id: 'other_gamer' } }),
    );

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain('other_gamer');
    expect(heading).not.toContain('psn-account-other');
  });

  it('falls back to a generic label (never the raw account id) when linked but identity is unavailable', () => {
    const fixture = createAndLoad('other-sub', profile({ psn_account_id: 'psn-account-other', identity: null }));

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain('PlayStation account');
    expect(heading).not.toContain('psn-account-other');
  });

  it('uses singular "follower" in the tile\'s accessible name when the count is exactly 1', () => {
    const fixture = createAndLoad('other-sub', profile({ follower_count: 1, following_count: 0 }));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-stat="followers"]')?.getAttribute('aria-label')).toBe('1 follower');
    expect(compiled.querySelector('[data-stat="following"]')?.getAttribute('aria-label')).toBe('0 following');
    expect(statValue(compiled, 'followers')).toBe('1');
    expect(statValue(compiled, 'following')).toBe('0');
  });

  it('renders a zero count rather than hiding the tile', () => {
    const fixture = createAndLoad(
      'own-sub',
      profile({ viewer_is_owner: true, library_count: 0, collections_count: 0 }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(statValue(compiled, 'library')).toBe('0');
    expect(statValue(compiled, 'collections')).toBe('0');
  });

  it('omits the count tiles entirely when the counts are not permitted', () => {
    const fixture = createAndLoad('other-sub', profile({ library_count: null, collections_count: null }));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-stat="library"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="collections"]')).toBeNull();
  });

  it('renders each declared profile link with the URL Curator built and no referrer leakage', () => {
    const fixture = createAndLoad(
      'other-sub',
      profile({
        profile_links: [
          {
            site_key: 'psnprofiles',
            display_name: 'PSNProfiles',
            handle: 'curator_one',
            url: 'https://psnprofiles.com/curator_one',
          },
          {
            site_key: 'exophase',
            display_name: 'Exophase',
            handle: 'curator_one',
            url: 'https://www.exophase.com/psn/user/curator_one/',
          },
        ],
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    const anchors = compiled.querySelectorAll<HTMLAnchorElement>('[data-stat="profile-links"] a');
    expect(anchors).toHaveLength(2);
    expect(anchors[0]?.getAttribute('href')).toBe('https://psnprofiles.com/curator_one');
    expect(anchors[0]?.textContent?.trim()).toBe('PSNProfiles');
    expect(anchors[1]?.getAttribute('href')).toBe('https://www.exophase.com/psn/user/curator_one/');
    for (const anchor of anchors) {
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer nofollow ugc');
      expect(anchor.getAttribute('target')).toBe('_blank');
    }
  });

  it('omits the profile-links tile when the viewer is given no links', () => {
    const fixture = createAndLoad('other-sub', profile({ profile_links: [] }));

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-stat="profile-links"]')).toBeNull();
  });

  it('viewing another\'s private (default) profile shows only counts, no library/collections/trophies/identity links', () => {
    const fixture = createAndLoad(
      'other-sub',
      profile({
        follower_count: 3,
        following_count: 1,
        library_visible: false,
        collections_visible: false,
        trophies: null,
        identity: null,
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(statValue(compiled, 'followers')).toBe('3');
    expect(statValue(compiled, 'following')).toBe('1');
    expect(compiled.querySelector('a[href="/library/other-sub"]')).toBeNull();
    expect(compiled.querySelector('a[href="/collections/other-sub"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="trophy-level"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="trophies-earned"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="profile-links"]')).toBeNull();
  });

  it('viewing another\'s fully public profile shows library/collections links, trophies, and identity', () => {
    const fixture = createAndLoad(
      'other-sub',
      profile({
        psn_account_id: 'psn-account-other',
        is_public: true,
        library_visible: true,
        collections_visible: true,
        trophies: { level: 42, tier: 3, earned: { bronze: 120, silver: 45, gold: 12, platinum: 3 } },
        identity: { online_id: 'other_gamer' },
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('a[href="/library/other-sub"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/collections/other-sub"]')).not.toBeNull();
    expect(statValue(compiled, 'trophy-level')).toBe('42');
    expect(compiled.querySelector('[data-stat="trophy-level"] .catalog-meta')?.textContent).toContain('Tier 3');
    expect(statValue(compiled, 'trophies-earned')).toBe('180');
    expect(compiled.textContent).toContain('other_gamer');
  });

  it('show_trophies true but the viewer has no PSN link -> no trophy tiles, no error', () => {
    const fixture = createAndLoad('other-sub', profile({ is_public: true, trophies: null, identity: null }));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-stat="trophy-level"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="trophies-earned"]')).toBeNull();
    expect(compiled.querySelector('.text-error')).toBeNull();
  });

  it('tells the owner their own toggle is why trophies are blank, and links them to it', () => {
    const fixture = createAndLoad(
      null,
      profile({ viewer_is_owner: true, trophies: null, trophies_hidden_by_owner_setting: true }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    const tile = compiled.querySelector('[data-stat="trophies-off"]');
    expect(tile).not.toBeNull();
    expect(tile?.textContent).toContain('switched off');
    expect(tile?.querySelector('a[href="/psn"]')).not.toBeNull();
  });

  it('says nothing about why trophies are blank when the flag is false', () => {
    const fixture = createAndLoad('other-sub', profile({ trophies: null, trophies_hidden_by_owner_setting: false }));

    expect(fixture.nativeElement.querySelector('[data-stat="trophies-off"]')).toBeNull();
  });

  it('shows a Follow button when not owner and not already following', () => {
    const fixture = createAndLoad('other-sub', profile({ viewer_is_following: false }));

    const button = fixture.nativeElement.querySelector('button.btn-primary');
    expect(button?.textContent).toContain('Follow');
  });

  it('shows an Unfollow button when already following', () => {
    const fixture = createAndLoad('other-sub', profile({ viewer_is_following: true }));

    const button = fixture.nativeElement.querySelector('button.btn-ghost');
    expect(button?.textContent).toContain('Unfollow');
  });

  it('follow() posts to the follow endpoint and increments the follower count optimistically', () => {
    const fixture = createAndLoad('other-sub', profile({ viewer_is_following: false, follower_count: 5 }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-primary')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(statValue(compiled, 'followers')).toBe('6');
    expect(compiled.querySelector('button.btn-ghost')?.textContent).toContain('Unfollow');
  });

  it('unfollow() deletes the follow endpoint and decrements the follower count', () => {
    const fixture = createAndLoad('other-sub', profile({ viewer_is_following: true, follower_count: 5 }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-ghost')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(statValue(compiled, 'followers')).toBe('4');
  });

  it('shows an error message when follow() fails, without changing the button state', () => {
    const fixture = createAndLoad('other-sub', profile({ viewer_is_following: false, follower_count: 5 }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('button.btn-primary')?.click();
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/users/other-sub/follow').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Unable to follow this user.');
    expect(statValue(compiled, 'followers')).toBe('5');
  });

  it('shows an error message when the resolver could not load the profile', () => {
    configure('other-sub', { status: 'error' });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this profile.');
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: 'no-user' });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to determine the signed-in user.');
  });
});
