import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse } from '../curator/curator.models';

export type ResolvedCatalogGame =
  | { status: 'ok'; game: GameSummaryResponse }
  | { status: 'not-found' }
  | { status: 'error' };

/** Resolves one catalogued game, distinguishing an unknown id from a failed load. */
export const catalogDetailResolver: ResolveFn<ResolvedCatalogGame> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const gameId = route.paramMap.get('gameId');
  if (gameId === null) {
    return of<ResolvedCatalogGame>({ status: 'not-found' });
  }

  return curator.getCatalogGame(gameId).pipe(
    map((game): ResolvedCatalogGame => ({ status: 'ok', game })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCatalogGame>(err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
};
