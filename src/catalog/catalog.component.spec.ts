import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationExtras, Params, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
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
    percent_completed: null,
    content_kind: null,
    price: null,
    ...overrides,
  };
}

function fullPage(total: number): CatalogGamesResponse {
  return { games: Array.from({ length: 50 }, (_, i) => game(`g${i}`, `Game ${i}`)), total, excluded_owned: 0 };
}

interface CatalogHarness {
  search: { set(value: string | null): void };
  franchise: { set(value: string | null): void };
  genre: { set(value: string | null): void };
  aaaTier: { set(value: string | null): void };
  applyFilters(): void;
  onKindChange(value: CatalogKind): void;
  onSortChange(value: string): void;
  pageParams(page: number): Params;
}

function harness(fixture: ComponentFixture<CatalogComponent>): CatalogHarness {
  return fixture.componentInstance as unknown as CatalogHarness;
}

describe('CatalogComponent', () => {
  let httpMock: HttpTestingController;
  let queryParams$: BehaviorSubject<Params>;
  let currentParams: Params;
  const routeData: { catalog: CatalogGamesResponse | null; genres: string[] } = { catalog: null, genres: [] };
  const snapshot = { data: routeData, queryParams: {} as Params };

  function applyNavigation(extras: NavigationExtras | undefined): void {
    const merged: Params = { ...currentParams };
    for (const [key, value] of Object.entries(extras?.queryParams ?? {})) {
      if (value === null || value === undefined) {
        delete merged[key];
      } else {
        merged[key] = String(value);
      }
    }
    currentParams = merged;
    snapshot.queryParams = merged;
    queryParams$.next(merged);
  }

  function render(
    resolved: Pick<CatalogGamesResponse, 'games' | 'total'> | null,
    genres: string[] = [],
    params: Params = {},
  ): ComponentFixture<CatalogComponent> {
    routeData.catalog = resolved === null ? null : { ...resolved, excluded_owned: 0 };
    routeData.genres = genres;
    currentParams = { ...params };
    snapshot.queryParams = currentParams;
    queryParams$ = new BehaviorSubject<Params>(currentParams);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation((_commands, extras) => {
      applyNavigation(extras);
      return Promise.resolve(true);
    });
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    return fixture;
  }

  async function settleNgModelWrites(fixture: ComponentFixture<CatalogComponent>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    routeData.catalog = { games: [], total: 0, excluded_owned: 0 };
    routeData.genres = [];
    currentParams = {};
    snapshot.queryParams = {};
    queryParams$ = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([{ path: 'catalog', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot, get queryParams() { return queryParams$.asObservable(); } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('renders the first page from the resolver without issuing a request', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne')], total: 1 });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Bloodborne');
    httpMock.expectNone((r) => r.url === '/curator/api/catalog/games');
  });

  it('does not refetch the page the resolver already answered for this URL', () => {
    render(fullPage(120), [], { page: '2', pageSize: String(CATALOG_PAGE_SIZE) });

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

  it('sends a typed title search as q, and sends no q at all for a whitespace-only one', () => {
    const fixture = render({ games: [], total: 0 });

    const h = harness(fixture);
    h.search.set('tomb');
    h.applyFilters();

    const typed = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(typed.request.params.get('q')).toBe('tomb');
    typed.flush({ games: [], total: 0 });

    h.search.set('   ');
    h.applyFilters();

    const whitespaceOnly = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(whitespaceOnly.request.params.has('q')).toBe(false);
    whitespaceOnly.flush({ games: [], total: 0 });
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

  it('offers no Next link on the last page even when the page came back full', () => {
    const fixture = render(fullPage(50));

    const next = (fixture.nativeElement as HTMLElement).querySelector('#catalog-next');
    expect(next?.tagName, 'an anchor cannot carry disabled, so the inert shape is a real button').toBe(
      'BUTTON',
    );
    expect((next as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it('turns the pager into links once there is a page to turn to', () => {
    const fixture = render(fullPage(120));

    const next = (fixture.nativeElement as HTMLElement).querySelector('#catalog-next');
    expect(next?.tagName, 'a page turn must be a link, not a click handler').toBe('A');
    expect(harness(fixture).pageParams(2)).toEqual({ page: 2 });
  });

  it('drops the page parameter rather than writing page=1, so the first page has one URL', () => {
    const fixture = render(fullPage(120), [], { page: '2' });

    expect(harness(fixture).pageParams(1)).toEqual({ page: null });
  });

  it('requests the offset a page query parameter describes', () => {
    render(fullPage(120));

    applyNavigation({ queryParams: { page: 3 } });

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('offset')).toBe(String(CATALOG_PAGE_SIZE * 2));
    req.flush({ games: [], total: 120 });
  });

  it('applying filters resets to the first page and re-requests with the given params', () => {
    const fixture = render(fullPage(120), [], { page: '3' });

    const h = harness(fixture);
    h.franchise.set('Uncharted');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('franchise')).toBe('Uncharted');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('restores the controls from the URL, so a shared link opens the list it describes', async () => {
    const fixture = render({ games: [], total: 0 }, ['Shooter'], {
      q: 'tomb',
      franchise: 'Uncharted',
      genre: 'Shooter',
      aaaTier: 'AAA',
      kind: 'media_app',
      sort: 'price',
      sortDir: 'desc',
    });
    await settleNgModelWrites(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#catalog-search')?.value).toBe('tomb');
    expect(compiled.querySelector<HTMLInputElement>('#franchise')?.value).toBe('Uncharted');
    expect(selectById(compiled, 'catalog-kind').value).toBe('media_app');
    expect(selectById(compiled, 'catalog-sort').value).toBe('price:desc');
  });

  it('falls back to the defaults when the URL asks for a kind or sort that does not exist', async () => {
    const fixture = render({ games: [], total: 0 }, [], { kind: 'nonsense', sort: 'nonsense', sortDir: 'sideways' });
    await settleNgModelWrites(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(selectById(compiled, 'catalog-kind').value).toBe(DEFAULT_CATALOG_KIND);
    expect(selectById(compiled, 'catalog-sort').value).toBe('title:asc');
  });

  it('blocks interaction with the overlay while an in-page load is in flight, and keeps the current page visible', () => {
    const fixture = render({ games: [game('g1', 'Bloodborne')], total: 120 });
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.loading-overlay')).toBeNull();

    applyNavigation({ queryParams: { page: 2 } });
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

  it('lets a newer page win even when an older response comes back after it', () => {
    render(fullPage(500));

    applyNavigation({ queryParams: { page: 2 } });
    const first = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    applyNavigation({ queryParams: { page: 3 } });
    const second = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');

    expect(first.cancelled, 'a superseded page request must be cancelled, not merely ignored').toBe(true);
    second.flush({ games: [], total: 500 });
  });

  it('offers the resolved genres as options under an Any default, in the order resolved', () => {
    const fixture = render({ games: [], total: 0 }, ['Shooter', 'RPG', 'Adventure']);

    const select = selectById(fixture.nativeElement, 'genre');
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Any',
      'Shooter',
      'RPG',
      'Adventure',
    ]);
  });

  it('still renders a usable genre filter when no genres resolved', () => {
    const fixture = render({ games: [], total: 0 }, []);

    const select = selectById(fixture.nativeElement, 'genre');
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual(['Any']);
  });

  it('binds the Any option to null rather than an empty string, so an absent filter is absence', async () => {
    const fixture = render({ games: [], total: 0 }, ['Shooter']);
    const select = selectById(fixture.nativeElement, 'genre');

    await fixture.whenStable();

    expect(select.options[0].value, 'CODE-STYLE rule 1: the DOM token for "no genre chosen" must decode to null').not.toBe(
      '',
    );
    expect(select.value).toBe(select.options[0].value);
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

    harness(fixture).search.set('tomb');
    harness(fixture).applyFilters();
    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/games')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the catalog.');
  });

  it('asks for games only, titled ascending, until the reader says otherwise', () => {
    const fixture = render({ games: [], total: 0 });

    harness(fixture).search.set('tomb');
    harness(fixture).applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('kind')).toBe(DEFAULT_CATALOG_KIND);
    expect(req.request.params.get('sort')).toBe('title');
    expect(req.request.params.get('sortDir')).toBe('asc');
    req.flush({ games: [], total: 0 });
  });

  it('offers every kind the models declare, and sends the chosen one from the first page', () => {
    const fixture = render(fullPage(CATALOG_PAGE_SIZE * 4), [], { page: '2' });
    const compiled: HTMLElement = fixture.nativeElement;

    const offered = Array.from(selectById(compiled, 'catalog-kind').options).map((option) => option.value);
    expect(offered).toEqual(CATALOG_KIND_OPTIONS.map((option) => option.value));

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
    const fixture = render(fullPage(CATALOG_PAGE_SIZE * 4), [], { page: '2' });
    const compiled: HTMLElement = fixture.nativeElement;

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

  it('seeds the URL from the remembered size rather than quietly loading at it', () => {
    writePageSize(CATALOG_PAGE_SIZE_KEY, CATALOG_PAGE_SIZE_CEILING);

    render(fullPage(CATALOG_PAGE_SIZE * 4));

    expect(currentParams['pageSize'], 'a remembered size must reach the address bar to stay shareable').toBe(
      String(CATALOG_PAGE_SIZE_CEILING),
    );
    const reload = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(reload.request.params.get('limit')).toBe(String(CATALOG_PAGE_SIZE_CEILING));
    reload.flush({ games: [], total: 0 });
  });

  it('leaves a URL that already names a page size alone', () => {
    writePageSize(CATALOG_PAGE_SIZE_KEY, CATALOG_PAGE_SIZE_CEILING);

    render(fullPage(CATALOG_PAGE_SIZE * 4), [], { pageSize: String(CATALOG_PAGE_SIZE) });

    httpMock.expectNone((r) => r.url === '/curator/api/catalog/games');
  });
});
