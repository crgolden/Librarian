import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileFollowingComponent } from './profile-following.component';
import { ResolvedFollowList } from './follow-list.resolver';
import { FollowListEntryResponse } from '../curator/curator.models';
import { FollowListKinds, RouteDataKeys, RouteParams, userProfileUrl } from '../app/app-paths';
import { FOLLOWING_LOAD_ERROR, SIGNED_IN_USER_UNKNOWN_ERROR } from './profile.messages';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newId, newUtcInstant } from '@crgolden/modules/testing';

const OTHER_SUB = newId();
const FOLLOWED_SUB = newId();
const FOLLOWED_PSN_ACCOUNT_ID = newId();

function ok(entries: FollowListEntryResponse[] = [], total = entries.length): ResolvedFollowList {
  return { status: ResolvedStatuses.ok, entries, total };
}

function activatedRoute(sub: string | null, resolved: ResolvedFollowList): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { [RouteParams.sub]: sub } : {}),
      data: { [RouteDataKeys.following]: resolved },
    },
  } as unknown as ActivatedRoute;
}

describe('ProfileFollowingComponent', () => {
  let httpMock: HttpTestingController;

  function configure(routeSub: string | null, resolved: ResolvedFollowList): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileFollowingComponent],
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
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#following-empty')).not.toBeNull();
    httpMock.expectNone((r) => r.url.endsWith(`/${FollowListKinds.following}`));
  });

  it('viewer mode renders another user\'s following list, each entry linking to /u/{sub}', () => {
    configure(
      OTHER_SUB,
      ok([{ sub: FOLLOWED_SUB, psn_account_id: FOLLOWED_PSN_ACCOUNT_ID, followed_at: newUtcInstant() }], 1),
    );
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#following-total')?.getAttribute('data-total')).toBe(String(1));
    expect(compiled.textContent).toContain(FOLLOWED_PSN_ACCOUNT_ID);
    expect(compiled.querySelector(`a[href="${userProfileUrl(FOLLOWED_SUB)}"]`)).not.toBeNull();
  });

  it('shows an error message when the resolver could not load the following list', () => {
    configure(OTHER_SUB, { status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(FOLLOWING_LOAD_ERROR);
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: ResolvedStatuses.noUser });
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SIGNED_IN_USER_UNKNOWN_ERROR);
  });
});
