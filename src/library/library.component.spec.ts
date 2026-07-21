import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { LibraryComponent } from './library.component';
import { LibraryGameResponse, LibraryPageResponse, ProfileLibraryGameResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function activatedRouteWithSub(sub: string | null): ActivatedRoute {
  return { snapshot: { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } } as unknown as ActivatedRoute;
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
};

describe('LibraryComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideHttpClient(),
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

  /** ngOnInit/the sort-filter-page effect fire GET /library and GET /library/categories immediately --
   * flush both (empty by default) so every test starts settled. */
  async function createAndLoad(
    games: LibraryGameResponse[] = [],
    total = games.length,
    categories: string[] = [],
  ): Promise<ComponentFixture<LibraryComponent>> {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(page(games, total));
    httpMock.expectOne('/curator/api/library/categories').flush({ categories });
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

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

    // succeeded -> reloads the library table and the category options.
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
    expect(rows[1].textContent).toContain('Unmatched Game');
    expect(rows[1].textContent).toContain('—');
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
    // Toggling a sort re-triggers loading state, which briefly unmounts and remounts the table (and
    // its <th> elements) -- re-query the header from the live DOM after each reload rather than
    // reusing a reference that may now be detached.
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

  it('shows an error when the library fails to load', async () => {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    httpMock.expectOne((req) => req.url === '/curator/api/library').flush(null, { status: 500, statusText: 'Error' });
    httpMock.expectOne('/curator/api/library/categories').flush({ categories: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load your library.');
  });

  describe('viewer mode', () => {
    // The outer beforeEach already injects HttpTestingController, which instantiates the testing
    // module -- TestBed.overrideProvider() can no longer be used past that point. Reconfigure a
    // fresh module per viewer test instead, with route/auth providers specific to that test.
    function configureForViewer(routeSub: string, ownSub: string | null): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [LibraryComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: activatedRouteWithSub(routeSub) },
          { provide: AuthService, useValue: authServiceWithSub(ownSub) },
        ],
      });
      httpMock = TestBed.inject(HttpTestingController);
    }

    it('redirects to the bare /library path without fetching when :sub equals the signed-in user\'s own sub', () => {
      configureForViewer('own-sub', 'own-sub');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();

      expect(navigateSpy).toHaveBeenCalledWith(['/library'], { replaceUrl: true });
      httpMock.expectNone('/curator/api/library');
      httpMock.expectNone('/curator/api/users/own-sub/library');
    });

    it('renders another user\'s library read-only, with no refresh button', async () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const games: ProfileLibraryGameResponse[] = [FULL_GAME];
      httpMock.expectOne((req) => req.url === '/curator/api/users/other-sub/library').flush(page(games));
      httpMock.expectOne('/curator/api/users/other-sub/library/categories').flush({ categories: [] });
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain('Elden Ring');
      const buttonLabels = Array.from(compiled.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(buttonLabels).not.toContain('Refresh library');
      httpMock.expectNone('/curator/api/library');
    });

    it('shows an empty state for another user with no games', async () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      httpMock.expectOne((req) => req.url === '/curator/api/users/other-sub/library').flush(page([]));
      httpMock.expectOne('/curator/api/users/other-sub/library/categories').flush({ categories: [] });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No games in this library yet.');
    });

    it('shows an inline message on a 403 (section not public)', async () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      httpMock
        .expectOne((req) => req.url === '/curator/api/users/other-sub/library')
        .flush(null, { status: 403, statusText: 'Forbidden' });
      httpMock.expectOne('/curator/api/users/other-sub/library/categories').flush({ categories: [] });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("This section isn't available.");
    });

    it('shows a generic error message on a non-403 failure', async () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(LibraryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      httpMock
        .expectOne((req) => req.url === '/curator/api/users/other-sub/library')
        .flush(null, { status: 500, statusText: 'Server Error' });
      httpMock.expectOne('/curator/api/users/other-sub/library/categories').flush({ categories: [] });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("Unable to load this user's library.");
    });
  });
});
