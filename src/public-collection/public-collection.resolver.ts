import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';
import { RouteParams } from '../app/app-paths';
import { ResolvedStatuses } from '../shared/resolved-status';
import { statusCodeOf } from '../shared/http-status';

export type ResolvedPublicCollection =
  | { status: typeof ResolvedStatuses.ok; collection: PublicCollectionResponse; following: boolean }
  | { status: typeof ResolvedStatuses.notFound }
  | { status: typeof ResolvedStatuses.error };

export const publicCollectionResolver: ResolveFn<ResolvedPublicCollection> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const slug = route.paramMap.get(RouteParams.slug);
  if (!slug) {
    return of<ResolvedPublicCollection>({ status: ResolvedStatuses.notFound });
  }

  return curator.getPublicCollection(slug).pipe(
    switchMap((collection) =>
      forkJoin({
        collection: of(collection),
        followed: curator.listFollowedCollections().pipe(catchError(() => of([]))),
      }),
    ),
    map(({ collection, followed }): ResolvedPublicCollection => ({
      status: ResolvedStatuses.ok,
      collection,
      following: followed.some((definition) => definition.definition_id === collection.definition_id),
    })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPublicCollection>(statusCodeOf(err) === HttpStatusCode.NotFound ? { status: ResolvedStatuses.notFound } : { status: ResolvedStatuses.error }),
    ),
  );
};
