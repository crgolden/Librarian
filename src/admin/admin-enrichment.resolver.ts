import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { EnrichmentRunStatusResponse } from '../curator/curator.models';
import { ResolvedStatuses } from '../shared/resolved-status';
import { statusCodeOf } from '../shared/http-status';

export type ResolvedEnrichmentRun =
  | { status: typeof ResolvedStatuses.ok; run: EnrichmentRunStatusResponse }
  | { status: typeof ResolvedStatuses.none }
  | { status: typeof ResolvedStatuses.error };

export const latestEnrichmentRunResolver: ResolveFn<ResolvedEnrichmentRun> = () => {
  const curator = inject(CuratorService);

  return curator.getLatestEnrichmentRun().pipe(
    map((run): ResolvedEnrichmentRun => ({ status: ResolvedStatuses.ok, run })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedEnrichmentRun>(statusCodeOf(err) === HttpStatusCode.NotFound ? { status: ResolvedStatuses.none } : { status: ResolvedStatuses.error }),
    ),
  );
};
