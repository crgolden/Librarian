import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';

export type ResolvedPublicCollection =
  | { status: 'ok'; collection: PublicCollectionResponse; following: boolean }
  | { status: 'not-found' }
  | { status: 'error' };

export const publicCollectionResolver: ResolveFn<ResolvedPublicCollection> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const slug = route.paramMap.get('slug');
  if (!slug) {
    return of<ResolvedPublicCollection>({ status: 'not-found' });
  }

  return curator.getPublicCollection(slug).pipe(
    switchMap((collection) =>
      forkJoin({
        collection: of(collection),
        followed: curator.listFollowedCollections().pipe(catchError(() => of([]))),
      }),
    ),
    map(({ collection, followed }): ResolvedPublicCollection => ({
      status: 'ok',
      collection,
      following: followed.some((definition) => definition.definition_id === collection.definition_id),
    })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPublicCollection>(err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
};
