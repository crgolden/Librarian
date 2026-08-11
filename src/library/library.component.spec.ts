import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LibraryComponent } from './library.component';
import { ResolvedLibrary } from './library.resolver';
import { LibraryGameResponse, LibraryPageResponse, ProfileLibraryGameResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function okLibrary(
  games: LibraryGameResponse[] | ProfileLibraryGameResponse[] = [],
  total = games.length,
  categories: string[] = [],
): ResolvedLibrary {
  return { status: 'ok', games, total, categories };
}

function activatedRouteWithSub(sub: string | null, resolved: ResolvedLibrary = okLibrary()): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(sub !== null ? { sub } : {}),
      data: { library: resolved },
    },
  } as unknown as ActivatedRoute;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

function page(games: LibraryGameResponse[], total = games.length): LibraryPageResponse {
  return { games, total };
}

const FULL_GAME: LibraryGameResponse = {
  game_id: 'g1',
  title: 'Elden Ring',
  category: 'Action RPG',
  rawg_rating: 96,
  opencritic_rating: 94,
  psn_rating: 4.8,
  psn_product_id: 'UP0700-CUSA23100_00-ELDENRING0000000',
  rawg_enriched: true,
  opencritic_enriched: true,
  percent_completed: 87,
  source: 'psn',
  cover_image_url: 'https://cdn.example/elden-ring.jpg',
};

const MANUAL_GAME: LibraryGameResponse = {
  ...FULL_GAME,
  game_id: 'g-manual',
  title: 'Disc Only Game',
  psn_product_id: null,
  source: 'manual',
};

