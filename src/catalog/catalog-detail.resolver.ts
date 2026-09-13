import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse, PublicCollectionSummaryResponse } from '../curator/curator.models';

export type ResolvedCatalogGame =
  | { status: 'ok'; game: GameSummaryResponse; collections: PublicCollectionSummaryResponse[] }
  | { status: 'not-found' }
  | { status: 'error' };

export const catalogDetailResolver: ResolveFn<ResolvedCatalogGame> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const gameId = route.paramMap.get('gameId');
  if (gameId === null) {
    return of<ResolvedCatalogGame>({ status: 'not-found' });
  }

  const collections = curator
    .getCatalogGameCollections(gameId)
    .pipe(catchError(() => of({ collections: [] as PublicCollectionSummaryResponse[], total: 0 })));

  return forkJoin({ game: curator.getCatalogGame(gameId), collections }).pipe(
    map((data): ResolvedCatalogGame => ({ status: 'ok', game: data.game, collections: data.collections.collections })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCatalogGame>(err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
};
