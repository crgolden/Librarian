import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { CatalogDetailComponent } from './catalog-detail.component';
import { ResolvedCatalogGame } from './catalog-detail.resolver';
import { GameSummaryResponse, PublicCollectionSummaryResponse } from '../curator/curator.models';

function ok(game: GameSummaryResponse, collections: PublicCollectionSummaryResponse[] = []): ResolvedCatalogGame {
  return { status: 'ok', game, collections };
}

function publicCollection(overrides: Partial<PublicCollectionSummaryResponse> = {}): PublicCollectionSummaryResponse {
  return {
    definition_id: 'd1',
    name: 'Weekend picks',
    share_slug: 'weekend-picks',
    item_count: 3,
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function game(overrides: Partial<GameSummaryResponse> = {}): GameSummaryResponse {
  return {
    game_id: 'g1',
    canonical_title: 'Bloodborne',
    franchise: 'Souls',
    genre: 'Action',
    aaa_tier: 'AAA',
    cover_image_url: null,
    store_product_id: null,
    critical_score: null,
    oc_score: null,
    psn_rating: null,
    ...overrides,
  };
}

describe('CatalogDetailComponent', () => {
  let httpMock: HttpTestingController;

  function render(resolved: ResolvedCatalogGame): ComponentFixture<CatalogDetailComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { game: resolved } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the resolved game with no request of its own', () => {
    const fixture = render(ok(game({ psn_rating: 4.7 })));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bloodborne');
    expect(compiled.querySelector('#catalog-detail-ratings')?.textContent).toContain('PS Store 4.7');
    httpMock.expectNone((r) => r.url.startsWith('/curator/api/catalog/games'));
  });

  it('shows a dash for each rating the catalog has no value for', () => {
    const fixture = render(ok(game()));

    const ratings = (fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-ratings')?.textContent;
    expect(ratings).toContain('RAWG —');
    expect(ratings).toContain('OpenCritic —');
    expect(ratings).toContain('PS Store —');
  });

  it('offers the PlayStation Store link only when a store product id exists', () => {
    const withId = render(ok(game({ store_product_id: 'UP9000-CUSA00207_00-X' })));
    const link = (withId.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#catalog-detail-store-link');
    expect(link?.href).toContain('store.playstation.com/product/');
    expect(link?.rel).toContain('noopener');

    const withoutId = render(ok(game({ store_product_id: null })));
    expect((withoutId.nativeElement as HTMLElement).querySelector('#catalog-detail-store-link')).toBeNull();
  });

  it('links to RAWG only when this game carries their score', () => {
    const scored = render(ok(game({ critical_score: 92 })));
    expect((scored.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();

    const unscored = render(ok(game({ critical_score: null, oc_score: 91 })));
    expect((unscored.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('states the price the storefront published, and says nothing when it published none', () => {
    const priced = render(
      ok(
        game({
          price: {
            is_free: false,
            tied_to_subscription: false,
            base_cents: 6999,
            discounted_cents: 4899,
            discount_text: '-30%',
            fetched_at: '2026-09-01T00:00:00Z',
          },
        }),
      ),
    );
    const line = (priced.nativeElement as HTMLElement).querySelector('#catalog-detail-price')?.textContent;
    expect(line).toContain('$48.99');
    expect(line).toContain('$69.99');
    expect(line).toContain('-30%');

    const unpriced = render(ok(game({ price: null })));
    expect((unpriced.nativeElement as HTMLElement).querySelector('#catalog-detail-price')).toBeNull();
  });

  it('names a subscription-included title as such rather than as free', () => {
    const fixture = render(
      ok(
        game({
          price: {
            is_free: true,
            tied_to_subscription: true,
            base_cents: null,
            discounted_cents: null,
            discount_text: null,
            fetched_at: '2026-09-01T00:00:00Z',
          },
        }),
      ),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-price')?.textContent).toContain(
      'PlayStation Plus',
    );
  });

  it('lists the public collections holding this game, each linking to its share slug', () => {
    const fixture = render(
      ok(game(), [
        publicCollection({ definition_id: 'd1', name: 'Weekend picks', share_slug: 'weekend-picks' }),
        publicCollection({ definition_id: 'd2', name: 'Souls run', share_slug: 'souls-run', item_count: 8 }),
      ]),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-detail-collections')).not.toBeNull();
    const links = compiled.querySelectorAll<HTMLAnchorElement>('[id^="catalog-detail-collection-"]');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/c/weekend-picks');
    expect(links[0]?.textContent?.trim()).toBe('Weekend picks');
    expect(links[1]?.getAttribute('href')).toBe('/c/souls-run');
  });

  it('renders no collections section at all when no public collection holds the game', () => {
    const fixture = render(ok(game(), []));

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-collections')).toBeNull();
  });

  it('names no source on a game it could not load', () => {
    const fixture = render({ status: 'not-found' });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('shows a not-found page for an unknown game id', () => {
    const fixture = render({ status: 'not-found' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Game not found');
  });

  it('shows an error message when the resolver could not load the game', () => {
    const fixture = render({ status: 'error' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this game.');
  });

  it('names the game in the document title and the social metadata', () => {
    render(ok(game()));

    expect(TestBed.inject(Title).getTitle()).toBe('Bloodborne — Librarian');
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="description"')?.content).toContain('Souls · Action · AAA');
    expect(meta.getTag('property="og:title"')?.content).toBe('Bloodborne — Librarian');
    expect(meta.getTag('property="og:description"')?.content).toContain('Bloodborne');
    expect(meta.getTag('property="og:type"')?.content).toBe('article');
  });

  it('gives the not-found and error branches their own titles rather than the route default', () => {
    render({ status: 'not-found' });
    expect(TestBed.inject(Title).getTitle()).toBe('Game not found — Librarian');

    render({ status: 'error' });
    expect(TestBed.inject(Title).getTitle()).toBe('Game unavailable — Librarian');
  });
});
