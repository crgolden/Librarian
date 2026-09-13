import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../../curator/curator.service';
import { PsPlusRotationResponse } from '../../curator/curator.models';

const NOT_LINKED_STATUS = 404;

export type ResolvedPsPlusRotation =
  | { status: 'ok'; rotation: PsPlusRotationResponse }
  | { status: 'not-linked' }
  | { status: 'error' };

export const psPlusRotationResolver: ResolveFn<ResolvedPsPlusRotation> = () => {
  const curator = inject(CuratorService);
  return curator.getPsPlusRotation().pipe(
    map((rotation): ResolvedPsPlusRotation => ({ status: 'ok', rotation })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPsPlusRotation>(err.status === NOT_LINKED_STATUS ? { status: 'not-linked' } : { status: 'error' }),
    ),
  );
};
