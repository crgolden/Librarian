import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
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
  CENTS_PER_DOLLAR,
  CatalogComponent,
  DEFAULT_CATALOG_KIND,
  USD,
  priceLine,
} from './catalog.component';
import { storeProductUrl } from './store-links';
import { CATALOG_PAGE_SIZE } from './catalog.resolver';
import { readPageSize, writePageSize } from '../shared/page-size/page-size.preference';
import {
  CatalogGamesResponse,
  CatalogKind,
  CatalogPriceResponse,
  CatalogSortFields,
  ContentKinds,
  GameSummaryResponse,
  SortDirections,
} from '../curator/curator.models';
import { CuratorApi, CuratorQueryParams } from '../curator/curator-api';
import { ANY_OPTION_LABEL, CATALOG_EMPTY_MESSAGE, CATALOG_LOAD_ERROR, EMPTY_PAGE_RANGE } from './catalog.messages';
import { LinkRelTokens } from '../testing/html-constants';
import { contentKindLabel } from './content-kind-labels';
import { catalogSortValue } from './catalog-sort';
import { CatalogQueryParams } from './catalog.query';
import { CATALOG_GENRE_CONTROL_ID, CATALOG_KIND_CONTROL_ID, CATALOG_SORT_CONTROL_ID } from './catalog-ids';
import { AppPaths } from '../app/app-paths';
import { newHttpsAddress, newId, newPercent, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

const GAME_ID = newId();
const OTHER_GAME_ID = newId();
const GAME_TITLE = newText();
const OTHER_GAME_TITLE = newText();
const SEARCH_TERM = newText();
const FRANCHISE = newText();
const GENRE = newText();
const MULTI_PAGE_COUNT = randomIntBetween(4, 8);
const MULTI_PAGE_TOTAL = CATALOG_PAGE_SIZE * (MULTI_PAGE_COUNT - 1) + randomIntBetween(1, CATALOG_PAGE_SIZE);
const LATER_PAGE_NUMBER = randomIntBetween(2, MULTI_PAGE_COUNT);
const LATER_PAGE = String(LATER_PAGE_NUMBER);

function offsetOfPage(page: number): number {
  return CATALOG_PAGE_SIZE * (page - 1);
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
    franchise: newText(),
    genre: newText(),
    aaa_tier: newText(),
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
  return { games: Array.from({ length: CATALOG_PAGE_SIZE }, () => game(newId(), newText())), total, excluded_owned: 0 };
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
        provideRouter([{ path: AppPaths.catalog, children: [] }]),
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
    const fixture = render({ games: [game(GAME_ID, GAME_TITLE)], total: 1 });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(GAME_TITLE);
    httpMock.expectNone((r) => r.url === CuratorApi.catalogGames);
  });

  it('does not refetch the page the resolver already answered for this URL', () => {
    const resolved = fullPage(MULTI_PAGE_TOTAL);
    const [firstGame] = resolved.games;

    const fixture = render(resolved, [], { page: LATER_PAGE, pageSize: String(CATALOG_PAGE_SIZE) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(firstGame.canonical_title);
    httpMock.expectNone((r) => r.url === CuratorApi.catalogGames);
  });

  it('keeps the pager and its count when a filter matches nothing', () => {
    const fixture = render({ games: [], total: 0 });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(CATALOG_EMPTY_MESSAGE);
    expect(compiled.querySelector('#catalog-prev')).not.toBeNull();
    expect(compiled.querySelector('#catalog-next')).not.toBeNull();
    expect(compiled.querySelector('#catalog-page-range')?.textContent?.trim()).toBe(EMPTY_PAGE_RANGE);
  });

  it('shows the error state when the resolver could not load the catalog', () => {
    const fixture = render(null);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(CATALOG_LOAD_ERROR);
  });

  it('renders each rating, and no score where one is missing', () => {
    const criticalScore = newPercent();
    const openCriticScore = newPercent();
    const fixture = render({
      games: [game(GAME_ID, GAME_TITLE, { critical_score: criticalScore, oc_score: openCriticScore, psn_rating: null })],
      total: 1,
    });

    const compiled: HTMLElement = fixture.nativeElement;
    const ratings = compiled.querySelector('#catalog-ratings-0')?.textContent;
    expect(ratings).toContain(`RAWG ${criticalScore}`);
    expect(ratings).toContain(`OpenCritic ${openCriticScore}`);
    expect(compiled.querySelector('#catalog-psn-rating-0')?.hasAttribute('data-score')).toBe(false);
  });

  it('links to RAWG once a rendered game carries their score', () => {
    const fixture = render({ games: [game(GAME_ID, GAME_TITLE, { critical_score: newPercent() })], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();
  });

  it('names RAWG as a source on no page that renders none of their data', () => {
    const fixture = render({ games: [game(GAME_ID, GAME_TITLE, { oc_score: newPercent() })], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('sends a typed title search as q, and sends no q at all for a whitespace-only one', () => {
    const fixture = render({ games: [], total: 0 });

    const h = harness(fixture);
    h.search.set(SEARCH_TERM);
    h.applyFilters();

    const typed = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(typed.request.params.get(CuratorQueryParams.q)).toBe(SEARCH_TERM);
    typed.flush({ games: [], total: 0 });

    h.search.set('   ');
    h.applyFilters();

    const whitespaceOnly = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(whitespaceOnly.request.params.has(CuratorQueryParams.q)).toBe(false);
    whitespaceOnly.flush({ games: [], total: 0 });
  });

  it('renders cover art and a PlayStation Store link when the catalog has them', () => {
    const coverUrl = newHttpsAddress();
    const storeProductId = newId();
    const fixture = render({
      games: [
        game(GAME_ID, GAME_TITLE, {
          cover_image_url: coverUrl,
          store_product_id: storeProductId,
        }),
      ],
      total: 1,
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-cover-0')?.getAttribute('src')).toBe(coverUrl);
    const link = compiled.querySelector<HTMLAnchorElement>('#catalog-store-link-0');
    expect(link?.href).toBe(storeProductUrl(storeProductId));
    expect(link?.rel).toContain(LinkRelTokens.noopener);
  });

  it('omits the store link for a game with no store product id', () => {
    const fixture = render({ games: [game(GAME_ID, GAME_TITLE)], total: 1 });

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-store-link-0')).toBeNull();
  });

  it('offers no Next link on the last page even when the page came back full', () => {
    const fixture = render(fullPage(CATALOG_PAGE_SIZE));

    const next = (fixture.nativeElement as HTMLElement).querySelector('#catalog-next');
    expect(next?.tagName, 'an anchor cannot carry disabled, so the inert shape is a real button').toBe(
      'BUTTON',
    );
    expect((next as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it('turns the pager into links once there is a page to turn to', () => {
    const fixture = render(fullPage(MULTI_PAGE_TOTAL));

    const next = (fixture.nativeElement as HTMLElement).querySelector('#catalog-next');
    expect(next?.tagName, 'a page turn must be a link, not a click handler').toBe('A');
    expect(harness(fixture).pageParams(LATER_PAGE_NUMBER)).toEqual({ page: LATER_PAGE_NUMBER });
  });

  it('drops the page parameter rather than writing page=1, so the first page has one URL', () => {
    const fixture = render(fullPage(MULTI_PAGE_TOTAL), [], { page: LATER_PAGE });

    expect(harness(fixture).pageParams(1)).toEqual({ page: null });
  });

  it('requests the offset a page query parameter describes', () => {
    render(fullPage(MULTI_PAGE_TOTAL));

    applyNavigation({ queryParams: { page: LATER_PAGE } });

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String(offsetOfPage(LATER_PAGE_NUMBER)));
    req.flush({ games: [], total: MULTI_PAGE_TOTAL });
  });

  it('applying filters resets to the first page and re-requests with the given params', () => {
    const fixture = render(fullPage(MULTI_PAGE_TOTAL), [], { page: LATER_PAGE });

    const h = harness(fixture);
    h.franchise.set(FRANCHISE);
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.franchise)).toBe(FRANCHISE);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('restores the controls from the URL, so a shared link opens the list it describes', async () => {
    const fixture = render({ games: [], total: 0 }, [GENRE], {
      q: SEARCH_TERM,
      franchise: FRANCHISE,
      genre: GENRE,
      aaaTier: newText(),
      kind: ContentKinds.mediaApp,
      sort: CatalogSortFields.price,
      sortDir: SortDirections.desc,
    });
    await settleNgModelWrites(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#catalog-search')?.value).toBe(SEARCH_TERM);
    expect(compiled.querySelector<HTMLInputElement>('#franchise')?.value).toBe(FRANCHISE);
    expect(selectById(compiled, CATALOG_KIND_CONTROL_ID).value).toBe(ContentKinds.mediaApp);
    expect(selectById(compiled, CATALOG_SORT_CONTROL_ID).value).toBe(catalogSortValue(CatalogSortFields.price, SortDirections.desc));
  });

  it('falls back to the defaults when the URL asks for a kind or sort that does not exist', async () => {
    const fixture = render({ games: [], total: 0 }, [], { kind: newText(), sort: newText(), sortDir: newText() });
    await settleNgModelWrites(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(selectById(compiled, CATALOG_KIND_CONTROL_ID).value).toBe(DEFAULT_CATALOG_KIND);
    expect(selectById(compiled, CATALOG_SORT_CONTROL_ID).value).toBe(catalogSortValue(CatalogSortFields.title, SortDirections.asc));
  });

  it('blocks interaction with the overlay while an in-page load is in flight, and keeps the current page visible', () => {
    const fixture = render({ games: [game(GAME_ID, GAME_TITLE)], total: MULTI_PAGE_TOTAL });
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#loading-overlay')).toBeNull();

    applyNavigation({ queryParams: { page: LATER_PAGE } });
    fixture.detectChanges();

    expect(compiled.querySelector('#loading-overlay')).not.toBeNull();
    expect(compiled.textContent).toContain(GAME_TITLE);

    httpMock
      .expectOne((r) => r.url === CuratorApi.catalogGames)
      .flush({ games: [game(OTHER_GAME_ID, OTHER_GAME_TITLE)], total: MULTI_PAGE_TOTAL });
    fixture.detectChanges();

    expect(compiled.querySelector('#loading-overlay')).toBeNull();
    expect(compiled.textContent).toContain(OTHER_GAME_TITLE);
  });

  it('lets a newer page win even when an older response comes back after it', () => {
    const supersededPage = randomIntBetween(2, MULTI_PAGE_COUNT - 1);
    const newerPage = randomIntBetween(supersededPage + 1, MULTI_PAGE_COUNT);
    render(fullPage(MULTI_PAGE_TOTAL));

    applyNavigation({ queryParams: { page: supersededPage } });
    const first = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    applyNavigation({ queryParams: { page: newerPage } });
    const second = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);

    expect(first.cancelled, 'a superseded page request must be cancelled, not merely ignored').toBe(true);
    second.flush({ games: [], total: MULTI_PAGE_TOTAL });
  });

  it('offers the resolved genres as options under an Any default, in the order resolved', () => {
    const genres = [newText(), newText(), newText()];
    const fixture = render({ games: [], total: 0 }, genres);

    const select = selectById(fixture.nativeElement, CATALOG_GENRE_CONTROL_ID);
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([ANY_OPTION_LABEL, ...genres]);
  });

  it('still renders a usable genre filter when no genres resolved', () => {
    const fixture = render({ games: [], total: 0 }, []);

    const select = selectById(fixture.nativeElement, CATALOG_GENRE_CONTROL_ID);
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([ANY_OPTION_LABEL]);
  });

  it('binds the Any option to null rather than an empty string, so an absent filter is absence', async () => {
    const fixture = render({ games: [], total: 0 }, [GENRE]);
    const select = selectById(fixture.nativeElement, CATALOG_GENRE_CONTROL_ID);

    await fixture.whenStable();

    expect(select.options[0].value, 'CODE-STYLE rule 1: the DOM token for "no genre chosen" must decode to null').not.toBe(
      '',
    );
    expect(select.value).toBe(select.options[0].value);
  });

  it('sends the selected genre as the genre filter', () => {
    const fixture = render({ games: [], total: 0 }, [GENRE]);

    const h = harness(fixture);
    h.genre.set(GENRE);
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.genre)).toBe(GENRE);
    req.flush({ games: [], total: 0 });
  });

  it('shows an error message when an in-page load fails', () => {
    const fixture = render({ games: [], total: 0 });

    harness(fixture).search.set(SEARCH_TERM);
    harness(fixture).applyFilters();
    httpMock
      .expectOne((r) => r.url === CuratorApi.catalogGames)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(CATALOG_LOAD_ERROR);
  });

  it('asks for games only, titled ascending, until the reader says otherwise', () => {
    const fixture = render({ games: [], total: 0 });

    harness(fixture).search.set(SEARCH_TERM);
    harness(fixture).applyFilters();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.kind)).toBe(DEFAULT_CATALOG_KIND);
    expect(req.request.params.get(CuratorQueryParams.sort)).toBe(CatalogSortFields.title);
    expect(req.request.params.get(CuratorQueryParams.sortDir)).toBe(SortDirections.asc);
    req.flush({ games: [], total: 0 });
  });

  it('offers every kind the models declare, and sends the chosen one from the first page', () => {
    const fixture = render(fullPage(MULTI_PAGE_TOTAL), [], { page: LATER_PAGE });
    const compiled: HTMLElement = fixture.nativeElement;

    const offered = Array.from(selectById(compiled, CATALOG_KIND_CONTROL_ID).options).map((option) => option.value);
    expect(offered).toEqual(CATALOG_KIND_OPTIONS.map((option) => option.value));

    harness(fixture).onKindChange(ContentKinds.mediaApp);

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.kind)).toBe(ContentKinds.mediaApp);
    expect(
      req.request.params.get(CuratorQueryParams.offset),
      'a kind change narrows the result set, so holding the old offset can land past its end',
    ).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('splits the chosen sort option into the field and direction Curator expects', () => {
    const fixture = render({ games: [], total: 0 });

    const offered = Array.from(selectById(fixture.nativeElement, CATALOG_SORT_CONTROL_ID).options).map((o) => o.value);
    expect(offered).toEqual(CATALOG_SORT_OPTIONS.map((option) => option.value));

    harness(fixture).onSortChange(catalogSortValue(CatalogSortFields.price, SortDirections.desc));

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.sort)).toBe(CatalogSortFields.price);
    expect(req.request.params.get(CuratorQueryParams.sortDir)).toBe(SortDirections.desc);
    req.flush({ games: [], total: 0 });
  });

  it('states a published price on the card, and renders no price line without one', () => {
    const priceCents = randomIntBetween(1, 100_000);
    const price: CatalogPriceResponse = {
      is_free: false,
      tied_to_subscription: false,
      base_cents: priceCents,
      discounted_cents: priceCents,
      discount_text: null,
      fetched_at: newUtcInstant(),
    };
    const games = [game(GAME_ID, GAME_TITLE, { price }), game(OTHER_GAME_ID, OTHER_GAME_TITLE, { price: null })];
    const fixture = render({ games, total: games.length });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-price-0')?.textContent?.trim()).toBe(priceLine(price));
    expect(compiled.querySelector('#catalog-price-1')).toBeNull();
  });

  it('counts a hundred cents to the dollar', () => {
    expect(CENTS_PER_DOLLAR).toBe(100);
  });

  it('prices a whole-dollar amount in dollars, not cents', () => {
    const dollars = randomIntBetween(1, 1_000);
    const price: CatalogPriceResponse = {
      is_free: false,
      tied_to_subscription: false,
      base_cents: dollars * CENTS_PER_DOLLAR,
      discounted_cents: dollars * CENTS_PER_DOLLAR,
      discount_text: null,
      fetched_at: newUtcInstant(),
    };

    expect(priceLine(price)).toBe(USD.format(dollars));
  });

  it('labels an entry that is not a game, and labels a game as nothing at all', () => {
    const games = [
      game(GAME_ID, OTHER_GAME_TITLE, { content_kind: ContentKinds.mediaApp }),
      game(OTHER_GAME_ID, GAME_TITLE, { content_kind: ContentKinds.game }),
    ];
    const fixture = render({ games, total: games.length });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-kind-0')?.textContent).toContain(contentKindLabel(ContentKinds.mediaApp));
    expect(compiled.querySelector('#catalog-kind-1')).toBeNull();
  });

  it('offers no page size above the ceiling /catalog/games enforces', () => {
    const fixture = render({ games: [], total: 0 });

    const offered = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#catalog-page-size option'),
    ).map((option) => Number(option.value));

    expect(offered.length).toBeGreaterThan(0);
    expect(Math.max(...offered)).toBeLessThanOrEqual(CATALOG_PAGE_SIZE_CEILING);
  });

  it('re-requests the first page at the chosen size, and remembers the choice', () => {
    const fixture = render(fullPage(MULTI_PAGE_TOTAL), [], { page: LATER_PAGE });
    const compiled: HTMLElement = fixture.nativeElement;

    const larger = String(CATALOG_PAGE_SIZE_CEILING);
    chooseSize(compiled, '#catalog-page-size', larger);
    fixture.detectChanges();

    const resized = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(resized.request.params.get(CuratorQueryParams.limit)).toBe(larger);
    expect(resized.request.params.get(CuratorQueryParams.offset)).toBe('0');
    resized.flush({ games: [], total: 0 });

    expect(readPageSize(CATALOG_PAGE_SIZE_KEY, [CATALOG_PAGE_SIZE_CEILING], CATALOG_PAGE_SIZE)).toBe(
      CATALOG_PAGE_SIZE_CEILING,
    );
  });

  it('seeds the URL from the remembered size rather than quietly loading at it', () => {
    writePageSize(CATALOG_PAGE_SIZE_KEY, CATALOG_PAGE_SIZE_CEILING);

    render(fullPage(MULTI_PAGE_TOTAL));

    expect(currentParams[CatalogQueryParams.pageSize], 'a remembered size must reach the address bar to stay shareable').toBe(
      String(CATALOG_PAGE_SIZE_CEILING),
    );
    const reload = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(reload.request.params.get(CuratorQueryParams.limit)).toBe(String(CATALOG_PAGE_SIZE_CEILING));
    reload.flush({ games: [], total: 0 });
  });

  it('leaves a URL that already names a page size alone', () => {
    writePageSize(CATALOG_PAGE_SIZE_KEY, CATALOG_PAGE_SIZE_CEILING);

    render(fullPage(MULTI_PAGE_TOTAL), [], { pageSize: String(CATALOG_PAGE_SIZE) });

    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    expect(currentParams[CatalogQueryParams.pageSize]).toBe(String(CATALOG_PAGE_SIZE));
    httpMock.expectNone((r) => r.url === CuratorApi.catalogGames);
  });
});
