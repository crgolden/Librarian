import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ProfileViewComponent } from './profile-view.component';
import { ResolvedProfile } from './profile.resolver';
import { PsnPreferencesResponse, PublicProfileResponse } from '../curator/curator.models';
import { CuratorApi } from '../curator/curator-api';
import { BffPaths } from '../shared/bff-contract';
import { AppUrls, RouteDataKeys, RouteParams, userCollectionsUrl, userLibraryUrl } from '../app/app-paths';
import {
  FOLLOW_USER_ERROR,
  FRIEND_REQUEST_ERROR,
  PROFILE_LOAD_ERROR,
  PSN_ACCOUNT_FALLBACK_NAME,
  SIGNED_IN_USER_UNKNOWN_ERROR,
  TROPHIES_OFF_NOTICE,
  UNLINKED_USER_NAME,
  StatTileCaptions,
} from './profile.messages';
import { HtmlLinkTargets, LinkRelTokens } from '../testing/html-constants';
import { HttpMethods } from '../bff/http-headers';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newCount, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const OTHER_SUB = newId();
const OWN_SUB = newId();
const PSN_ACCOUNT_ID = newId();
const ONLINE_ID = newText();
const FOLLOWER_COUNT = newCount();
const FOLLOWING_COUNT = newCount();

function activatedRoute(sub: string | null, resolved: ResolvedProfile): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { [RouteParams.sub]: sub } : {}),
      data: { [RouteDataKeys.profile]: resolved },
    },
  } as unknown as ActivatedRoute;
}

