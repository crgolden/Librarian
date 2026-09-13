import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  CATALOG_KIND_OPTIONS,
  CATALOG_PAGE_SIZE_CEILING,
  CATALOG_PAGE_SIZE_KEY,
  CATALOG_SORT_OPTIONS,
  CatalogComponent,
  DEFAULT_CATALOG_KIND,
} from './catalog.component';
import { CATALOG_PAGE_SIZE } from './catalog.resolver';
import { readPageSize, writePageSize } from '../shared/page-size/page-size.preference';
import { CatalogGamesResponse, CatalogKind, GameSummaryResponse } from '../curator/curator.models';

const CURATOR_CATALOG_LIMIT_MAX = 200;

function buttonById(root: HTMLElement, id: string): HTMLButtonElement {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`No button with id "${id}" is rendered.`);
  }
  return element;
}

function selectById(root: HTMLElement, id: string): HTMLSelectElement {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`No select with id "${id}" is rendered.`);
  }
  return element;
}

function chooseSize(root: HTMLElement, selector: string, value: string): void {
  const select = root.querySelector<HTMLSelectElement>(selector);
  if (select === null) {
    throw new Error(`No page-size control matched "${selector}"`);
  }
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

function game(id: string, title: string, overrides: Partial<GameSummaryResponse> = {}): GameSummaryResponse {
  return {
    game_id: id,
    canonical_title: title,
    franchise: 'Franchise',
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

function fullPage(total: number): CatalogGamesResponse {
  return { games: Array.from({ length: 50 }, (_, i) => game(`g${i}`, `Game ${i}`)), total };
}

interface CatalogHarness {
  search: { set(value: string): void };
  franchise: { set(value: string): void };
  genre: { set(value: string): void };
  aaaTier: { set(value: string): void };
  applyFilters(): void;
  nextPage(): void;
  prevPage(): void;
  onKindChange(value: CatalogKind): void;
  onSortChange(value: string): void;
}

function harness(fixture: ComponentFixture<CatalogComponent>): CatalogHarness {
  return fixture.componentInstance as unknown as CatalogHarness;
}

describe('CatalogComponent', () => {
  let httpMock: HttpTestingController;
  const routeData: { catalog: CatalogGamesResponse | null; genres: string[] } = { catalog: null, genres: [] };

  function render(resolved: CatalogGamesResponse | null, genres: string[] = []): ComponentFixture<CatalogComponent> {
    routeData.catalog = resolved;
    routeData.genres = genres;
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    localStorage.clear();
    routeData.catalog = { games: [], total: 0 };
    routeData.genres = [];
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the first page from the resolver without issuing a request', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne')], total: 1 });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Bloodborne');
    expect(compiled.querySelector('button[disabled]')?.textContent).toContain('Previous');
    httpMock.expectNone((r) => r.url === '/curator/api/catalog/games');
  });

  it('keeps the pager and its count when a filter matches nothing', () => {
    const fixture = render({ games: [], total: 0 });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('No titles match these filters.');
    expect(compiled.querySelector('#catalog-prev')).not.toBeNull();
    expect(compiled.querySelector('#catalog-next')).not.toBeNull();
    expect(compiled.querySelector('#catalog-page-range')?.textContent?.trim()).toBe('0 of 0');
  });

  it('shows the error state when the resolver could not load the catalog', () => {
    const fixture = render(null);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the catalog.');
  });

  it('renders each rating, and a dash where a score is missing', () => {
    const fixture = render({
      games: [game('g1', 'Bloodborne', { critical_score: 92, oc_score: 91, psn_rating: null })],
      total: 1,
    });

    const ratings = (fixture.nativeElement as HTMLElement).querySelector('#catalog-ratings-0')?.textContent;
    expect(ratings).toContain('RAWG 92');
    expect(ratings).toContain('OpenCritic 91');
    expect(ratings).toContain('PS Store —');
  });

  it('links to RAWG once a rendered game carries their score', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne', { critical_score: 92 })], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();
  });

  it('names RAWG as a source on no page that renders none of their data', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne', { oc_score: 91 })], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('sends the title search term as q', () => {
    const fixture = render({ games: [], total: 0 });

    const h = harness(fixture);
    h.search.set('tomb');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('q')).toBe('tomb');
    req.flush({ games: [], total: 0 });
  });

  it('renders cover art and a PlayStation Store link when the catalog has them', () => {
    const fixture = render({
      games: [
        game('g1', 'Bloodborne', {
          cover_image_url: 'https://img/cover.jpg',
          store_product_id: 'UP9000-CUSA00207_00-X',
        }),
      ],
      total: 1,
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('img.cover-art')?.getAttribute('src')).toBe('https://img/cover.jpg');
    const link = compiled.querySelector<HTMLAnchorElement>('#catalog-store-link-0');
    expect(link?.href).toContain('store.playstation.com/product/');
    expect(link?.rel).toContain('noopener');
  });

  it('omits the store link for a game with no store product id', () => {
    const fixture = render({ games: [game('g1', 'Unknown')], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-store-link-0')).toBeNull();
  });

  it('disables Next on the last page even when the page came back full', () => {
    const fixture = render(fullPage(50));

    const next = buttonById(fixture.nativeElement, 'catalog-next');
    expect(next.disabled).toBe(true);
  });

  it('applying filters resets the offset and re-requests with the given params', () => {
    const fixture = render({ games: [], total: 0 });

    const h = harness(fixture);
    h.franchise.set('Uncharted');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('franchise')).toBe('Uncharted');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('nextPage advances the offset by one page', () => {
    const fixture = render(fullPage(120));

    harness(fixture).nextPage();
    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('offset')).toBe('50');
    req.flush({ games: [], total: 120 });
  });

  it('blocks interaction with the overlay while an in-page load is in flight, and keeps the current page visible', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne')], total: 120 });
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.loading-overlay')).toBeNull();

    harness(fixture).nextPage();
    fixture.detectChanges();

    expect(compiled.querySelector('.loading-overlay')).not.toBeNull();
    expect(compiled.textContent).toContain('Bloodborne');

    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/games')
      .flush({ games: [game('g2', 'Sekiro')], total: 120 });
    fixture.detectChanges();

    expect(compiled.querySelector('.loading-overlay')).toBeNull();
    expect(compiled.textContent).toContain('Sekiro');
  });

  it('offers the resolved genres as options under an Any default, in the order resolved', () => {
    const fixture = render({ games: [], total: 0 }, ['Shooter', 'RPG', 'Adventure']);

    const select = selectById(fixture.nativeElement, 'genre');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'Shooter', 'RPG', 'Adventure']);
    expect(select.options[0].textContent).toContain('Any');
  });

  it('still renders a usable genre filter when no genres resolved', () => {
    const fixture = render({ games: [], total: 0 }, []);

    const select = selectById(fixture.nativeElement, 'genre');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['']);
  });

  it('sends the selected genre as the genre filter', () => {
    const fixture = render({ games: [], total: 0 }, ['Shooter']);

    const h = harness(fixture);
    h.genre.set('Shooter');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('genre')).toBe('Shooter');
    req.flush({ games: [], total: 0 });
  });

  it('shows an error message when an in-page load fails', () => {
    const fixture = render({ games: [], total: 0 });

    harness(fixture).applyFilters();
    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/games')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the catalog.');
  });

  it('asks for games only, titled ascending, until the reader says otherwise', () => {
    const fixture = render({ games: [], total: 0 });

    harness(fixture).applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('kind')).toBe(DEFAULT_CATALOG_KIND);
    expect(req.request.params.get('sort')).toBe('title');
    expect(req.request.params.get('sortDir')).toBe('asc');
    req.flush({ games: [], total: 0 });
  });

  it('offers every kind the models declare, and sends the chosen one from the first page', () => {
    const fixture = render(fullPage(CATALOG_PAGE_SIZE * 4));
    const compiled: HTMLElement = fixture.nativeElement;

    const offered = Array.from(selectById(compiled, 'catalog-kind').options).map((option) => option.value);
    expect(offered).toEqual(CATALOG_KIND_OPTIONS.map((option) => option.value));

    harness(fixture).nextPage();
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush(fullPage(CATALOG_PAGE_SIZE * 4));
    fixture.detectChanges();

    harness(fixture).onKindChange('media_app');

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('kind')).toBe('media_app');
    expect(
      req.request.params.get('offset'),
      'a kind change narrows the result set, so holding the old offset can land past its end',
    ).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('splits the chosen sort option into the field and direction Curator expects', () => {
    const fixture = render({ games: [], total: 0 });

    const offered = Array.from(selectById(fixture.nativeElement, 'catalog-sort').options).map((o) => o.value);
    expect(offered).toEqual(CATALOG_SORT_OPTIONS.map((option) => option.value));

    harness(fixture).onSortChange('price:desc');

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('sort')).toBe('price');
    expect(req.request.params.get('sortDir')).toBe('desc');
    req.flush({ games: [], total: 0 });
  });

  it('states a published price on the card, and renders no price line without one', () => {
    const fixture = render({
      games: [
        game('g1', 'Bloodborne', {
          price: {
            is_free: false,
            tied_to_subscription: false,
            base_cents: 1999,
            discounted_cents: 1999,
            discount_text: null,
            fetched_at: '2026-09-01T00:00:00Z',
          },
        }),
        game('g2', 'Unpriced', { price: null }),
      ],
      total: 2,
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-price-0')?.textContent).toContain('$19.99');
    expect(compiled.querySelector('#catalog-price-1')).toBeNull();
  });

  it('labels an entry that is not a game, and labels a game as nothing at all', () => {
    const fixture = render({
      games: [game('g1', 'Netflix', { content_kind: 'media_app' }), game('g2', 'Bloodborne', { content_kind: 'game' })],
      total: 2,
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-kind-0')?.textContent).toContain('Media app');
    expect(compiled.querySelector('#catalog-kind-1')).toBeNull();
  });

  it('offers no page size above the ceiling /catalog/games enforces', () => {
    const fixture = render({ games: [], total: 0 });

    const offered = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#catalog-page-size option'),
    ).map((option) => Number(option.value));

    expect(offered.length).toBeGreaterThan(0);
    expect(Math.max(...offered)).toBeLessThanOrEqual(CURATOR_CATALOG_LIMIT_MAX);
  });

  it('re-requests the first page at the chosen size, and remembers the choice', () => {
    const fixture = render(fullPage(CATALOG_PAGE_SIZE * 4));
    const compiled: HTMLElement = fixture.nativeElement;

    harness(fixture).nextPage();
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush(fullPage(CATALOG_PAGE_SIZE * 4));
    fixture.detectChanges();

    const larger = String(CATALOG_PAGE_SIZE_CEILING);
    chooseSize(compiled, '#catalog-page-size', larger);
    fixture.detectChanges();

    const resized = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(resized.request.params.get('limit')).toBe(larger);
    expect(resized.request.params.get('offset')).toBe('0');
    resized.flush({ games: [], total: 0 });

    expect(readPageSize(CATALOG_PAGE_SIZE_KEY, [CATALOG_PAGE_SIZE_CEILING], CATALOG_PAGE_SIZE)).toBe(
      CATALOG_PAGE_SIZE_CEILING,
    );
  });

  it('loads at the remembered size rather than the size the resolver used', () => {
    writePageSize(CATALOG_PAGE_SIZE_KEY, CATALOG_PAGE_SIZE_CEILING);

    render(fullPage(CATALOG_PAGE_SIZE * 4));

    const reload = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(reload.request.params.get('limit')).toBe(String(CATALOG_PAGE_SIZE_CEILING));
    reload.flush({ games: [], total: 0 });
  });
});
