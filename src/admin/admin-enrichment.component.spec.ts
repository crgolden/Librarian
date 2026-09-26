import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminEnrichmentComponent } from './admin-enrichment.component';
import { ResolvedEnrichmentRun } from './admin-enrichment.resolver';
import { EnrichmentPassSummary, EnrichmentRunStatusResponse, JobStatuses } from '../curator/curator.models';
import { CuratorApi } from '../curator/curator-api';
import { RouteDataKeys } from '../app/app-paths';
import { LATEST_RUN_LOAD_ERROR, LOST_RUN_ERROR } from './admin-enrichment.messages';
import { ResolvedStatuses } from '../shared/resolved-status';
import { environment } from '../environments/environment';
import { newCount, newId, newText } from '@crgolden/modules/testing';

const STARTED_RUN_ID = newId();
const CANCELLED_RUN_ID = newId();

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
    run_id: newId(),
    status: JobStatuses.succeeded,
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

  function create(resolved: ResolvedEnrichmentRun = { status: ResolvedStatuses.none }): ComponentFixture<AdminEnrichmentComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminEnrichmentComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { [RouteDataKeys.latestRun]: resolved } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminEnrichmentComponent);
    fixture.detectChanges();
    return fixture;
  }

  function clickButton(root: HTMLElement, selector: string): void {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (button === null) {
      throw new Error(`No button matched "${selector}"`);
    }
    button.click();
  }

  it('shows "no run yet" (not an error) when no run has ever been started', () => {
    const fixture = create({ status: ResolvedStatuses.none });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-no-run')).not.toBeNull();
    expect(compiled.querySelector('#enrichment-load-error')).toBeNull();
    expect(compiled.textContent).not.toContain(LATEST_RUN_LOAD_ERROR);
  });

  it('shows an error message when the resolver could not load the latest run', () => {
    const fixture = create({ status: ResolvedStatuses.error });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(LATEST_RUN_LOAD_ERROR);
  });

  it('renders the latest run and its per-pass result summary on load', () => {
    const counts: PassCounts = { processed: newCount(), remaining: newCount() };
    const run: EnrichmentRunStatusResponse = {
      run_id: newId(),
      status: JobStatuses.succeeded,
      error: null,
      result_summary: {
        opencritic_cache_refresh: { status: newText(), games_fetched: newCount() },
        franchise_reclassification: { status: newText() },
        tier_reclassification: { status: newText(), updated_count: newCount() },
        enrichment: enrichmentPass(counts),
      },
    };
    const fixture = create({ status: ResolvedStatuses.ok, run });

    const compiled: HTMLElement = fixture.nativeElement;
    const text = compiled.textContent;
    expect(text).toContain(run.run_id);
    expect(text).toContain(run.status);
    expect(compiled.querySelector('#enrichment-pass-opencritic-cache-refresh')).not.toBeNull();
    expect(text).toContain(`${counts.processed} processed, ${counts.remaining} remaining`);
  });

  it('reports what each provider actually stored, not just how many games were processed', () => {
    const counts: PassCounts = {
      processed: newCount(),
      remaining: newCount(),
      rawg: newCount(),
      opencritic: newCount(),
    };
    const fixture = create({ status: ResolvedStatuses.ok, run: runWith(enrichmentPass(counts)) });

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
      processed: newCount(),
      remaining: newCount(),
      rawg: newCount(),
      opencritic: newCount(),
      psn: newCount(),
    };
    const fixture = create({ status: ResolvedStatuses.ok, run: runWith(enrichmentPass(counts)) });

    expect((fixture.nativeElement as HTMLElement).querySelector('#enrichment-provider-gains')?.textContent).toContain(
      `PSN ${counts.psn}`,
    );
  });

  it('calls out a run that processed every game and stored nothing', () => {
    const counts: PassCounts = { processed: newCount(), remaining: 0, rawg: 0, opencritic: 0 };
    const fixture = create({ status: ResolvedStatuses.ok, run: runWith(enrichmentPass(counts)) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')?.textContent).toContain(
      `${counts.processed} processed`,
    );
    expect(compiled.querySelector('#enrichment-no-gain')).not.toBeNull();
  });

  it('claims nothing about provider gains when the payload carries no per-provider counts', () => {
    const counts: PassCounts = { processed: newCount(), remaining: newCount() };
    const fixture = create({ status: ResolvedStatuses.ok, run: runWith(enrichmentPass(counts)) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')).not.toBeNull();
    expect(compiled.querySelector('#enrichment-provider-gains')).toBeNull();
    expect(compiled.querySelector('#enrichment-no-gain')).toBeNull();
  });

  it('renders no enrichment counts at all when the pass reports neither', () => {
    const fixture = create({ status: ResolvedStatuses.ok, run: runWith({ status: newText() }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#enrichment-processed-count')).toBeNull();
    expect(compiled.querySelector('#enrichment-provider-gains')).toBeNull();
  });

  it('requires a two-step confirm before starting a run, and does not POST on cancel', () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButton(compiled, '#enrichment-start');
    fixture.detectChanges();

    expect(compiled.querySelector('#enrichment-confirm-prompt')).not.toBeNull();
    httpMock.expectNone(CuratorApi.enrichmentRuns);

    clickButton(compiled, '#enrichment-cancel');
    fixture.detectChanges();

    expect(compiled.querySelector('#enrichment-confirm-prompt')).toBeNull();
    httpMock.expectNone(CuratorApi.enrichmentRuns);
  });

  it('starts a run on confirm and polls until succeeded', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButton(compiled, '#enrichment-start');
    fixture.detectChanges();
    clickButton(compiled, '#enrichment-confirm');
    fixture.detectChanges();

    httpMock.expectOne(CuratorApi.enrichmentRuns).flush({ run_id: STARTED_RUN_ID });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.enrichmentRunsByRunId(STARTED_RUN_ID))
      .flush({ run_id: STARTED_RUN_ID, status: JobStatuses.running, error: null, result_summary: null });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.enrichmentRunsByRunId(STARTED_RUN_ID))
      .flush({ run_id: STARTED_RUN_ID, status: JobStatuses.succeeded, error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(STARTED_RUN_ID);
    expect(compiled.textContent).toContain(JobStatuses.succeeded);

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock.expectNone(CuratorApi.enrichmentRunsByRunId(STARTED_RUN_ID));
  });

  it('stops polling a cancelled run and explains the terminal state', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButton(compiled, '#enrichment-start');
    fixture.detectChanges();
    clickButton(compiled, '#enrichment-confirm');
    fixture.detectChanges();

    httpMock.expectOne(CuratorApi.enrichmentRuns).flush({ run_id: CANCELLED_RUN_ID });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock
      .expectOne(CuratorApi.enrichmentRunsByRunId(CANCELLED_RUN_ID))
      .flush({ run_id: CANCELLED_RUN_ID, status: JobStatuses.cancelled, error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.querySelector('#enrichment-run-cancelled')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock.expectNone(CuratorApi.enrichmentRunsByRunId(CANCELLED_RUN_ID));
  });

  it('retries a single transient poll failure instead of losing track of the run', async () => {
    const fixture = create();

    const compiled: HTMLElement = fixture.nativeElement;
    clickButton(compiled, '#enrichment-start');
    fixture.detectChanges();
    clickButton(compiled, '#enrichment-confirm');
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.enrichmentRuns).flush({ run_id: CANCELLED_RUN_ID });
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs);
    httpMock.expectOne(CuratorApi.enrichmentRunsByRunId(CANCELLED_RUN_ID)).flush(null, { status: HttpStatusCode.BadGateway, statusText: HttpStatusCode[HttpStatusCode.BadGateway] });
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain(LOST_RUN_ERROR);

    await vi.advanceTimersByTimeAsync(environment.adminEnrichmentPollIntervalMs + environment.adminEnrichmentPollErrorRetryDelayMs);
    httpMock
      .expectOne(CuratorApi.enrichmentRunsByRunId(CANCELLED_RUN_ID))
      .flush({ run_id: CANCELLED_RUN_ID, status: JobStatuses.succeeded, error: null, result_summary: null });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(JobStatuses.succeeded);
  });
});
