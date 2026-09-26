import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileFollowersComponent } from './profile-followers.component';
import { ResolvedFollowList } from './follow-list.resolver';
import { FollowListEntryResponse } from '../curator/curator.models';
import { FollowListKinds, RouteDataKeys, RouteParams, userProfileUrl } from '../app/app-paths';
import { FOLLOWERS_LOAD_ERROR, SIGNED_IN_USER_UNKNOWN_ERROR, UNLINKED_USER_NAME } from './profile.messages';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newId, newUtcInstant } from '@crgolden/modules/testing';

const OTHER_SUB = newId();
const FOLLOWER_SUB = newId();
const UNLINKED_FOLLOWER_SUB = newId();
const FOLLOWER_PSN_ACCOUNT_ID = newId();

function ok(entries: FollowListEntryResponse[] = [], total = entries.length): ResolvedFollowList {
  return { status: ResolvedStatuses.ok, entries, total };
}

function activatedRoute(sub: string | null, resolved: ResolvedFollowList): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { [RouteParams.sub]: sub } : {}),
      data: { [RouteDataKeys.followers]: resolved },
    },
  } as unknown as ActivatedRoute;
}

describe('ProfileFollowersComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, resolved: ResolvedFollowList): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileFollowersComponent],
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

  it('owner mode renders the resolved list with no request of its own', () => {
    configure(null, ok());
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#followers-empty')).not.toBeNull();
    httpMock.expectNone((r) => r.url.endsWith(`/${FollowListKinds.followers}`));
  });

  it('viewer mode renders another user\'s followers, each entry linking to /u/{sub}', () => {
    configure(
      OTHER_SUB,
      ok(
        [
          { sub: FOLLOWER_SUB, psn_account_id: FOLLOWER_PSN_ACCOUNT_ID, followed_at: newUtcInstant() },
          { sub: UNLINKED_FOLLOWER_SUB, psn_account_id: null, followed_at: newUtcInstant() },
        ],
      ),
    );
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#followers-total')?.getAttribute('data-total')).toBe(String(compiled.querySelectorAll('[id^="follow-entry-"]').length));
    expect(compiled.textContent).toContain(FOLLOWER_PSN_ACCOUNT_ID);
    expect(compiled.textContent).toContain(UNLINKED_USER_NAME);
    expect(compiled.querySelector(`a[href="${userProfileUrl(FOLLOWER_SUB)}"]`)).not.toBeNull();
    expect(compiled.querySelector(`a[href="${userProfileUrl(UNLINKED_FOLLOWER_SUB)}"]`)).not.toBeNull();
  });

  it('lists followers even when the profile is private -- follow lists are always visible', () => {
    configure(OTHER_SUB, ok([{ sub: FOLLOWER_SUB, psn_account_id: null, followed_at: newUtcInstant() }], 1));
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#followers-total')?.getAttribute('data-total')).toBe(String(1));
  });

  it('shows an error message when the resolver could not load followers', () => {
    configure(OTHER_SUB, { status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(FOLLOWERS_LOAD_ERROR);
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: ResolvedStatuses.noUser });
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SIGNED_IN_USER_UNKNOWN_ERROR);
  });
});
