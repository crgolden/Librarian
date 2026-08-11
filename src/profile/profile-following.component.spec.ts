import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileFollowingComponent } from './profile-following.component';
import { ResolvedFollowList } from './follow-list.resolver';
import { FollowListEntryResponse } from '../curator/curator.models';

function ok(entries: FollowListEntryResponse[] = [], total = entries.length): ResolvedFollowList {
  return { status: 'ok', entries, total };
}

function activatedRoute(sub: string | null, resolved: ResolvedFollowList): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { sub } : {}),
      data: { following: resolved },
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not following anyone yet.');
    httpMock.expectNone((r) => r.url.endsWith('/following'));
  });

  it('viewer mode renders another user\'s following list, each entry linking to /u/{sub}', () => {
    configure(
      'other-sub',
      ok([{ sub: 'followed-1', psn_account_id: 'psn-followed-1', followed_at: '2026-01-01T00:00:00Z' }], 1),
    );
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('1 total');
    expect(compiled.textContent).toContain('psn-followed-1');
    expect(compiled.querySelector('a[href="/u/followed-1"]')).not.toBeNull();
  });

  it('shows an error message when the resolver could not load the following list', () => {
    configure('other-sub', { status: 'error' });
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load following.');
  });

  it('shows an error message when nobody is signed in and no :sub was given', () => {
    configure(null, { status: 'no-user' });
    const fixture = TestBed.createComponent(ProfileFollowingComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to determine the signed-in user.');
  });
});
