import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import {
  LibraryGameResponse,
  ProfileLibraryGameResponse,
  RefreshScheduleResponse,
} from '../curator/curator.models';

export const LIBRARY_PAGE_SIZE = 20;

export type ResolvedLibraryGame = LibraryGameResponse | ProfileLibraryGameResponse;

export type ResolvedLibrary =
  | {
      status: 'ok';
      games: ResolvedLibraryGame[];
      total: number;
      genres: string[];
      schedule: RefreshScheduleResponse | null;
    }
  | { status: 'forbidden' }
  | { status: 'error' };

export const initialLibraryQuery: LibraryQuery = {
  sort: 'title',
  sortDir: 'asc',
  limit: LIBRARY_PAGE_SIZE,
  offset: 0,
};

export const libraryResolver: ResolveFn<ResolvedLibrary> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get('sub');

  const games =
    sub !== null ? curator.getUserLibrary(sub, initialLibraryQuery) : curator.getLibrary(initialLibraryQuery);
  const genres = (sub !== null ? curator.getUserLibraryGenres(sub) : curator.getLibraryGenres()).pipe(
    catchError(() => of({ genres: [] })),
  );
  const schedule =
    sub !== null
      ? of<RefreshScheduleResponse | null>(null)
      : curator.getRefreshSchedule().pipe(catchError(() => of<RefreshScheduleResponse | null>(null)));

  return forkJoin({ games, genres, schedule }).pipe(
    map(
      (data): ResolvedLibrary => ({
        status: 'ok',
        games: data.games.games,
        total: data.games.total,
        genres: data.genres.genres,
        schedule: data.schedule,
      }),
    ),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedLibrary>(err.status === 403 ? { status: 'forbidden' } : { status: 'error' }),
    ),
  );
};
