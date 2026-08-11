import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminEnrichmentComponent } from './admin-enrichment.component';
import { ResolvedEnrichmentRun } from './admin-enrichment.resolver';

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

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No enrichment run has been started yet.');
    expect(text).not.toContain('Unable to load');
  });

  it('shows an error message when the resolver could not load the latest run', () => {
    const fixture = create({ status: 'error' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the latest enrichment run.');
  });

  it('renders the latest run and its per-pass result summary on load', () => {
    const fixture = create({
      status: 'ok',
      run: {
        run_id: 'run-1',
        status: 'succeeded',
        error: null,
        result_summary: {
          opencritic_cache_refresh: { status: 'ok', games_fetched: 40 },
          franchise_reclassification: { status: 'skipped_unchanged' },
          tier_reclassification: { status: 'ran', updated_count: 12 },
          enrichment: { enriched_count: 5, remaining_count: 0 },
        },
      },
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('run-1');
    expect(text).toContain('succeeded');
    expect(text).toContain('OpenCritic cache refresh');
    expect(text).toContain('5 enriched, 0 remaining');
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
