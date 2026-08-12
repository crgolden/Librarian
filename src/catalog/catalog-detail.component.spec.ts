import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { CatalogDetailComponent } from './catalog-detail.component';
import { ResolvedCatalogGame } from './catalog-detail.resolver';
import { GameSummaryResponse } from '../curator/curator.models';

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
    const fixture = render({ status: 'ok', game: game({ psn_rating: 4.7 }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bloodborne');
    expect(compiled.querySelector('#catalog-detail-ratings')?.textContent).toContain('PS Store 4.7');
    httpMock.expectNone((r) => r.url.startsWith('/curator/api/catalog/games'));
  });

  it('shows a dash for each rating the catalog has no value for', () => {
    const fixture = render({ status: 'ok', game: game() });

    const ratings = (fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-ratings')?.textContent ?? '';
    expect(ratings).toContain('RAWG —');
    expect(ratings).toContain('OpenCritic —');
    expect(ratings).toContain('PS Store —');
  });

  it('offers the PlayStation Store link only when a store product id exists', () => {
    const withId = render({ status: 'ok', game: game({ store_product_id: 'UP9000-CUSA00207_00-X' }) });
    const link = (withId.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#catalog-detail-store-link');
    expect(link?.href).toContain('store.playstation.com/product/');
    expect(link?.rel).toContain('noopener');

    const withoutId = render({ status: 'ok', game: game({ store_product_id: null }) });
    expect((withoutId.nativeElement as HTMLElement).querySelector('#catalog-detail-store-link')).toBeNull();
  });

  it('shows a not-found page for an unknown game id', () => {
    const fixture = render({ status: 'not-found' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Game not found');
  });

  it('shows an error message when the resolver could not load the game', () => {
    const fixture = render({ status: 'error' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this game.');
  });
});
