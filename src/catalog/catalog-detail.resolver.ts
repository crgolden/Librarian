import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse, PublicCollectionSummaryResponse } from '../curator/curator.models';
import { RouteParams } from '../app/app-paths';
import { ResolvedStatuses } from '../shared/resolved-status';
import { statusCodeOf } from '../shared/http-status';

export type ResolvedCatalogGame =
  | { status: typeof ResolvedStatuses.ok; game: GameSummaryResponse; collections: PublicCollectionSummaryResponse[] }
  | { status: typeof ResolvedStatuses.notFound }
  | { status: typeof ResolvedStatuses.error };

export const catalogDetailResolver: ResolveFn<ResolvedCatalogGame> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const gameId = route.paramMap.get(RouteParams.gameId);
  if (gameId === null) {
    return of<ResolvedCatalogGame>({ status: ResolvedStatuses.notFound });
  }

  const collections = curator
    .getCatalogGameCollections(gameId)
    .pipe(catchError(() => of({ collections: [] as PublicCollectionSummaryResponse[], total: 0 })));

  return forkJoin({ game: curator.getCatalogGame(gameId), collections }).pipe(
    map((data): ResolvedCatalogGame => ({ status: ResolvedStatuses.ok, game: data.game, collections: data.collections.collections })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCatalogGame>(statusCodeOf(err) === HttpStatusCode.NotFound ? { status: ResolvedStatuses.notFound } : { status: ResolvedStatuses.error }),
    ),
  );
};
