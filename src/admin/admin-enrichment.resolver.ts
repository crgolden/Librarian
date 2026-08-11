import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { EnrichmentRunStatusResponse } from '../curator/curator.models';

export type ResolvedEnrichmentRun =
  | { status: 'ok'; run: EnrichmentRunStatusResponse }
  | { status: 'none' }
  | { status: 'error' };

/** Resolves the latest enrichment run before /admin/enrichment activates. */
export const latestEnrichmentRunResolver: ResolveFn<ResolvedEnrichmentRun> = () => {
  const curator = inject(CuratorService);

  return curator.getLatestEnrichmentRun().pipe(
    map((run): ResolvedEnrichmentRun => ({ status: 'ok', run })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedEnrichmentRun>(err.status === 404 ? { status: 'none' } : { status: 'error' }),
    ),
  );
};
