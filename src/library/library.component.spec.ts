import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LibraryComponent } from './library.component';
import { LibraryGameResponse } from '../curator/curator.models';

describe('LibraryComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  /** ngOnInit fires GET /library immediately -- flush it (empty by default) so every test starts settled. */
  function createAndLoad(games: LibraryGameResponse[] = []): ComponentFixture<LibraryComponent> {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/library').flush(games);
    fixture.detectChanges();
    return fixture;
  }

  it('triggers a refresh, polls until succeeded, and shows a success message', async () => {
    const fixture = createAndLoad();

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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Library catalogued.');

    // succeeded -> reloads the library table.
    httpMock.expectOne('/curator/api/library').flush([]);
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/library/refresh/r1');
  });

  it('shows the job error message on a failed refresh', async () => {
    const fixture = createAndLoad();

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

  it('shows an error when the refresh trigger itself fails', () => {
    const fixture = createAndLoad();

    fixture.nativeElement.querySelector('button').click();
    httpMock.expectOne('/curator/api/library/refresh').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to start a library refresh.');
  });

  it('renders the post-refresh summary, capping the inline title list', async () => {
    const fixture = createAndLoad();

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
    httpMock.expectOne('/curator/api/library').flush([]);
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
    const fixture = createAndLoad();

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
    httpMock.expectOne('/curator/api/library').flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('OpenCritic still has more of your library to check');
  });

  it('shows a message when the library is empty', () => {
    const fixture = createAndLoad([]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No games yet');
  });

  it('renders a checkmark row per game reflecting per-provider enrichment status', () => {
    const fixture = createAndLoad([
      { game_id: 'g1', title: 'Elden Ring', rawg_enriched: true, opencritic_enriched: true },
      { game_id: 'g2', title: 'Unmatched Game', rawg_enriched: false, opencritic_enriched: false },
    ]);
    const compiled: HTMLElement = fixture.nativeElement;

    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Elden Ring');
    expect(rows[0].textContent).toContain('✓');
    expect(rows[1].textContent).toContain('Unmatched Game');
    expect(rows[1].textContent).toContain('—');
  });

  it('renders checkmarks for a user with no enrichment keys configured, from shared-cache hits', () => {
    // The library table has no knowledge of whether the caller has any keys configured -- it only
    // reflects game_enrichment.rawg_enriched/opencritic_enriched, which can be true purely from the
    // shared cache. This test documents that the UI makes no distinction.
    const fixture = createAndLoad([{ game_id: 'g1', title: 'Cached Game', rawg_enriched: true, opencritic_enriched: false }]);
    const compiled: HTMLElement = fixture.nativeElement;

    const row = compiled.querySelector('tbody tr');
    expect(row?.textContent).toContain('✓');
    expect(row?.textContent).toContain('—');
  });

  it('shows an error when the library fails to load', () => {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/library').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load your library.');
  });
});
