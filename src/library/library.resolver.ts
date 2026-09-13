import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import {
  LibraryGameResponse,
  LibraryPageResponse,
  ProfileLibraryGameResponse,
  ProfileLibraryPageResponse,
  PsPlusRotationSummaryResponse,
  RefreshScheduleResponse,
  TrophyProgressResponse,
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
      /** Owner mode only; null in viewer mode or from a Curator that predates the field. */
      trophyProgress: TrophyProgressResponse | null;
      hiddenCount: number;
      /** Owner mode only, and only when the schedule watches PS Plus; null otherwise or when it degrades. */
      psPlus: PsPlusRotationSummaryResponse | null;
    }
  | { status: 'forbidden' }
  | { status: 'error' };

interface ScheduleAndPsPlus {
  schedule: RefreshScheduleResponse | null;
  psPlus: PsPlusRotationSummaryResponse | null;
}

function ownerScheduleAndPsPlus(curator: CuratorService): Observable<ScheduleAndPsPlus> {
  return curator.getRefreshSchedule().pipe(
    catchError(() => of<RefreshScheduleResponse | null>(null)),
    switchMap((schedule) => {
      if (schedule?.ps_plus_watch !== true) {
        return of<ScheduleAndPsPlus>({ schedule, psPlus: null });
      }
      return curator.getPsPlusRotationSummary().pipe(
        catchError(() => of<PsPlusRotationSummaryResponse | null>(null)),
        map((psPlus): ScheduleAndPsPlus => ({ schedule, psPlus })),
      );
    }),
  );
}

function trophyProgressOf(page: LibraryPageResponse | ProfileLibraryPageResponse): TrophyProgressResponse | null {
  return 'trophy_progress' in page ? (page.trophy_progress ?? null) : null;
}

function hiddenCountOf(page: LibraryPageResponse | ProfileLibraryPageResponse): number {
  return 'hidden_count' in page ? (page.hidden_count ?? 0) : 0;
}

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
  const scheduleAndPsPlus =
    sub !== null ? of<ScheduleAndPsPlus>({ schedule: null, psPlus: null }) : ownerScheduleAndPsPlus(curator);

  return forkJoin({ games, genres, scheduleAndPsPlus }).pipe(
    map(
      (data): ResolvedLibrary => ({
        status: 'ok',
        games: data.games.games,
        total: data.games.total,
        genres: data.genres.genres,
        schedule: data.scheduleAndPsPlus.schedule,
        trophyProgress: trophyProgressOf(data.games),
        hiddenCount: hiddenCountOf(data.games),
        psPlus: data.scheduleAndPsPlus.psPlus,
      }),
    ),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedLibrary>(err.status === 403 ? { status: 'forbidden' } : { status: 'error' }),
    ),
  );
};
