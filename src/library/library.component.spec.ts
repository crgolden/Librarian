import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { LIBRARY_PAGE_SIZE_CEILING, LIBRARY_PAGE_SIZE_KEY, LibraryComponent } from './library.component';
import { LIBRARY_PAGE_SIZE, ResolvedLibrary } from './library.resolver';
import { SUMMARY_TITLE_DISPLAY_CAP } from './library-summary';
import { LIBRARY_PLATFORM_ID_PREFIX } from './library-ids';
import { pageSizeChoicesUpTo, writePageSize } from '../shared/page-size/page-size.preference';
import {
  JobStatuses,
  LibraryEntrySources,
  LibraryGameResponse,
  LibraryHiddenFilters,
  LibraryPageResponse,
  LibrarySortFields,
  ProfileLibraryGameResponse,
  PsPlusRotationSummaryResponse,
  RefreshCadences,
  RefreshScheduleResponse,
  SchedulePausedReasons,
  SortDirections,
  type StoreUnavailableReason,
  StoreUnavailableReasons,
  TrophyMatches,
  TrophyProgressReasons,
  TrophyProgressResponse,
  TrophyProgressStates,
} from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';
import { CuratorApi, CuratorQueryParams } from '../curator/curator-api';
import { AccountAnchors, AppPaths, AppUrls, RouteDataKeys, RouteParams, catalogGameUrl } from '../app/app-paths';
import {
  ALL_GENRES_LABEL,
  EMPTY_OWN_LIBRARY_MESSAGE,
  EMPTY_VIEWED_LIBRARY_MESSAGE,
  LIBRARY_FORBIDDEN_MESSAGE,
  PS_PLUS_NOT_WALKED_MESSAGE,
  STORE_MATCH_CATALOG_EMPTY_LEAD,
  TROPHY_PROGRESS_TITLES,
  TROPHY_UNMATCHED_TITLE,
  LIBRARY_LOAD_ERROR,
  REFRESH_JOB_LOST_ERROR,
  REFRESH_START_ERROR,
  USER_LIBRARY_LOAD_ERROR,
  VIEWER_TROPHY_TITLE,
} from './library.messages';
import { ResolvedStatuses } from '../shared/resolved-status';
import { HttpMethods } from '../bff/http-headers';
import { environment } from '../environments/environment';
import { newCount, newCountCeiling, newHttpsAddress, newId, newPercent, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

const GAME_ID = newId();
const OTHER_GAME_ID = newId();
const MANUAL_GAME_ID = newId();
const RUN_ID = newId();
const OTHER_SUB = newId();
const GAME_TITLE = newText();
const MANUAL_GAME_TITLE = newText();
const UNMATCHED_GAME_TITLE = newText();
const GENRE = newText();
const PSN_PRODUCT_ID = newId();
const COVER_URL = newHttpsAddress();
const LIBRARY_SEARCH_TERM = newText();
const MANUAL_SEARCH_TERM = newText();
const BROAD_SEARCH_TERM = newText();
const NARROW_SEARCH_TERM = newText();
const STORE_HIT_KIND = newText();
const REFRESH_FAILURE = newText();
const PLATFORM_A = newText();
const PLATFORM_B = newText();
const PLATFORM_C = newText();
const RAWG_RATING = newPercent();
const OPENCRITIC_RATING = newPercent();
const PSN_RATING = newPercent();
const PERCENT_COMPLETED = newPercent();
const HIDDEN_COUNT = newCount();
const NEXT_RUN_AT = newUtcInstant();
const CATALOG_WALKED_AT = newUtcInstant();

function statusOf(status: HttpStatusCode): { status: HttpStatusCode; statusText: string } {
  return { status, statusText: HttpStatusCode[status] };
}

function okLibrary(
  games: LibraryGameResponse[] | ProfileLibraryGameResponse[] = [],
  total = games.length,
  genres: string[] = [],
  schedule: RefreshScheduleResponse | null = null,
  extras: Partial<Extract<ResolvedLibrary, { status: typeof ResolvedStatuses.ok }>> = {},
): ResolvedLibrary {
  return { status: ResolvedStatuses.ok, games, total, genres, schedule, trophyProgress: null, hiddenCount: 0, psPlus: null, ...extras };
}

let queryParams$: BehaviorSubject<Params>;

function activatedRouteWithSub(
  sub: string | null,
  resolved: ResolvedLibrary = okLibrary(),
  queryParams: Params = {},
): ActivatedRoute {
  queryParams$ = new BehaviorSubject<Params>(queryParams);
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { [RouteParams.sub]: sub } : {}),
      data: { [RouteDataKeys.library]: resolved },
      queryParams,
    },
    queryParams: queryParams$.asObservable(),
  } as unknown as ActivatedRoute;
}

