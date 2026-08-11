import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileFollowersComponent } from './profile-followers.component';
import { ResolvedFollowList } from './follow-list.resolver';
import { FollowListEntryResponse } from '../curator/curator.models';

function ok(entries: FollowListEntryResponse[] = [], total = entries.length): ResolvedFollowList {
  return { status: 'ok', entries, total };
}

function activatedRoute(sub: string | null, resolved: ResolvedFollowList): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { sub } : {}),
      data: { followers: resolved },
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No followers yet.');
    httpMock.expectNone((r) => r.url.endsWith('/followers'));
  });

  it('viewer mode renders another user\'s followers, each entry linking to /u/{sub}', () => {
    configure(
      'other-sub',
      ok(
        [
          { sub: 'follower-1', psn_account_id: 'psn-follower-1', followed_at: '2026-01-01T00:00:00Z' },
          { sub: 'follower-2', psn_account_id: null, followed_at: '2026-01-02T00:00:00Z' },
        ],
        2,
      ),
    );
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('2 total');
    expect(compiled.textContent).toContain('psn-follower-1');
    expect(compiled.textContent).toContain('Unlinked user');
    expect(compiled.querySelector('a[href="/u/follower-1"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/u/follower-2"]')).not.toBeNull();
  });

  it('lists followers even when the profile is private -- follow lists are always visible', () => {
    configure('other-sub', ok([{ sub: 'follower-1', psn_account_id: null, followed_at: '2026-01-01T00:00:00Z' }], 1));
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 total');
  });

  it('shows an error message when the resolver could not load followers', () => {
    configure('other-sub', { status: 'error' });
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load followers.');
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: 'no-user' });
    const fixture = TestBed.createComponent(ProfileFollowersComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to determine the signed-in user.');
  });
});
