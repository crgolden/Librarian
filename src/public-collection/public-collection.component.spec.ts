import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { PublicCollectionComponent } from './public-collection.component';
import { PublicCollectionResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function publicCollection(overrides: Partial<PublicCollectionResponse> = {}): PublicCollectionResponse {
  return {
    definition_id: 'd1',
    name: 'Shared picks',
    description: 'A few favorites',
    visibility: 'unlisted',
    items: [],
    ...overrides,
  };
}

function activatedRouteWithSlug(slug: string | null): ActivatedRoute {
  return {
    snapshot: { paramMap: convertToParamMap(slug !== null ? { slug } : {}), url: slug !== null ? [{ path: 'c' }, { path: slug }] : [] },
  } as unknown as ActivatedRoute;
}

function authService(isAuthenticated: boolean): AuthService {
  return { isAuthenticated: signal(isAuthenticated), loginUrl: '/bff/login' } as unknown as AuthService;
}

describe('PublicCollectionComponent', () => {
  let httpMock: HttpTestingController;

  function configure(slug: string | null, authenticated: boolean): void {
    TestBed.configureTestingModule({
      imports: [PublicCollectionComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteWithSlug(slug) },
        { provide: AuthService, useValue: authService(authenticated) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('sets a noindex robots meta tag', () => {
    configure('slug1', false);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(publicCollection());
    httpMock.expectOne('/curator/api/collections/followed').flush(null, { status: 401, statusText: 'Unauthorized' });

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('renders a shared collection with its items and cover art', () => {
    configure('slug1', false);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(
      publicCollection({
        items: [
          {
            game_id: 'g1',
            rank: 1,
            title: 'Game One',
            franchise: 'Franchise',
            genre: 'RPG',
            aaa_tier: 'AAA',
            critical_score: 90,
            oc_score: 88,
            psn_rating: 4.5,
            cover_image_url: 'https://img.example/g1.jpg',
            owner_has_access: true,
          },
        ],
      }),
    );
    httpMock.expectOne('/curator/api/collections/followed').flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Shared picks');
    expect(compiled.textContent).toContain('Game One');
    expect(compiled.querySelector('img.cover-art')?.getAttribute('src')).toBe('https://img.example/g1.jpg');
  });

  it('shows a not-found message on a 404 (unknown slug or private collection)', () => {
    configure('missing', false);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/missing').flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Collection not found');
  });

  it('shows a generic error message on a non-404 failure', () => {
    configure('slug1', false);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this collection.');
  });

  it('shows a "sign in to follow" link when anonymous', () => {
    configure('slug1', false);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(publicCollection());
    httpMock.expectOne('/curator/api/collections/followed').flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Sign in to follow this collection');
    expect(compiled.querySelector('a')?.getAttribute('href')).toBe('/bff/login?returnTo=%2Fc%2Fslug1');
  });

  it('follows and unfollows a collection when authenticated', () => {
    configure('slug1', true);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(publicCollection());
    httpMock.expectOne('/curator/api/collections/followed').flush([]);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const followButton = () => Array.from(compiled.querySelectorAll('button')).find((b) => /follow/i.test(b.textContent ?? ''));
    expect(followButton()?.textContent?.trim()).toBe('Follow this collection');

    followButton()?.dispatchEvent(new Event('click'));
    httpMock.expectOne({ url: '/curator/api/collections/d1/follow', method: 'POST' }).flush(null);
    fixture.detectChanges();

    expect(followButton()?.textContent?.trim()).toBe('Unfollow');
  });

  it('pre-selects the follow button as already-following when the viewer already follows it', () => {
    configure('slug1', true);
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/public/collections/slug1').flush(publicCollection({ definition_id: 'd1' }));
    httpMock.expectOne('/curator/api/collections/followed').flush([{ definition_id: 'd1', name: 'x', kind: 'filter_list', console_id: null, description: null, genre_filter: [], min_score: null, aaa_tier_filter: null, include_inactive: false, min_percent_completed: null, visibility: 'unlisted', share_slug: 'slug1', item_count: 1 }]);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('button')?.textContent?.trim()).toBe('Unfollow');
  });
});