function profile(overrides: Partial<PublicProfileResponse> = {}): PublicProfileResponse {
  return {
    sub: OTHER_SUB,
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

function viewerPreferences(overrides: Partial<PsnPreferencesResponse> = {}): PsnPreferencesResponse {
  return {
    harvest_trophies: false,
    harvest_identity: true,
    harvest_presence: false,
    harvest_devices: false,
    allow_friend_writes: false,
    allow_chat_writes: false,
    ...overrides,
  };
}

function statValue(compiled: HTMLElement, statId: string): string | undefined {
  return compiled.querySelector(`${statId}-value`)?.textContent?.trim();
}

describe('ProfileViewComponent', () => {
  let httpMock: HttpTestingController;

  function configure(
    routeSub: string | null,
    resolved: ResolvedProfile,
    picture: string | null = null,
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileViewComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRoute(routeSub, resolved) },
        { provide: AuthService, useValue: { picture: signal(picture) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(
    routeSub: string | null,
    response: PublicProfileResponse,
    prefs: PsnPreferencesResponse | null = null,
  ): ComponentFixture<ProfileViewComponent> {
    configure(routeSub, { status: ResolvedStatuses.ok, profile: response, viewerPreferences: prefs });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('owner mode (bare /profile route) renders the resolved profile with no request of its own', () => {
    const fixture = createAndLoad(
      null,
      profile({ sub: OWN_SUB, viewer_is_owner: true, library_visible: true, collections_visible: true }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('button')).toBeNull();
    expect(compiled.querySelector(`a[href="${AppUrls.library}"]`)).not.toBeNull();
    expect(compiled.querySelector(`a[href="${AppUrls.collections}"]`)).not.toBeNull();
    httpMock.expectNone(() => true);
  });

  it('resolves the header avatar through the BFF by sub, so no picture claim is needed for another user', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ sub: OTHER_SUB }));

    const image = (fixture.nativeElement as HTMLElement).querySelector('#profile-avatar img');
    expect(image?.getAttribute('src')).toBe(BffPaths.avatar(OTHER_SUB));
  });

  function createWithPictureClaim(
    routeSub: string | null,
    response: PublicProfileResponse,
    picture: string | null,
  ): ComponentFixture<ProfileViewComponent> {
    configure(routeSub, { status: ResolvedStatuses.ok, profile: response, viewerPreferences: null }, picture);
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();
    return fixture;
  }

  const ownPicture = newHttpsAddress();

  it('reuses the picture claim on your own profile, so the nav avatar is already cached', () => {
    const fixture = createWithPictureClaim(
      null,
      profile({ sub: OWN_SUB, viewer_is_owner: true }),
      ownPicture,
    );

    const image = (fixture.nativeElement as HTMLElement).querySelector('#profile-avatar img');

    expect(
      image?.getAttribute('src'),
      'the owner avatar must be the same URL the nav requests, or the browser refetches it via a 3-hop redirect',
    ).toBe(ownPicture);
  });

  it("never lends the viewer's own picture claim to another user's profile", () => {
    const fixture = createWithPictureClaim(OTHER_SUB, profile({ sub: OTHER_SUB }), ownPicture);

    const image = (fixture.nativeElement as HTMLElement).querySelector('#profile-avatar img');

    expect(
      image?.getAttribute('src'),
      'a viewer holding a picture claim must not have it painted onto someone else’s profile',
    ).toBe(BffPaths.avatar(OTHER_SUB));
  });

  it('falls back to the BFF on your own profile when the account carries no picture claim', () => {
    const fixture = createWithPictureClaim(null, profile({ sub: OWN_SUB, viewer_is_owner: true }), null);

    const image = (fixture.nativeElement as HTMLElement).querySelector('#profile-avatar img');

    expect(image?.getAttribute('src')).toBe(BffPaths.avatar(OWN_SUB));
  });

  it('shows UNLINKED_USER_NAME when psn_account_id is null', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ psn_account_id: null }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(UNLINKED_USER_NAME);
  });

  it('shows the PSN online id as the heading when identity is available, never the raw account id', () => {
    const fixture = createAndLoad(
      OTHER_SUB,
      profile({ psn_account_id: PSN_ACCOUNT_ID, identity: { online_id: ONLINE_ID } }),
    );

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain(ONLINE_ID);
    expect(heading).not.toContain(PSN_ACCOUNT_ID);
  });

  it('falls back to a generic label (never the raw account id) when linked but identity is unavailable', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ psn_account_id: PSN_ACCOUNT_ID, identity: null }));

    const heading = fixture.nativeElement.querySelector('h1')?.textContent;
    expect(heading).toContain(PSN_ACCOUNT_FALLBACK_NAME);
    expect(heading).not.toContain(PSN_ACCOUNT_ID);
  });

  it('opens each navigating tile\'s accessible name with its visible caption, then its figure', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ follower_count: FOLLOWER_COUNT, following_count: FOLLOWING_COUNT }));

    const compiled: HTMLElement = fixture.nativeElement;
    const followersCaption = compiled.querySelector('#profile-stat-followers-caption')?.textContent?.trim();
    const followingCaption = compiled.querySelector('#profile-stat-following-caption')?.textContent?.trim();
    expect(followersCaption).toBe(StatTileCaptions.followers);
    expect(followingCaption).toBe(StatTileCaptions.following);
    expect(compiled.querySelector('[data-stat="followers"]')?.getAttribute('aria-label')).toBe(`${followersCaption} ${FOLLOWER_COUNT}`);
    expect(compiled.querySelector('[data-stat="following"]')?.getAttribute('aria-label')).toBe(`${followingCaption} ${FOLLOWING_COUNT}`);
  });

  it('renders a zero count rather than hiding the tile', () => {
    const fixture = createAndLoad(
      OWN_SUB,
      profile({ viewer_is_owner: true, library_count: 0, collections_count: 0 }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(statValue(compiled, '#profile-stat-library')).toBe('0');
    expect(statValue(compiled, '#profile-stat-collections')).toBe('0');
  });

  it('omits the count tiles entirely when the counts are not permitted', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ library_count: null, collections_count: null }));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-stat="library"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="collections"]')).toBeNull();
  });

  it('renders each declared profile link with the URL Curator built and no referrer leakage', () => {
    const links = [
      { site_key: newId(), display_name: newText(), handle: newText(), url: newHttpsAddress() },
      { site_key: newId(), display_name: newText(), handle: newText(), url: newHttpsAddress() },
    ];
    const fixture = createAndLoad(
      OTHER_SUB,
      profile({
        profile_links: links,
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    const anchors = compiled.querySelectorAll<HTMLAnchorElement>('[data-stat="profile-links"] a');
    expect(anchors).toHaveLength(links.length);
    expect(anchors[0]?.getAttribute('href')).toBe(links[0].url);
    expect(anchors[0]?.textContent?.trim()).toBe(links[0].display_name);
    expect(anchors[1]?.getAttribute('href')).toBe(links[1].url);
    const externalLinkRel = [
      LinkRelTokens.noopener,
      LinkRelTokens.noreferrer,
      LinkRelTokens.nofollow,
      LinkRelTokens.ugc,
    ].join(' ');
    expect(Array.from(anchors).map((anchor) => anchor.getAttribute('rel'))).toEqual(links.map(() => externalLinkRel));
    expect(Array.from(anchors).map((anchor) => anchor.getAttribute('target'))).toEqual(
      links.map(() => HtmlLinkTargets.blank),
    );
  });

  it('omits the profile-links tile when the viewer is given no links', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ profile_links: [] }));

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-stat="profile-links"]')).toBeNull();
  });

  it('viewing another\'s private (default) profile shows only counts, no library/collections/trophies/identity links', () => {
    const fixture = createAndLoad(
      OTHER_SUB,
      profile({
        follower_count: FOLLOWER_COUNT,
        following_count: FOLLOWING_COUNT,
        library_visible: false,
        collections_visible: false,
        trophies: null,
        identity: null,
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(statValue(compiled, '#profile-stat-followers')).toBe(String(FOLLOWER_COUNT));
    expect(statValue(compiled, '#profile-stat-following')).toBe(String(FOLLOWING_COUNT));
    expect(compiled.querySelector(`a[href="${userLibraryUrl(OTHER_SUB)}"]`)).toBeNull();
    expect(compiled.querySelector(`a[href="${userCollectionsUrl(OTHER_SUB)}"]`)).toBeNull();
    expect(compiled.querySelector('[data-stat="trophy-level"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="trophies-earned"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="profile-links"]')).toBeNull();
  });

  it('viewing another\'s fully public profile shows library/collections links, trophies, and identity', () => {
    const earned = { bronze: newCount(), silver: newCount(), gold: newCount(), platinum: newCount() };
    const trophies = { level: newCount(), tier: newCount(), earned };
    const fixture = createAndLoad(
      OTHER_SUB,
      profile({
        psn_account_id: PSN_ACCOUNT_ID,
        is_public: true,
        library_visible: true,
        collections_visible: true,
        trophies,
        identity: { online_id: ONLINE_ID },
      }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector(`a[href="${userLibraryUrl(OTHER_SUB)}"]`)).not.toBeNull();
    expect(compiled.querySelector(`a[href="${userCollectionsUrl(OTHER_SUB)}"]`)).not.toBeNull();
    expect(statValue(compiled, '#profile-stat-trophy-level')).toBe(String(trophies.level));
    expect(compiled.querySelector('#profile-stat-trophy-level-tier')?.textContent).toContain(String(trophies.tier));
    expect(statValue(compiled, '#profile-stat-trophies-earned')).toBe(String(earned.bronze + earned.silver + earned.gold + earned.platinum));
    expect(compiled.textContent).toContain(ONLINE_ID);
  });

  it('show_trophies true but the viewer has no PSN link -> no trophy tiles, no error', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ is_public: true, trophies: null, identity: null }));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-stat="trophy-level"]')).toBeNull();
    expect(compiled.querySelector('[data-stat="trophies-earned"]')).toBeNull();
    expect(compiled.querySelector('#profile-load-error, #profile-follow-error, #profile-add-psn-friend-error')).toBeNull();
  });

  it('tells the owner their own toggle is why trophies are blank, and links them to it', () => {
    const fixture = createAndLoad(
      null,
      profile({ viewer_is_owner: true, trophies: null, trophies_hidden_by_owner_setting: true }),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    const tile = compiled.querySelector('[data-stat="trophies-off"]');
    expect(tile).not.toBeNull();
    expect(tile?.textContent).toContain(TROPHIES_OFF_NOTICE);
    expect(tile?.querySelector(`a[href="${AppUrls.account}"]`)).not.toBeNull();
  });

  it('says nothing about why trophies are blank when the flag is false', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ trophies: null, trophies_hidden_by_owner_setting: false }));

    expect(fixture.nativeElement.querySelector('[data-stat="trophies-off"]')).toBeNull();
  });

  it('shows a Follow button when not owner and not already following', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ viewer_is_following: false }));

    const button = (fixture.nativeElement as HTMLElement).querySelector('#profile-follow-toggle');
    expect(button?.getAttribute('data-following')).toBe(String(false));
  });

  it('shows an Unfollow button when already following', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ viewer_is_following: true }));

    const button = (fixture.nativeElement as HTMLElement).querySelector('#profile-follow-toggle');
    expect(button?.getAttribute('data-following')).toBe(String(true));
  });

  it('follow() posts to the follow endpoint and increments the follower count optimistically', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ viewer_is_following: false, follower_count: FOLLOWER_COUNT }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-follow-toggle')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.usersBySubFollow(OTHER_SUB));
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: HttpStatusCode[HttpStatusCode.NoContent] });
    fixture.detectChanges();

    expect(statValue(compiled, '#profile-stat-followers')).toBe(String(FOLLOWER_COUNT + 1));
    expect(compiled.querySelector('#profile-follow-toggle')?.getAttribute('data-following')).toBe(String(true));
  });

  it('unfollow() deletes the follow endpoint and decrements the follower count', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ viewer_is_following: true, follower_count: FOLLOWER_COUNT }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-follow-toggle')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.usersBySubFollow(OTHER_SUB));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: HttpStatusCode[HttpStatusCode.NoContent] });
    fixture.detectChanges();

    expect(statValue(compiled, '#profile-stat-followers')).toBe(String(FOLLOWER_COUNT - 1));
  });

  it('shows an error message when follow() fails, without changing the button state', () => {
    const fixture = createAndLoad(OTHER_SUB, profile({ viewer_is_following: false, follower_count: FOLLOWER_COUNT }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-follow-toggle')?.click();
    fixture.detectChanges();

    httpMock.expectOne(CuratorApi.usersBySubFollow(OTHER_SUB)).flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(FOLLOW_USER_ERROR);
    expect(statValue(compiled, '#profile-stat-followers')).toBe(String(FOLLOWER_COUNT));
  });

  const disclosedProfile = () =>
    profile({ psn_account_id: PSN_ACCOUNT_ID, identity: { online_id: ONLINE_ID } });

  it('offers to add a disclosed PSN identity as a friend only when the viewer allows friend writes', () => {
    const allowed = createAndLoad(OTHER_SUB, disclosedProfile(), viewerPreferences({ allow_friend_writes: true }));
    expect((allowed.nativeElement as HTMLElement).querySelector('#profile-add-psn-friend')).not.toBeNull();

    const withheld = createAndLoad(OTHER_SUB, disclosedProfile(), viewerPreferences({ allow_friend_writes: false }));
    expect((withheld.nativeElement as HTMLElement).querySelector('#profile-add-psn-friend')).toBeNull();

    const unknown = createAndLoad(OTHER_SUB, disclosedProfile(), null);
    expect((unknown.nativeElement as HTMLElement).querySelector('#profile-add-psn-friend')).toBeNull();
  });

  it('never offers a friend request for an undisclosed identity or on your own profile', () => {
    const undisclosed = createAndLoad(
      OTHER_SUB,
      profile({ psn_account_id: PSN_ACCOUNT_ID, identity: null }),
      viewerPreferences({ allow_friend_writes: true }),
    );
    expect((undisclosed.nativeElement as HTMLElement).querySelector('#profile-add-psn-friend')).toBeNull();

    const own = createAndLoad(
      null,
      profile({ viewer_is_owner: true, identity: { online_id: newText() } }),
      viewerPreferences({ allow_friend_writes: true }),
    );
    expect((own.nativeElement as HTMLElement).querySelector('#profile-add-psn-friend')).toBeNull();
  });

  it('sends the friend request only after a second confirming click, and reports it', () => {
    const fixture = createAndLoad(OTHER_SUB, disclosedProfile(), viewerPreferences({ allow_friend_writes: true }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend')?.click();
    fixture.detectChanges();
    httpMock.expectNone((r) => r.url.startsWith(CuratorApi.meFriendRequests));
    expect(compiled.querySelector('#profile-add-psn-friend-confirm')).not.toBeNull();

    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend-confirm')?.click();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.meFriendRequestsByOnlineId(ONLINE_ID));
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: HttpStatusCode[HttpStatusCode.NoContent] });
    fixture.detectChanges();

    expect(compiled.querySelector('#profile-add-psn-friend-sent')?.textContent).toContain(ONLINE_ID);
    expect(compiled.querySelector('#profile-add-psn-friend')).toBeNull();
  });

  it('cancelling the confirmation sends nothing and restores the offer', () => {
    const fixture = createAndLoad(OTHER_SUB, disclosedProfile(), viewerPreferences({ allow_friend_writes: true }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend')?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend-cancel')?.click();
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url.startsWith(CuratorApi.meFriendRequests));
    expect(compiled.querySelector('#profile-add-psn-friend')).not.toBeNull();
  });

  it('reports a failed friend request and keeps the confirmation open', () => {
    const fixture = createAndLoad(OTHER_SUB, disclosedProfile(), viewerPreferences({ allow_friend_writes: true }));
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend')?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('#profile-add-psn-friend-confirm')?.click();
    fixture.detectChanges();
    httpMock
      .expectOne(CuratorApi.meFriendRequestsByOnlineId(ONLINE_ID))
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });
    fixture.detectChanges();

    expect(compiled.querySelector('#profile-add-psn-friend-error')?.textContent?.trim()).toBe(FRIEND_REQUEST_ERROR);
    expect(compiled.querySelector('#profile-add-psn-friend-confirm')).not.toBeNull();
  });

  it('shows an error message when the resolver could not load the profile', () => {
    configure(OTHER_SUB, { status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(PROFILE_LOAD_ERROR);
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: ResolvedStatuses.noUser });
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SIGNED_IN_USER_UNKNOWN_ERROR);
  });
});
