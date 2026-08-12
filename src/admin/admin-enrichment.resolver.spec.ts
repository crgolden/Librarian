import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { latestEnrichmentRunResolver, ResolvedEnrichmentRun } from './admin-enrichment.resolver';
import { CuratorService } from '../curator/curator.service';
import { EnrichmentRunStatusResponse } from '../curator/curator.models';

const RUN = { run_id: 'r1', status: 'succeeded' } as unknown as EnrichmentRunStatusResponse;

function run(curator: Partial<CuratorService>): Promise<ResolvedEnrichmentRun> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = latestEnrichmentRunResolver({} as ActivatedRouteSnapshot, {} as never);
      (result as Observable<ResolvedEnrichmentRun>).subscribe(resolvePromise);
    });
  });
}

const fails = (status: number) => () => throwError(() => new HttpErrorResponse({ status }));

describe('latestEnrichmentRunResolver', () => {
  it('resolves the latest run', async () => {
    expect(await run({ getLatestEnrichmentRun: () => of(RUN) })).toEqual({ status: 'ok', run: RUN });
  });

  it('reports none when no run has ever been queued, which is not an error', async () => {
    expect(await run({ getLatestEnrichmentRun: fails(404) })).toEqual({ status: 'none' });
  });

  it('distinguishes a failed load from never having run', async () => {
    expect(await run({ getLatestEnrichmentRun: fails(500) })).toEqual({ status: 'error' });
  });
});