describe('LibraryComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(null) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  /**
   * The first page and the category list both arrive from the resolver, so nothing is in flight here.
   * Reconfigures the module rather than calling `overrideProvider`: the `beforeEach` above already
   * instantiated it via `TestBed.inject`, and overriding after instantiation throws.
   */
  async function createAndLoad(
    games: LibraryGameResponse[] = [],
    total = games.length,
    categories: string[] = [],
  ): Promise<ComponentFixture<LibraryComponent>> {
    configureOwner(okLibrary(games, total, categories));
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
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(null, resolved) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  it('searches the shared catalog and adds the chosen game as a manual entry', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#library-add-manual-toggle')!.click();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { manualSearch: { set(v: string): void } }).manualSearch.set('disc');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('#library-manual-search-submit')!.click();

    const searchReq = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(searchReq.request.params.get('q')).toBe('disc');
    searchReq.flush({
      games: [
        {
          game_id: 'g-manual',
          canonical_title: 'Disc Only Game',
          franchise: null,
          genre: 'Action',
          aaa_tier: null,
          cover_image_url: null,
          store_product_id: null,
        },
      ],
      total: 1,
    });
    fixture.detectChanges();

    compiled.querySelector<HTMLButtonElement>('#library-manual-add-0')!.click();

    const addReq = httpMock.expectOne('/curator/api/library/manual');
    expect(addReq.request.method).toBe('POST');
    expect(addReq.request.body).toEqual({ game_id: 'g-manual' });
    addReq.flush(null);

    httpMock.expectOne((r) => r.url === '/curator/api/library').flush(page([FULL_GAME, MANUAL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Disc Only Game');
  });

  it('marks a manual entry and removes it via the manual route, never the refresh path', async () => {
    const fixture = await createAndLoad([MANUAL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#library-manual-badge-0')?.textContent).toContain('Added by hand');

    compiled.querySelector<HTMLButtonElement>('#library-manual-remove-0')!.click();

    const removeReq = httpMock.expectOne('/curator/api/library/manual/g-manual');
    expect(removeReq.request.method).toBe('DELETE');
    removeReq.flush(null);

    httpMock.expectOne((r) => r.url === '/curator/api/library').flush(page([]));
    fixture.detectChanges();
    await fixture.whenStable();
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

    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/library/refresh/r1')
      .flush({ run_id: 'r1', status: 'running', error: null, result_summary: null });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/library/refresh/r1')
      .flush({ run_id: 'r1', status: 'succeeded', error: null, result_summary: null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Library catalogued.');

    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(page([]));
    httpMock.expectOne('/curator/api/library/categories').flush({ categories: [] });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/library/refresh/r1');
  });

  it('shows the job error message on a failed refresh', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/library/refresh/r1')
      .flush({ run_id: 'r1', status: 'failed', error: 'PSN entitlement fetch failed.', result_summary: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('PSN entitlement fetch failed.');

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/library/refresh/r1');
  });

  it('retries a single transient poll failure instead of losing track of the job', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain('Lost track of the refresh job.');

    await vi.advanceTimersByTimeAsync(4500);
    httpMock
      .expectOne('/curator/api/library/refresh/r1')
      .flush({ run_id: 'r1', status: 'succeeded', error: null, result_summary: null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Library catalogued.');

    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(page([]));
    httpMock.expectOne('/curator/api/library/categories').flush({ categories: [] });
  });

  it('gives up and shows "Lost track" only after exhausting the retry budget', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    for (let attempt = 0; attempt < 3; attempt++) {
      await vi.advanceTimersByTimeAsync(4500);
      httpMock.expectOne('/curator/api/library/refresh/r1').flush(null, { status: 502, statusText: 'Bad Gateway' });
      fixture.detectChanges();
    }

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Lost track of the refresh job.');
  });

  it('shows an error when the refresh trigger itself fails', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to start a library refresh.');
  });

  it('renders the post-refresh summary, capping the inline title list', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    const manyTitles = Array.from({ length: 12 }, (_, i) => `Game ${i + 1}`);
    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush({
      run_id: 'r1',
      status: 'succeeded',
      error: null,
      result_summary: {
        rawg_enriched_titles: manyTitles,
        opencritic_enriched_titles: ['Elden Ring'],
        opencritic_topup_incomplete: true,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(page([]));
    httpMock.expectOne('/curator/api/library/categories').flush({ categories: [] });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Game 1');
    expect(text).toContain('Game 10');
    expect(text).not.toContain('Game 11');
    expect(text).toContain('+2 more');
    expect(text).toContain('Elden Ring');
    expect(text).toContain('OpenCritic still has more of your library to check');
  });

  it('does not render a topup-incomplete message when the top-up finished', async () => {
    const fixture = await createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush({ run_id: 'r1' });

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/library/refresh/r1').flush({
      run_id: 'r1',
      status: 'succeeded',
      error: null,
      result_summary: { rawg_enriched_titles: [], opencritic_enriched_titles: [], opencritic_topup_incomplete: false },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(page([]));
    httpMock.expectOne('/curator/api/library/categories').flush({ categories: [] });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('OpenCritic still has more of your library to check');
  });

  it('shows a message when the library is empty', async () => {
    const fixture = await createAndLoad([]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No games yet');
  });

  it('renders numeric ratings, category, and a dash for unresolved values', async () => {
    const fixture = await createAndLoad([
      FULL_GAME,
      {
        game_id: 'g2',
        title: 'Unmatched Game',
        category: null,
        rawg_rating: null,
        opencritic_rating: null,
        psn_rating: null,
        psn_product_id: null,
        rawg_enriched: false,
        opencritic_enriched: false,
        percent_completed: null,
        cover_image_url: null,
      },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;

    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Elden Ring');
    expect(rows[0].textContent).toContain('Action RPG');
    expect(rows[0].textContent).toContain('96');
    expect(rows[0].textContent).toContain('94');
    expect(rows[0].textContent).toContain('4.8');
    expect(rows[0].textContent).toContain('87%');
    expect(rows[1].textContent).toContain('Unmatched Game');
    expect(rows[1].textContent).toContain('—');
  });

  it('renders cover art when present, nothing when absent', async () => {
    const fixture = await createAndLoad([
      FULL_GAME,
      { ...FULL_GAME, game_id: 'g2', title: 'No Cover', cover_image_url: null },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;
    const rows = compiled.querySelectorAll('tbody tr');

    const img = rows[0].querySelector('img.cover-art');
    expect(img?.getAttribute('src')).toBe('https://cdn.example/elden-ring.jpg');
    expect(img?.getAttribute('alt')).toBe('Elden Ring');
    expect(rows[1].querySelector('img.cover-art')).toBeNull();
  });

  it('renders a PS Store link that opens in a new tab when a product id is present, a dash otherwise', async () => {
    const fixture = await createAndLoad([
      FULL_GAME,
      {
        game_id: 'g2',
        title: 'No Product Id',
        category: null,
        rawg_rating: null,
        opencritic_rating: null,
        psn_rating: null,
        psn_product_id: null,
        rawg_enriched: false,
        opencritic_enriched: false,
        percent_completed: null,
        cover_image_url: null,
      },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;
    const rows = compiled.querySelectorAll('tbody tr');

    const link = rows[0].querySelector('a');
    expect(link?.getAttribute('href')).toBe(
      'https://store.playstation.com/en-us/product/UP0700-CUSA23100_00-ELDENRING0000000',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(rows[1].querySelector('a')).toBeNull();
  });

  it('searches by title, debounced, resetting to the first page', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.library-search');

    input.value = 'ring';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    httpMock.expectNone((req) => req.url === '/curator/api/library' && req.params.get('q') === 'ring');

    await vi.advanceTimersByTimeAsync(300);
    const req = httpMock.expectOne((r) => r.url === '/curator/api/library' && r.params.get('q') === 'ring');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush(page([FULL_GAME]));
  });

  it('filters by category, resetting to the first page', async () => {
    const fixture = await createAndLoad([FULL_GAME], 1, ['Action RPG']);
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.library-category-filter');

    select.value = 'Action RPG';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/library' && r.params.get('category') === 'Action RPG');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush(page([FULL_GAME]));
  });

  it('sorts by clicking a column header, toggling direction on a second click', async () => {
    const fixture = await createAndLoad([FULL_GAME]);
    const compiled: HTMLElement = fixture.nativeElement;
    const findCategoryHeader = (): HTMLElement | undefined =>
      Array.from(compiled.querySelectorAll('th')).find((th) => th.textContent?.includes('Category'));

    expect(findCategoryHeader()).toBeDefined();
    findCategoryHeader()?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    const ascReq = httpMock.expectOne(
      (r) => r.url === '/curator/api/library' && r.params.get('sort') === 'category' && r.params.get('sortDir') === 'asc',
    );
    ascReq.flush(page([FULL_GAME]));
    fixture.detectChanges();
    await fixture.whenStable();

    findCategoryHeader()?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    const descReq = httpMock.expectOne(
      (r) => r.url === '/curator/api/library' && r.params.get('sort') === 'category' && r.params.get('sortDir') === 'desc',
    );
    descReq.flush(page([FULL_GAME]));
  });

  it('pages through results, enabling/disabling Previous/Next based on the real total', async () => {
    const fixture = await createAndLoad([FULL_GAME], 25);
    const compiled: HTMLElement = fixture.nativeElement;

    const buttons = Array.from(compiled.querySelectorAll('button'));
    const nextButton = buttons.find((b) => b.textContent?.trim() === 'Next')!;
    const prevButton = buttons.find((b) => b.textContent?.trim() === 'Previous')!;
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    nextButton.click();
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === '/curator/api/library' && r.params.get('offset') === '20');
    req.flush(page([FULL_GAME], 25));
    fixture.detectChanges();

    const prevButtonAfter = Array.from(compiled.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Previous',
    )!;
    expect(prevButtonAfter.disabled).toBe(false);
  });

  it('shows an error when the resolver could not load the library', async () => {
    configureOwner({ status: 'error' });
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load your library.');
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
    }

    it('renders another user\'s library read-only, with no refresh button', async () => {
      const games: ProfileLibraryGameResponse[] = [FULL_GAME];
      configureForViewer('other-sub', null, okLibrary(games));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain('Elden Ring');
      const buttonLabels = Array.from(compiled.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(buttonLabels).not.toContain('Refresh library');
      httpMock.expectNone('/curator/api/library');
    });

    it("shows a dash with an explanatory title for % Completed on another user's library", async () => {
      const games: ProfileLibraryGameResponse[] = [{ ...FULL_GAME, percent_completed: null }];
      configureForViewer('other-sub', null, okLibrary(games));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      const cell = compiled.querySelector('td[data-label="% Completed"]');
      expect(cell?.textContent?.trim()).toBe('—');
      expect(cell?.getAttribute('title')).toBe("Trophy completion isn't shown for other users' libraries yet.");
    });

    it('shows an empty state for another user with no games', async () => {
      configureForViewer('other-sub', null, okLibrary([]));

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No games in this library yet.');
    });

    it('shows an inline message when the resolver reports the section is not public', async () => {
      configureForViewer('other-sub', null, { status: 'forbidden' });

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("This section isn't available.");
    });

    it('shows a generic error message when the resolver reports a non-403 failure', async () => {
      configureForViewer('other-sub', null, { status: 'error' });

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("Unable to load this user's library.");
    });
  });
});