function setQueryParams(next: Params): void {
  queryParams$.next(next);
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

function clickById(root: HTMLElement, id: string): void {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No element with id "${id}" is rendered.`);
  }
  element.click();
}

function buttonById(root: HTMLElement, id: string): HTMLButtonElement {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`No button with id "${id}" is rendered.`);
  }
  return element;
}

function inputById(root: HTMLElement, id: string): HTMLInputElement {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`No input with id "${id}" is rendered.`);
  }
  return element;
}

function libraryRequestFor(inFlight: TestRequest[], term: string): TestRequest {
  const request = inFlight.find((r) => r.request.params.get(CuratorQueryParams.q) === term);
  if (request === undefined) {
    throw new Error(`No library request searched for "${term}".`);
  }
  return request;
}

async function failEveryRetry(
  fixture: ComponentFixture<LibraryComponent>,
  mock: HttpTestingController,
  retries: number,
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs + environment.libraryPollErrorRetryDelayMs);
    mock.expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID)).flush(null, statusOf(HttpStatusCode.BadGateway));
    fixture.detectChanges();
  }
}

function page(games: LibraryGameResponse[], total = games.length): LibraryPageResponse {
  return { games, total, trophy_progress: { state: TrophyProgressStates.on, reason: null }, hidden_count: 0 };
}

function generatedToken(): string {
  return newText();
}

function setManualSearch(fixture: ComponentFixture<LibraryComponent>, term: string): void {
  (fixture.componentInstance as unknown as { manualSearch: { set(v: string): void } }).manualSearch.set(term);
}

interface SortableHeader {
  column: { id: string };
}

interface LibraryHarness {
  headerSortParams(header: SortableHeader): Params;
  hiddenViewParams(): Params;
  table: { getHeaderGroups(): { headers: SortableHeader[] }[] };
}

function harness(fixture: ComponentFixture<LibraryComponent>): LibraryHarness {
  return fixture.componentInstance as unknown as LibraryHarness;
}

function headerFor(fixture: ComponentFixture<LibraryComponent>, columnId: string): SortableHeader {
  const header = harness(fixture)
    .table.getHeaderGroups()
    .flatMap((group) => group.headers)
    .find((candidate) => candidate.column.id === columnId);
  if (header === undefined) {
    throw new Error(`The table renders no header for column "${columnId}".`);
  }
  return header;
}

function genreHeader(fixture: ComponentFixture<LibraryComponent>): SortableHeader {
  return headerFor(fixture, LibrarySortFields.genre);
}

function titleHeader(fixture: ComponentFixture<LibraryComponent>): SortableHeader {
  return headerFor(fixture, LibrarySortFields.title);
}

function storeMatchDialog(root: HTMLElement): HTMLDialogElement {
  const element = root.querySelector('#library-store-match');
  if (!(element instanceof HTMLDialogElement)) {
    throw new Error('The Store-match dialog is not rendered.');
  }
  return element;
}

function catalogGame(gameId: string, title: string) {
  return {
    game_id: gameId,
    canonical_title: title,
    franchise: null,
    genre: null,
    aaa_tier: null,
    cover_image_url: null,
    store_product_id: null,
    critical_score: null,
    oc_score: null,
    psn_rating: null,
  };
}

interface CandidatesAnswer {
  catalog?: ReturnType<typeof catalogGame>[];
  store?: unknown[];
  already_owned?: number;
  store_consulted?: boolean;
  store_unavailable?: StoreUnavailableReason | null;
}

function flushCandidates(
  mock: HttpTestingController,
  expectedTerm: string,
  answer: CandidatesAnswer,
  expectedIncludeStore: string | null = null,
): void {
  const request = mock.expectOne((r) => r.url === CuratorApi.libraryManualCandidates);
  expect(request.request.params.get(CuratorQueryParams.q)).toBe(expectedTerm);
  expect(request.request.params.get(CuratorQueryParams.includeStore)).toBe(expectedIncludeStore);
  request.flush({
    catalog: answer.catalog ?? [],
    store: answer.store ?? [],
    already_owned: answer.already_owned ?? 0,
    store_consulted: answer.store_consulted ?? false,
    store_unavailable: answer.store_unavailable ?? null,
  });
}

function flushAddableSearch(
  mock: HttpTestingController,
  expectedTerm: string,
  addable: ReturnType<typeof catalogGame>[],
  excludedOwned = 0,
): void {
  flushCandidates(mock, expectedTerm, { catalog: addable, already_owned: excludedOwned });
}

function storeHit(id: string, name: string) {
  return {
    id,
    kind: STORE_HIT_KIND,
    game_id: null,
    default_product_id: null,
    name,
    platforms: [],
    cover_image_url: null,
    classification: null,
    price: null,
    discounted_price: null,
    is_free: null,
  };
}

const FULL_GAME: LibraryGameResponse = {
  game_id: GAME_ID,
  title: GAME_TITLE,
  genre: GENRE,
  rawg_rating: RAWG_RATING,
  opencritic_rating: OPENCRITIC_RATING,
  psn_rating: PSN_RATING,
  psn_product_id: PSN_PRODUCT_ID,
  rawg_enriched: true,
  opencritic_enriched: true,
  percent_completed: PERCENT_COMPLETED,
  source: LibraryEntrySources.psn,
  cover_image_url: COVER_URL,
  platforms: [PLATFORM_A, PLATFORM_B],
  trophy_match: TrophyMatches.matched,
};

const MANUAL_GAME: LibraryGameResponse = {
  ...FULL_GAME,
  game_id: MANUAL_GAME_ID,
  title: MANUAL_GAME_TITLE,
  psn_product_id: null,
  source: LibraryEntrySources.manual,
  platforms: [],
};

const NAVIGABLE_ROUTES = [
  { path: AppPaths.catalog, children: [] },
  { path: AppPaths.home, children: [] },
];

describe('LibraryComponent', () => {
  let httpMock: HttpTestingController;

  function interceptNavigation(): void {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation((_commands, extras) => {
      const merged: Params = { ...queryParams$.value };
      for (const [key, value] of Object.entries(extras?.queryParams ?? {})) {
        if (value === null || value === undefined) {
          delete merged[key];
        } else {
          merged[key] = String(value);
        }
      }
      queryParams$.next(merged);
      return Promise.resolve(true);
    });
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter(NAVIGABLE_ROUTES),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(null) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    interceptNavigation();
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  async function createAndLoad(
    games: LibraryGameResponse[] = [],
    total = games.length,
    genres: string[] = [],
  ): Promise<ComponentFixture<LibraryComponent>> {
    configureOwner(okLibrary(games, total, genres));
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function configureOwner(resolved: ResolvedLibrary): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter(NAVIGABLE_ROUTES),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(null, resolved) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    interceptNavigation();
  }

  it('reports the next automatic refresh from the resolved schedule, and links to where it is changed', async () => {
    configureOwner(
      okLibrary([FULL_GAME], 1, [], {
        cadence: RefreshCadences.daily,
        ps_plus_watch: false,
        next_run_at: NEXT_RUN_AT,
        last_run_at: null,
        consecutive_failures: 0,
        paused_reason: null,
      }),
    );
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#library-schedule-next')).not.toBeNull();
    expect(compiled.querySelector('#library-schedule-link')?.getAttribute('href')).toBe(AppUrls.account);
    expect(compiled.querySelector('#library-schedule-none')).toBeNull();
  });

  it('says a paused chain is paused, and sends the owner to the page that can resume it', async () => {
    configureOwner(
      okLibrary([FULL_GAME], 1, [], {
        cadence: RefreshCadences.weekly,
        ps_plus_watch: false,
        next_run_at: NEXT_RUN_AT,
        last_run_at: null,
        consecutive_failures: newCount(),
        paused_reason: SchedulePausedReasons.tooManyConsecutiveFailures,
      }),
    );
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#library-schedule-paused')).not.toBeNull();
    expect(compiled.querySelector('#library-schedule-paused')?.textContent).not.toContain(
      SchedulePausedReasons.tooManyConsecutiveFailures,
    );
    expect(compiled.querySelector('#library-schedule-next')).toBeNull();
  });

  it('offers to set a schedule up when the resolver found none', async () => {
    const fixture = await createAndLoad([FULL_GAME]);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#library-schedule-none')).not.toBeNull();
    expect(compiled.querySelector('#library-schedule-next')).toBeNull();
  });

  it('searches the shared catalog and adds the chosen game as a manual entry', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { manualSearch: { set(v: string): void } }).manualSearch.set(MANUAL_SEARCH_TERM);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, MANUAL_SEARCH_TERM, [catalogGame(MANUAL_GAME_ID, MANUAL_GAME_TITLE)]);
    fixture.detectChanges();

    clickById(compiled, 'library-manual-add-0');

    const addReq = httpMock.expectOne(CuratorApi.libraryManual);
    expect(addReq.request.method).toBe(HttpMethods.post);
    expect(addReq.request.body).toEqual({ game_id: MANUAL_GAME_ID });
    addReq.flush(null);

    httpMock.expectOne((r) => r.url === CuratorApi.library).flush(page([FULL_GAME, MANUAL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.textContent).toContain(MANUAL_GAME_TITLE);
  });

  it('marks a manual entry and removes it via the manual route, never the refresh path', async () => {
    const fixture = await createAndLoad([MANUAL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#library-manual-badge-0')).not.toBeNull();

    clickById(compiled, 'library-manual-remove-0');

    const removeReq = httpMock.expectOne(CuratorApi.libraryManualByGameId(MANUAL_GAME_ID));
    expect(removeReq.request.method).toBe(HttpMethods.delete);
    removeReq.flush(null);

    httpMock.expectOne((r) => r.url === CuratorApi.library).flush(page([]));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('confirms what it added, which the table alone cannot show when the title sorts onto another page', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, MANUAL_SEARCH_TERM);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, MANUAL_SEARCH_TERM, [catalogGame(MANUAL_GAME_ID, MANUAL_GAME_TITLE)]);
    fixture.detectChanges();

    clickById(compiled, 'library-manual-add-0');
    httpMock.expectOne(CuratorApi.libraryManual).flush(null);
    httpMock.expectOne((r) => r.url === CuratorApi.library).flush(page([FULL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('#library-manual-added')?.textContent).toContain(MANUAL_GAME_TITLE);
  });

  it('says a game is already owned when the server declines the add, rather than reporting a failure', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, MANUAL_SEARCH_TERM);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, MANUAL_SEARCH_TERM, [catalogGame(MANUAL_GAME_ID, MANUAL_GAME_TITLE)]);
    fixture.detectChanges();

    clickById(compiled, 'library-manual-add-0');
    httpMock
      .expectOne(CuratorApi.libraryManual)
      .flush({ detail: newText() },statusOf(HttpStatusCode.Conflict));
    fixture.detectChanges();

    expect(compiled.textContent).toContain(`${MANUAL_GAME_TITLE} is already in your library`);
    expect(compiled.querySelector('#library-manual-added')).toBeNull();
  });

  it('cannot start a second manual search over the first, which would race the same way', async () => {
    const searchedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');
    fixture.detectChanges();

    expect(buttonById(compiled, 'library-manual-search-submit').disabled).toBe(true);

    flushAddableSearch(httpMock, searchedTitle, [catalogGame(generatedToken(), generatedToken())]);
    fixture.detectChanges();

    expect(buttonById(compiled, 'library-manual-search-submit').disabled).toBe(false);
  });

  it('lets a newer search win even when an older response comes back after it', async () => {
    const staleTitle = generatedToken();
    const freshTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    const searchBox = inputById(compiled, 'library-search');

    searchBox.value = BROAD_SEARCH_TERM;
    searchBox.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);

    searchBox.value = NARROW_SEARCH_TERM;
    searchBox.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);

    const inFlight = httpMock.match((r) => r.url === CuratorApi.library);
    const broad = libraryRequestFor(inFlight, BROAD_SEARCH_TERM);
    const narrow = libraryRequestFor(inFlight, NARROW_SEARCH_TERM);

    expect(broad.cancelled).toBe(true);

    narrow.flush(page([{ ...FULL_GAME, game_id: generatedToken(), title: freshTitle }]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain(freshTitle);
    expect(compiled.textContent).not.toContain(staleTitle);
  });

  it('asks the server to leave out what the owner already has, rather than filtering a page itself', async () => {
    const searchedTitle = generatedToken();
    const addableTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, searchedTitle, [catalogGame(generatedToken(), addableTitle)]);
    fixture.detectChanges();

    const offered = [...compiled.querySelectorAll('#library-manual-results [id^="library-manual-title-"]')].map((el) =>
      el.textContent?.trim(),
    );
    expect(offered).toEqual([addableTitle]);
    expect(compiled.querySelector('#library-manual-all-owned')).toBeNull();
  });

  it('says every match is already owned rather than spending a Store search on it', async () => {
    const searchedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, searchedTitle, [], newCount());
    fixture.detectChanges();

    expect(compiled.querySelector('#library-manual-all-owned')).not.toBeNull();
    expect(compiled.querySelectorAll('#library-manual-results li')).toHaveLength(0);
    expect(compiled.querySelector('#library-manual-check-store')).not.toBeNull();
    expect(compiled.querySelector('#library-manual-not-yours')).toBeNull();
    httpMock.expectNone((r) => r.url === CuratorApi.libraryManualCandidates);
  });

  it('reaches the Store even when the catalog returned matches that were not the right game', async () => {
    const searchedTitle = generatedToken();
    const conceptId = generatedToken();
    const wrongGame = catalogGame(generatedToken(), generatedToken());
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushAddableSearch(httpMock, searchedTitle, [wrongGame]);
    fixture.detectChanges();

    clickById(compiled, 'library-manual-check-store');

    flushCandidates(
      httpMock,
      searchedTitle,
      { catalog: [wrongGame], store: [storeHit(conceptId, generatedToken())], store_consulted: true },
      String(true),
    );
    fixture.detectChanges();

    expect(storeMatchDialog(compiled).open).toBe(true);
    expect(compiled.querySelector('#library-store-match-query')?.textContent).not.toContain(STORE_MATCH_CATALOG_EMPTY_LEAD);
  });

  it('proposes what Curator says the Store carries when the catalog had nothing to offer', async () => {
    const searchedTitle = generatedToken();
    const proposedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushCandidates(httpMock, searchedTitle, {
      store: [storeHit(generatedToken(), proposedTitle)],
      store_consulted: true,
    });
    fixture.detectChanges();

    expect(storeMatchDialog(compiled).open).toBe(true);
    expect(compiled.querySelector('#library-store-candidate-name-0')?.textContent).toContain(proposedTitle);
    expect(compiled.querySelector('#library-store-match-query')?.textContent).toContain(STORE_MATCH_CATALOG_EMPTY_LEAD);
  });

  it('sends the search term back with the chosen id, because the server re-runs the search to verify it', async () => {
    const searchedTitle = generatedToken();
    const conceptId = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushCandidates(httpMock, searchedTitle, {
      store: [storeHit(conceptId, generatedToken())],
      store_consulted: true,
    });
    fixture.detectChanges();

    clickById(compiled, 'library-store-accept-0');

    const addReq = httpMock.expectOne(CuratorApi.libraryManual);
    expect(addReq.request.method).toBe(HttpMethods.post);
    expect(addReq.request.body).toEqual({ store_hit: { query: searchedTitle, id: conceptId } });
    addReq.flush(null);

    httpMock.expectOne((r) => r.url === CuratorApi.library).flush(page([FULL_GAME, MANUAL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeMatchDialog(compiled).open).toBe(false);
  });

  it('adds nothing when the proposed match is declined', async () => {
    const searchedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushCandidates(httpMock, searchedTitle, {
      store: [storeHit(generatedToken(), generatedToken())],
      store_consulted: true,
    });
    fixture.detectChanges();

    clickById(compiled, 'library-store-match-cancel');
    fixture.detectChanges();

    expect(storeMatchDialog(compiled).open).toBe(false);
    expect(compiled.querySelector('#library-store-candidate-name-0')).toBeNull();
    httpMock.expectNone(CuratorApi.libraryManual);
  });

  it('reports an unlinked account as a state rather than a failure when the Store cannot be checked', async () => {
    const searchedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushCandidates(httpMock, searchedTitle, { store_unavailable: StoreUnavailableReasons.noPsnLink });
    fixture.detectChanges();

    expect(compiled.querySelector('#library-store-unlinked')).not.toBeNull();
    expect(storeMatchDialog(compiled).open).toBe(false);
  });

  it('says so when neither the catalog nor the Store carries the title', async () => {
    const searchedTitle = generatedToken();
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    clickById(compiled, 'library-add-manual-toggle');
    fixture.detectChanges();
    setManualSearch(fixture, searchedTitle);
    fixture.detectChanges();
    clickById(compiled, 'library-manual-search-submit');

    flushCandidates(httpMock, searchedTitle, { store: [], store_consulted: true });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(searchedTitle);
    expect(storeMatchDialog(compiled).open).toBe(false);
  });

  it('offers no manual controls on a PSN-sourced entry', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#library-manual-badge-0')).toBeNull();
    expect(compiled.querySelector('#library-manual-remove-0')).toBeNull();
  });

  it('triggers a refresh, polls until succeeded, and shows a success message', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID))
      .flush({ run_id: RUN_ID, status: JobStatuses.running, error: null, result_summary: null });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID))
      .flush({ run_id: RUN_ID, status: JobStatuses.succeeded, error: null, result_summary: null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('#library-refresh-succeeded')).not.toBeNull();

    httpMock.expectOne((req) => req.url === CuratorApi.library).flush(page([]));
    httpMock.expectOne(CuratorApi.libraryGenres).flush({ genres: [] });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectNone(CuratorApi.libraryRefreshByRunId(RUN_ID));
  });

  it('shows the job error message on a failed refresh', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID))
      .flush({ run_id: RUN_ID, status: JobStatuses.failed, error: REFRESH_FAILURE, result_summary: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(REFRESH_FAILURE);

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectNone(CuratorApi.libraryRefreshByRunId(RUN_ID));
  });

  it('explains a cancelled refresh as a terminal state rather than an unexpected status', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID))
      .flush({ run_id: RUN_ID, status: JobStatuses.cancelled, error: null, result_summary: null });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#library-refresh-cancelled')).not.toBeNull();
    expect(compiled.querySelector('#library-refresh-unexpected')).toBeNull();

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectNone(CuratorApi.libraryRefreshByRunId(RUN_ID));
  });

  it('retries a single transient poll failure instead of losing track of the job', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID)).flush(null, statusOf(HttpStatusCode.BadGateway));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(REFRESH_JOB_LOST_ERROR);

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs + environment.libraryPollErrorRetryDelayMs);
    httpMock
      .expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID))
      .flush({ run_id: RUN_ID, status: JobStatuses.succeeded, error: null, result_summary: null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('#library-refresh-succeeded')).not.toBeNull();

    httpMock.expectOne((req) => req.url === CuratorApi.library).flush(page([]));
    httpMock.expectOne(CuratorApi.libraryGenres).flush({ genres: [] });
  });

  it('gives up and shows "Lost track" only after exhausting the retry budget', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID)).flush(null, statusOf(HttpStatusCode.BadGateway));
    fixture.detectChanges();

    await failEveryRetry(fixture, httpMock, environment.libraryPollErrorRetryCount);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(REFRESH_JOB_LOST_ERROR);
  });

  it('shows an error when the refresh trigger itself fails', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(REFRESH_START_ERROR);
  });

  it('links to RAWG when a listed entry carries their enrichment', async () => {
    const fixture = await createAndLoad([FULL_GAME]);

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();
  });

  it('reads the stored flag rather than the rating, so an unenriched row claims nothing', async () => {
    const fixture = await createAndLoad([{ ...FULL_GAME, rawg_enriched: false }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('renders the post-refresh summary, capping the inline title list', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    const titlesPastTheCap = newCountCeiling();
    const manyTitles = Array.from({ length: SUMMARY_TITLE_DISPLAY_CAP + titlesPastTheCap }, () => newText());
    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID)).flush({
      run_id: RUN_ID,
      status: JobStatuses.succeeded,
      error: null,
      result_summary: {
        rawg_enriched_titles: manyTitles,
        opencritic_enriched_titles: [GAME_TITLE],
        opencritic_topup_incomplete: true,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === CuratorApi.library).flush(page([]));
    httpMock.expectOne(CuratorApi.libraryGenres).flush({ genres: [] });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(manyTitles[0]);
    expect(text).toContain(manyTitles[SUMMARY_TITLE_DISPLAY_CAP - 1]);
    expect(text).not.toContain(manyTitles[SUMMARY_TITLE_DISPLAY_CAP]);
    expect((fixture.nativeElement as HTMLElement).querySelector('#library-summary-rawg')?.getAttribute('data-more-count')).toBe(
      String(titlesPastTheCap),
    );
    expect(text).toContain(GAME_TITLE);
    expect((fixture.nativeElement as HTMLElement).querySelector('#library-summary-opencritic-topup')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();
  });

  it('does not render a topup-incomplete message when the top-up finished', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne(CuratorApi.libraryRefresh).flush({ run_id: RUN_ID });

    await vi.advanceTimersByTimeAsync(environment.libraryPollIntervalMs);
    httpMock.expectOne(CuratorApi.libraryRefreshByRunId(RUN_ID)).flush({
      run_id: RUN_ID,
      status: JobStatuses.succeeded,
      error: null,
      result_summary: { rawg_enriched_titles: [], opencritic_enriched_titles: [], opencritic_topup_incomplete: false },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === CuratorApi.library).flush(page([]));
    httpMock.expectOne(CuratorApi.libraryGenres).flush({ genres: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#library-summary-opencritic-topup')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('shows a message when the library is empty', async () => {
    const fixture = await createAndLoad([]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(EMPTY_OWN_LIBRARY_MESSAGE);
  });

  it('renders numeric ratings, genre, and a dash for unresolved values', async () => {
    const games: LibraryGameResponse[] = [
      FULL_GAME,
      {
        game_id: OTHER_GAME_ID,
        title: UNMATCHED_GAME_TITLE,
        genre: null,
        rawg_rating: null,
        opencritic_rating: null,
        psn_rating: null,
        psn_product_id: null,
        rawg_enriched: false,
        opencritic_enriched: false,
        percent_completed: null,
        trophy_match: TrophyMatches.unmatched,
        source: LibraryEntrySources.psn,
        cover_image_url: null,
        platforms: [],
      },
    ];
    const fixture = await createAndLoad(games);
    const compiled: HTMLElement = fixture.nativeElement;

    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(games.length);
    expect(rows[0].textContent).toContain(GAME_TITLE);
    expect(rows[0].textContent).toContain(GENRE);
    expect(rows[0].textContent).toContain(String(RAWG_RATING));
    expect(rows[0].textContent).toContain(String(OPENCRITIC_RATING));
    expect(rows[0].textContent).toContain(String(PSN_RATING));
    expect(rows[0].textContent).toContain(`${PERCENT_COMPLETED}%`);
    expect(rows[1].textContent).toContain(UNMATCHED_GAME_TITLE);
    expect(rows[1].textContent).toContain('—');
  });

  it('renders one spine label per platform, in the order the API returned them', async () => {
    const fixture = await createAndLoad([{ ...FULL_GAME, platforms: [PLATFORM_B, PLATFORM_A, PLATFORM_C] }]);
    const compiled: HTMLElement = fixture.nativeElement;

    const labels = compiled.querySelectorAll(`tbody tr [id^="library-platforms-"] [id^="${LIBRARY_PLATFORM_ID_PREFIX}"]`);
    expect([...labels].map((label) => label.textContent?.trim())).toEqual([PLATFORM_B, PLATFORM_A, PLATFORM_C]);
  });

  it('renders a dash rather than an empty cell for an entry with no platform', async () => {
    const fixture = await createAndLoad([MANUAL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    const cell = compiled.querySelector('tbody tr td[data-label="Platforms"]');
    expect(cell?.querySelectorAll(`[id^="${LIBRARY_PLATFORM_ID_PREFIX}"]`).length).toBe(0);
    expect(cell?.textContent?.trim()).toBe('—');
  });

  it('renders cover art when present, nothing when absent', async () => {
    const fixture = await createAndLoad([
      FULL_GAME,
      { ...FULL_GAME, game_id: OTHER_GAME_ID, title: newText(), cover_image_url: null },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;
    const rows = compiled.querySelectorAll('tbody tr');

    const img = rows[0].querySelector('img[id^="library-cover-"]');
    expect(img?.getAttribute('src')).toBe(COVER_URL);
    expect(img?.getAttribute('alt')).toBe(GAME_TITLE);
    expect(rows[1].querySelector('img[id^="library-cover-"]')).toBeNull();
  });

  it('links every row to its catalog page, including one with no PS Store product id', async () => {
    const fixture = await createAndLoad([
      FULL_GAME,
      {
        game_id: OTHER_GAME_ID,
        title: newText(),
        genre: null,
        rawg_rating: null,
        opencritic_rating: null,
        psn_rating: null,
        psn_product_id: null,
        rawg_enriched: false,
        opencritic_enriched: false,
        percent_completed: null,
        trophy_match: TrophyMatches.notAttempted,
        source: LibraryEntrySources.psn,
        cover_image_url: null,
        platforms: [],
      },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;
    const rows = compiled.querySelectorAll('tbody tr');

    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe(catalogGameUrl(GAME_ID));
    expect(rows[1].querySelector('a')?.getAttribute('href')).toBe(catalogGameUrl(OTHER_GAME_ID));
  });

  it('searches by title, debounced, resetting to the first page', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#library-search');

    input.value = LIBRARY_SEARCH_TERM;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    httpMock.expectNone((req) => req.url === CuratorApi.library && req.params.get(CuratorQueryParams.q) === LIBRARY_SEARCH_TERM);

    await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);
    const req = httpMock.expectOne((r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.q) === LIBRARY_SEARCH_TERM);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe('0');
    req.flush(page([FULL_GAME]));
  });

  it('drops a search still waiting on its debounce once the reader navigates to another page', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#library-search');
    input.value = LIBRARY_SEARCH_TERM;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    void TestBed.inject(Router).navigateByUrl(AppUrls.catalog);
    await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);

    expect(queryParams$.value[CuratorQueryParams.q]).toBeUndefined();
    httpMock.expectNone((req) => req.url === CuratorApi.library && req.params.get(CuratorQueryParams.q) === LIBRARY_SEARCH_TERM);
  });

  it('keeps a search still waiting on its debounce when a navigation stays on this page', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#library-search');
    input.value = LIBRARY_SEARCH_TERM;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const router = TestBed.inject(Router);

    void router.navigateByUrl(router.createUrlTree([AppUrls.home], { queryParams: { [newText()]: newText() } }));
    await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);

    expect(queryParams$.value[CuratorQueryParams.q]).toBe(LIBRARY_SEARCH_TERM);
    const req = httpMock.expectOne((r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.q) === LIBRARY_SEARCH_TERM);
    req.flush(page([FULL_GAME]));
  });

  it('filters by genre, resetting to the first page', async () => {
    const fixture = await createAndLoad([FULL_GAME], 1, [GENRE]);
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#library-genre-filter');

    select.value = GENRE;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.genre) === GENRE);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe('0');
    req.flush(page([FULL_GAME]));
  });

  it('shows All genres when no genre filter is in the URL', async () => {
    const fixture = await createAndLoad([FULL_GAME], 1, [GENRE]);
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#library-genre-filter');

    await fixture.whenStable();

    expect(
      select.selectedOptions[0]?.textContent?.trim(),
      'An unfiltered genre is null, so the "All genres" option must bind [ngValue]="null"; bound to "" the accessor matches no option and the control renders blank.',
    ).toBe(ALL_GENRES_LABEL);
  });

  it('offers each sortable column header as a link, never a clickable cell', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    const genre = compiled.querySelector('#library-sort-genre');
    expect(genre?.tagName, 'a header that changes the URL is a link, not a clickable <th>').toBe('A');
    expect(
      compiled.querySelector('th[tabindex]'),
      'a hand-rolled tabindex plus keydown pair is what the anchor replaces',
    ).toBeNull();
    expect(compiled.querySelector('#library-sort-cover'), 'an unsortable column offers no link').toBeNull();
  });

  it('sorts ascending on a first request for a column and flips direction once it is the active sort', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const h = harness(fixture);

    expect(h.headerSortParams(genreHeader(fixture))).toEqual({ sort: LibrarySortFields.genre, sortDir: null, page: null });

    setQueryParams({ sort: LibrarySortFields.genre });
    fixture.detectChanges();
    httpMock
      .expectOne(
        (r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.sort) === LibrarySortFields.genre && r.params.get(CuratorQueryParams.sortDir) === SortDirections.asc,
      )
      .flush(page([FULL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(h.headerSortParams(genreHeader(fixture))).toEqual({ sort: LibrarySortFields.genre, sortDir: SortDirections.desc, page: null });
  });

  it('drops the sort parameters rather than writing the defaults, so the default view has one URL', async () => {
    const fixture = await createAndLoad([FULL_GAME]);

    expect(
      harness(fixture).headerSortParams(titleHeader(fixture)),
      'title ascending is the default view, so its own link is the one that flips to descending',
    ).toEqual({ sort: null, sortDir: SortDirections.desc, page: null });

    setQueryParams({ sort: LibrarySortFields.title, sortDir: SortDirections.desc });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === CuratorApi.library).flush(page([FULL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      harness(fixture).headerSortParams(titleHeader(fixture)),
      'returning to the default sort writes neither parameter, so there is exactly one URL for it',
    ).toEqual({ sort: null, sortDir: null, page: null });
  });

  it('offers genre ascending first even when every row has no genre', async () => {
    const fixture = await createAndLoad([{ ...FULL_GAME, genre: null }]);

    expect(
      harness(fixture).headerSortParams(genreHeader(fixture)),
      'The table infers a column\'s first sort direction by sampling the first ten rows and falls back to "desc" when it finds no non-nullish value, so a library with no genres would once have opened the Genre sort backwards. The direction is now computed from the URL rather than the data, so the rows cannot decide it.',
    ).toEqual({ sort: LibrarySortFields.genre, sortDir: null, page: null });
  });

  it('pages through results, offering Previous/Next as links only where there is a page to reach', async () => {
    const lastPage = randomIntBetween(2, LIBRARY_PAGE_SIZE);
    const lastPageOffset = LIBRARY_PAGE_SIZE * (lastPage - 1);
    const multiPageTotal = lastPageOffset + randomIntBetween(1, LIBRARY_PAGE_SIZE);
    const fixture = await createAndLoad([FULL_GAME], multiPageTotal);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#library-prev')?.tagName).toBe('BUTTON');
    expect(compiled.querySelector('#library-next')?.tagName, 'a page turn is a link, not a click handler').toBe('A');

    setQueryParams({ page: String(lastPage) });
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.offset) === String(lastPageOffset));
    req.flush(page([FULL_GAME], multiPageTotal));
    fixture.detectChanges();

    expect(compiled.querySelector('#library-prev')?.tagName).toBe('A');
  });

  it('labels the pager as a range within the total, in the form the catalog and collections use', async () => {
    const lastPage = randomIntBetween(2, LIBRARY_PAGE_SIZE);
    const lastPageOffset = LIBRARY_PAGE_SIZE * (lastPage - 1);
    const seededTotal = lastPageOffset + randomIntBetween(1, LIBRARY_PAGE_SIZE);
    const fixture = await createAndLoad([FULL_GAME], seededTotal);
    const compiled: HTMLElement = fixture.nativeElement;
    const range = (): string | undefined => compiled.querySelector('#library-page-range')?.textContent?.trim();

    expect(range()).toBe(`1–${LIBRARY_PAGE_SIZE} of ${seededTotal}`);

    setQueryParams({ page: String(lastPage) });
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === CuratorApi.library && r.params.get(CuratorQueryParams.offset) === String(lastPageOffset))
      .flush(page([FULL_GAME], seededTotal));
    fixture.detectChanges();

    expect(range()).toBe(`${lastPageOffset + 1}–${seededTotal} of ${seededTotal}`);
  });

  it('opens a deep link straight at the library page the URL names', async () => {
    const deepPage = randomIntBetween(2, LIBRARY_PAGE_SIZE);
    const deepTotal = LIBRARY_PAGE_SIZE * deepPage;
    configureOwner(okLibrary([FULL_GAME], deepTotal));
    queryParams$.next({ page: String(deepPage) });
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.library);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String(LIBRARY_PAGE_SIZE * (deepPage - 1)));
    req.flush(page([FULL_GAME], deepTotal));
  });

  it('shows an error when the resolver could not load the library', async () => {
    configureOwner({ status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(LIBRARY_LOAD_ERROR);
  });

  describe('the PlayStation Plus rotation summary', () => {
    const WATCHING_SCHEDULE: RefreshScheduleResponse = {
      cadence: RefreshCadences.weekly,
      ps_plus_watch: true,
      next_run_at: NEXT_RUN_AT,
      last_run_at: null,
      consecutive_failures: 0,
      paused_reason: null,
    };

    async function createWithPsPlus(
      psPlus: PsPlusRotationSummaryResponse | null,
    ): Promise<ComponentFixture<LibraryComponent>> {
      configureOwner(okLibrary([FULL_GAME], 1, [], WATCHING_SCHEDULE, { psPlus }));
      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('counts what is unclaimed and leaving, and sends the owner to the rotation page', async () => {
      const UNCLAIMED_COUNT = newCount();
      const LEAVING_COUNT = newCountCeiling();
      const fixture = await createWithPsPlus({
        catalog_walked_at: CATALOG_WALKED_AT,
        unclaimed: UNCLAIMED_COUNT,
        leaving: LEAVING_COUNT,
      });

      const compiled: HTMLElement = fixture.nativeElement;
      const summary = compiled.querySelector('#library-ps-plus-summary');
      expect(summary?.textContent).toContain(String(UNCLAIMED_COUNT));
      expect(summary?.textContent).toContain(String(LEAVING_COUNT));
      expect(compiled.querySelector('#library-ps-plus-link')?.getAttribute('href')).toBe(AppUrls.psPlus);
    });

    it('says the catalog has not been walked rather than reporting zero of everything', async () => {
      const fixture = await createWithPsPlus({ catalog_walked_at: null, unclaimed: 0, leaving: 0 });

      expect((fixture.nativeElement as HTMLElement).querySelector('#library-ps-plus-summary')?.textContent).toContain(PS_PLUS_NOT_WALKED_MESSAGE);
    });

    it('renders no summary at all when the resolver supplied none', async () => {
      const fixture = await createWithPsPlus(null);

      expect((fixture.nativeElement as HTMLElement).querySelector('#library-ps-plus-summary')).toBeNull();
    });
  });

  describe('hiding a game', () => {
    async function createOwner(resolved: ResolvedLibrary): Promise<ComponentFixture<LibraryComponent>> {
      configureOwner(resolved);
      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('offers no hidden view until something is hidden', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1));

      expect((fixture.nativeElement as HTMLElement).querySelector('#library-show-hidden')).toBeNull();
    });

    it('counts the hidden games on the control that reveals them', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1, [], null, { hiddenCount: HIDDEN_COUNT }));

      expect((fixture.nativeElement as HTMLElement).querySelector('#library-show-hidden')?.textContent).toContain(String(HIDDEN_COUNT));
    });

    it('hides a row through the hidden route and reloads the list without it', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1));

      clickById(fixture.nativeElement, `library-hide-${FULL_GAME.game_id}`);
      fixture.detectChanges();

      const hide = httpMock.expectOne(CuratorApi.libraryByGameIdHidden(FULL_GAME.game_id));
      expect(hide.request.method).toBe(HttpMethods.put);
      hide.flush(null, statusOf(HttpStatusCode.NoContent));
      fixture.detectChanges();

      const reload = httpMock.expectOne((r) => r.url === CuratorApi.library);
      expect(reload.request.params.get(CuratorQueryParams.hidden)).toBeNull();
      reload.flush({ games: [], total: 0, hidden_count: HIDDEN_COUNT });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('#library-show-hidden')?.textContent).toContain(String(HIDDEN_COUNT));
    });

    it('reports a failed hide against the title it could not hide', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1));

      clickById(fixture.nativeElement, `library-hide-${FULL_GAME.game_id}`);
      fixture.detectChanges();
      httpMock
        .expectOne(CuratorApi.libraryByGameIdHidden(FULL_GAME.game_id))
        .flush(null, statusOf(HttpStatusCode.InternalServerError));
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(`Unable to hide ${FULL_GAME.title}`);
    });

    it('offers the hidden view as a link carrying hidden=only', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1, [], null, { hiddenCount: 1 }));

      const toggle = (fixture.nativeElement as HTMLElement).querySelector('#library-show-hidden');
      expect(toggle?.tagName, 'a control that changes the URL is a link, not a click handler').toBe('A');
      expect(harness(fixture).hiddenViewParams()).toEqual({ hidden: LibraryHiddenFilters.only, page: null });
    });

    it('the hidden view asks Curator for the hidden rows only, and offers to show one again', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1, [], null, { hiddenCount: 1 }));

      setQueryParams({ hidden: LibraryHiddenFilters.only });
      fixture.detectChanges();

      const hiddenOnly = httpMock.expectOne((r) => r.url === CuratorApi.library);
      expect(hiddenOnly.request.params.get(CuratorQueryParams.hidden)).toBe(LibraryHiddenFilters.only);
      expect(hiddenOnly.request.params.get(CuratorQueryParams.offset)).toBe('0');
      hiddenOnly.flush(page([FULL_GAME], 1));
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector(`#library-unhide-${FULL_GAME.game_id}`)).not.toBeNull();
      expect(compiled.querySelector(`#library-hide-${FULL_GAME.game_id}`)).toBeNull();

      clickById(compiled, `library-unhide-${FULL_GAME.game_id}`);
      fixture.detectChanges();

      const unhide = httpMock.expectOne(CuratorApi.libraryByGameIdHidden(FULL_GAME.game_id));
      expect(unhide.request.method).toBe(HttpMethods.delete);
      unhide.flush(null, statusOf(HttpStatusCode.NoContent));
      fixture.detectChanges();
      httpMock.expectOne((r) => r.url === CuratorApi.library).flush({ games: [], total: 0, hidden_count: 0 });
      fixture.detectChanges();
    });

    it('says nothing is hidden, rather than inviting a refresh the way an empty library does', async () => {
      const fixture = await createOwner(okLibrary([FULL_GAME], 1, [], null, { hiddenCount: 1 }));

      setQueryParams({ hidden: LibraryHiddenFilters.only });
      fixture.detectChanges();
      httpMock
        .expectOne((r) => r.url === CuratorApi.library)
        .flush({ games: [], total: 0, hidden_count: 0 });
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#library-hidden-empty')).not.toBeNull();
      expect(compiled.querySelector('#library-empty')).toBeNull();
    });

  });

  describe('trophy progress in owner mode', () => {
    async function createOwner(
      trophyProgress: TrophyProgressResponse | null,
      games: LibraryGameResponse[] = [FULL_GAME],
    ): Promise<ComponentFixture<LibraryComponent>> {
      configureOwner(okLibrary(games, games.length, [], null, { trophyProgress }));
      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('offers the trophy setting from the column header when harvesting is off', async () => {
      const fixture = await createOwner({ state: TrophyProgressStates.off, reason: TrophyProgressReasons.harvestOff });

      const link = (fixture.nativeElement as HTMLElement).querySelector('#library-header-percent_completed-link');
      expect(link?.getAttribute('href')).toBe(`${AppUrls.account}#${AccountAnchors.trophies}`);
    });

    it('offers no such link once trophies are being harvested', async () => {
      const fixture = await createOwner({ state: TrophyProgressStates.on, reason: null });

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#library-header-percent_completed-link'),
      ).toBeNull();
    });

    it('explains an empty column by the reason Curator gave, not by a generic dash', async () => {
      const fixture = await createOwner({ state: TrophyProgressStates.off, reason: TrophyProgressReasons.noLink }, [
        { ...FULL_GAME, percent_completed: null },
      ]);

      const cell = (fixture.nativeElement as HTMLElement).querySelector('td[data-label="% Completed"]');
      expect(cell?.textContent?.trim()).toBe('—');
      expect(cell?.getAttribute('title')).toBe(TROPHY_PROGRESS_TITLES[TrophyProgressReasons.noLink]);
    });

    it('says a refresh has not matched this title yet when only that row is unmatched', async () => {
      const fixture = await createOwner({ state: TrophyProgressStates.on, reason: null }, [
        { ...FULL_GAME, percent_completed: null, trophy_match: TrophyMatches.unmatched },
      ]);

      const cell = (fixture.nativeElement as HTMLElement).querySelector('td[data-label="% Completed"]');
      expect(cell?.getAttribute('title')).toBe(TROPHY_UNMATCHED_TITLE);
    });
  });

  describe('viewer mode', () => {
    function configureForViewer(routeSub: string, ownSub: string | null, resolved: ResolvedLibrary = okLibrary()): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [LibraryComponent],
        providers: [
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: activatedRouteWithSub(routeSub, resolved) },
          { provide: AuthService, useValue: authServiceWithSub(ownSub) },
        ],
      });
      httpMock = TestBed.inject(HttpTestingController);
      interceptNavigation();
    }

    it('shows no schedule summary at all on another user\'s library', async () => {
      configureForViewer(OTHER_SUB, null, okLibrary([FULL_GAME]));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#library-schedule-next')).toBeNull();
      expect(compiled.querySelector('#library-schedule-none')).toBeNull();
      expect(compiled.querySelector('#library-schedule-paused')).toBeNull();
    });

    it('renders another user\'s library read-only, with no refresh button', async () => {
      const games: ProfileLibraryGameResponse[] = [FULL_GAME];
      configureForViewer(OTHER_SUB, null, okLibrary(games));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain(GAME_TITLE);
      expect(compiled.querySelector('#library-refresh')).toBeNull();
      httpMock.expectNone(CuratorApi.library);
    });

    it("shows a dash with an explanatory title for % Completed on another user's library", async () => {
      const games: ProfileLibraryGameResponse[] = [{ ...FULL_GAME, percent_completed: null }];
      configureForViewer(OTHER_SUB, null, okLibrary(games));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      const cell = compiled.querySelector('td[data-label="% Completed"]');
      expect(cell?.textContent?.trim()).toBe('—');
      expect(cell?.getAttribute('title')).toBe(VIEWER_TROPHY_TITLE);
    });

    it('shows an empty state for another user with no games', async () => {
      configureForViewer(OTHER_SUB, null, okLibrary([]));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(EMPTY_VIEWED_LIBRARY_MESSAGE);
    });

    it('shows an inline message when the resolver reports the section is not public', async () => {
      configureForViewer(OTHER_SUB, null, { status: ResolvedStatuses.forbidden });

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const forbidden = (fixture.nativeElement as HTMLElement).querySelector('#library-forbidden');
      expect(forbidden?.textContent).toContain(LIBRARY_FORBIDDEN_MESSAGE);
      expect(
        forbidden?.textContent,
        'The viewer is offered a working Follow button on the profile immediately after seeing this, and '
          + 'following can never grant library access: library_visible is (is_public AND show_library) on '
          + 'the OWNER, with the follow graph absent from it. The message has to say so, or the only '
          + 'actionable control in reach reads as the remedy.',
      ).toContain(LIBRARY_FORBIDDEN_MESSAGE);
    });

    it('reports a 403 that arrives from a later load, not only one the resolver saw', async () => {
      configureForViewer(OTHER_SUB, null, okLibrary([FULL_GAME]));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      const searchBox = inputById(compiled, 'library-search');
      searchBox.value = generatedToken();
      searchBox.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(environment.librarySearchDebounceMs);

      httpMock
        .expectOne((r) => r.url === CuratorApi.usersBySubLibrary(OTHER_SUB))
        .flush({ detail: newText() },statusOf(HttpStatusCode.Forbidden));
      fixture.detectChanges();

      expect(compiled.querySelector('#library-forbidden')?.textContent).toContain(LIBRARY_FORBIDDEN_MESSAGE);
    });

    it('offers no hide control and no hidden view on another user\'s library, even from a hidden=only URL', async () => {
      configureForViewer(OTHER_SUB, null, okLibrary([FULL_GAME], 1, [], null, { hiddenCount: newCount() }));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector(`#library-hide-${FULL_GAME.game_id}`)).toBeNull();
      expect(
        compiled.querySelector('#library-show-hidden'),
        `hidden_count is the owner's own figure; offe${LIBRARY_SEARCH_TERM} a viewer the hidden view would ask Curator for `
          + 'rows it will refuse and tell the viewer how many titles the owner has hidden',
      ).toBeNull();

      setQueryParams({ hidden: LibraryHiddenFilters.only });
      fixture.detectChanges();

      const viewerLoad = httpMock.expectOne((r) => r.url === CuratorApi.usersBySubLibrary(OTHER_SUB));
      expect(
        viewerLoad.request.params.get(CuratorQueryParams.hidden),
        'the hidden filter is an owner-only query; a typed URL must not carry it onto another user\'s library',
      ).toBeNull();
      viewerLoad.flush({ games: [FULL_GAME], total: 1 });
    });

    it('shows a generic error message when the resolver reports a non-403 failure', async () => {
      configureForViewer(OTHER_SUB, null, { status: ResolvedStatuses.error });

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(USER_LIBRARY_LOAD_ERROR);
    });
  });

  it('offers no page size above the ceiling /library enforces', async () => {
    const fixture = await createAndLoad([FULL_GAME]);

    const offered = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#library-page-size option'),
    ).map((option) => Number(option.value));
    const aboveTheCeiling = pageSizeChoicesUpTo(Math.max(...environment.pageSizeChoices), LIBRARY_PAGE_SIZE).filter(
      (choice) => choice > LIBRARY_PAGE_SIZE_CEILING,
    );

    expect(offered.length).toBeGreaterThan(0);
    expect(aboveTheCeiling.length).toBeGreaterThan(0);
    expect(offered).not.toContain(aboveTheCeiling[0]);
  });

  it('loads at the remembered size rather than the size the resolver used', async () => {
    writePageSize(LIBRARY_PAGE_SIZE_KEY, LIBRARY_PAGE_SIZE_CEILING);
    configureOwner(okLibrary([FULL_GAME], 1));

    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const reload = httpMock.expectOne((r) => r.url === CuratorApi.library);
    expect(reload.request.params.get(CuratorQueryParams.limit)).toBe(String(LIBRARY_PAGE_SIZE_CEILING));
    expect(reload.request.params.get(CuratorQueryParams.offset)).toBe('0');
    reload.flush(page([FULL_GAME], 1));
    fixture.detectChanges();
  });
});
