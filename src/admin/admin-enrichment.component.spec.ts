import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminEnrichmentComponent } from './admin-enrichment.component';
import { ResolvedEnrichmentRun } from './admin-enrichment.resolver';
import { EnrichmentPassSummary, EnrichmentRunStatusResponse } from '../curator/curator.models';

let nextGeneratedCount = 0;
const aCount = (): number => (nextGeneratedCount += 7);
let nextGeneratedId = 0;
const anId = (prefix: string): string => `${prefix}-${(nextGeneratedId += 1)}`;

interface PassCounts {
  processed: number;
  remaining: number;
  rawg?: number;
  opencritic?: number;
  psn?: number;
}

function enrichmentPass(counts: PassCounts): EnrichmentPassSummary {
  return {
    enriched_count: counts.processed,
    remaining_count: counts.remaining,
    ...(counts.rawg === undefined ? {} : { rawg_enriched_count: counts.rawg }),
    ...(counts.opencritic === undefined ? {} : { opencritic_enriched_count: counts.opencritic }),
    ...(counts.psn === undefined ? {} : { psn_enriched_count: counts.psn }),
  };
}

function runWith(enrichment: EnrichmentPassSummary): EnrichmentRunStatusResponse {
  return {
    run_id: anId('run'),
    status: 'succeeded',
    error: null,
    result_summary: { enrichment },
  };
}

describe('AdminEnrichmentComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [AdminEnrichmentComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function create(resolved: ResolvedEnrichmentRun = { status: 'none' }): ComponentFixture<AdminEnrichmentComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminEnrichmentComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { latestRun: resolved } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminEnrichmentComponent);
    fixture.detectChanges();
    return fixture;
  }

  function clickButtonByText(root: HTMLElement, text: string): void {
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!.click();
  }

  it('shows "no run yet" (not an error) when no run has ever been started', () => {
    const fixture = create({ status: 'none' });

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('No enrichment run has been started yet.');
    expect(text).not.toContain('Unable to load');
  });

  it('shows an error message when the resolver could not load the latest run', () => {
    const fixture = create({ status: 'error' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the latest enrichment run.');
  });

  it('renders the latest run and its per-pass result summary on load', () => {
    const counts: PassCounts = { processed: aCount(), remaining: aCount() };
    const run: EnrichmentRunStatusResponse = {
      run_id: anId('run'),
      status: 'succeeded',
      error: null,
      result_summary: {
        opencritic_cache_refresh: { status: 'ok', games_fetched: aCount() },
        franchise_reclassification: { status: 'skipped_unchanged' },
        tier_reclassification: { status: 'ran', updated_count: aCount() },
        enrichment: enrichmentPass(counts),
      },
    };
    const fixture = create({ status: 'ok', run });

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(run.run_id);
    expect(text).toContain(run.status);
    expect(text).toContain('OpenCritic cache refresh');
    expect(text).toContain(`${counts.processed} processed, ${counts.remaining} remaining`);
  });

  it('reports what each provider actually stored, not just how many games were processed', () => {
    const counts: PassCounts = {
      processed: aCount(),
      remaining: aCount(),
      rawg: aCount(),
      opencritic: aCount(),
    };
    const fixture = create({ status: 'ok', run: runWith(enrichmentPass(counts)) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')?.textContent).toContain(
      `${counts.processed} processed`,
    );
    expect(compiled.querySelector('#enrichment-provider-gains')?.textContent).toContain(
      `RAWG ${counts.rawg}, OpenCritic ${counts.opencritic}`,
    );
    expect(compiled.querySelector('#enrichment-no-gain')).toBeNull();
  });

  it('renders a psn provider count once the backend starts emitting one', () => {
    const counts: PassCounts = {
      processed: aCount(),
      remaining: aCount(),
      rawg: aCount(),
      opencritic: aCount(),
      psn: aCount(),
    };
    const fixture = create({ status: 'ok', run: runWith(enrichmentPass(counts)) });

    expect((fixture.nativeElement as HTMLElement).querySelector('#enrichment-provider-gains')?.textContent).toContain(
      `PSN ${counts.psn}`,
    );
  });

  it('calls out a run that processed every game and stored nothing', () => {
    const counts: PassCounts = { processed: aCount(), remaining: 0, rawg: 0, opencritic: 0 };
    const fixture = create({ status: 'ok', run: runWith(enrichmentPass(counts)) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')?.textContent).toContain(
      `${counts.processed} processed`,
    );
    expect(compiled.querySelector('#enrichment-no-gain')).not.toBeNull();
    expect(compiled.querySelector('#enrichment-no-gain')?.textContent).toContain('stored nothing');
  });

  it('claims nothing about provider gains when the payload carries no per-provider counts', () => {
    const counts: PassCounts = { processed: aCount(), remaining: aCount() };
    const fixture = create({ status: 'ok', run: runWith(enrichmentPass(counts)) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')).not.toBeNull();
    expect(compiled.querySelector('#enrichment-provider-gains')).toBeNull();
    expect(compiled.querySelector('#enrichment-no-gain')).toBeNull();
  });

  it('renders no enrichment counts at all when the pass reports neither', () => {
    const fixture = create({ status: 'ok', run: runWith({ status: 'skipped' }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')).toBeNull();
    expect(compiled.querySelector('#enrichment-provider-gains')).toBeNull();
  });

  it('requires a two-step confirm before starting a run, and does not POST on cancel', () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButtonByText(compiled, 'Start enrichment run');
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Are you sure?');
    httpMock.expectNone('/curator/api/enrichment/runs');

    clickButtonByText(compiled, 'Cancel');
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Are you sure?');
    httpMock.expectNone('/curator/api/enrichment/runs');
  });

  it('starts a run on confirm and polls until succeeded', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButtonByText(compiled, 'Start enrichment run');
    fixture.detectChanges();
    clickButtonByText(compiled, 'Yes, start a run');
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/enrichment/runs').flush({ run_id: 'run-2' });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/enrichment/runs/run-2')
      .flush({ run_id: 'run-2', status: 'running', error: null, result_summary: null });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/enrichment/runs/run-2')
      .flush({ run_id: 'run-2', status: 'succeeded', error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('run-2');
    expect(compiled.textContent).toContain('succeeded');

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/enrichment/runs/run-2');
  });

  it('stops polling a cancelled run and explains the terminal state', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButtonByText(compiled, 'Start enrichment run');
    fixture.detectChanges();
    clickButtonByText(compiled, 'Yes, start a run');
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/enrichment/runs').flush({ run_id: 'run-3' });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock
      .expectOne('/curator/api/enrichment/runs/run-3')
      .flush({ run_id: 'run-3', status: 'cancelled', error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.querySelector('#enrichment-run-cancelled')?.textContent).toContain(
      'This run was cancelled before it finished.',
    );

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectNone('/curator/api/enrichment/runs/run-3');
  });

  it('retries a single transient poll failure instead of losing track of the run', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButtonByText(compiled, 'Start enrichment run');
    fixture.detectChanges();
    clickButtonByText(compiled, 'Yes, start a run');
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/enrichment/runs').flush({ run_id: 'run-3' });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(2500);
    httpMock.expectOne('/curator/api/enrichment/runs/run-3').flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Lost track of the enrichment run.');

    await vi.advanceTimersByTimeAsync(4500);
    httpMock
      .expectOne('/curator/api/enrichment/runs/run-3')
      .flush({ run_id: 'run-3', status: 'succeeded', error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('succeeded');
  });
});
