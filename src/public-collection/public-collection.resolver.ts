import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';

export type ResolvedPublicCollection =
  | { status: 'ok'; collection: PublicCollectionResponse }
  | { status: 'not-found' }
  | { status: 'error' };

/** Resolves the shared collection named by `:slug`. */
export const publicCollectionResolver: ResolveFn<ResolvedPublicCollection> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const slug = route.paramMap.get('slug');
  if (!slug) {
    return of<ResolvedPublicCollection>({ status: 'not-found' });
  }

  return curator.getPublicCollection(slug).pipe(
    map((collection): ResolvedPublicCollection => ({ status: 'ok', collection })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPublicCollection>(err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
};
