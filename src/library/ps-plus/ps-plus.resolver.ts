import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../../curator/curator.service';
import { PsPlusRotationResponse } from '../../curator/curator.models';
import { ResolvedStatuses } from '../../shared/resolved-status';
import { statusCodeOf } from '../../shared/http-status';

const NOT_LINKED_STATUS = HttpStatusCode.NotFound;

export type ResolvedPsPlusRotation =
  | { status: typeof ResolvedStatuses.ok; rotation: PsPlusRotationResponse }
  | { status: typeof ResolvedStatuses.notLinked }
  | { status: typeof ResolvedStatuses.error };

export const psPlusRotationResolver: ResolveFn<ResolvedPsPlusRotation> = () => {
  const curator = inject(CuratorService);
  return curator.getPsPlusRotation().pipe(
    map((rotation): ResolvedPsPlusRotation => ({ status: ResolvedStatuses.ok, rotation })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPsPlusRotation>(statusCodeOf(err) === NOT_LINKED_STATUS ? { status: ResolvedStatuses.notLinked } : { status: ResolvedStatuses.error }),
    ),
  );
};
