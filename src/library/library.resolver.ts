import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import { LibraryGameResponse, LibraryPageResponse, LibrarySortFields, ProfileLibraryGameResponse, ProfileLibraryPageResponse, PsPlusRotationSummaryResponse, RefreshScheduleResponse, SortDirections, TrophyProgressResponse } from '../curator/curator.models';
import { RouteParams } from '../app/app-paths';
import { ResolvedStatuses } from '../shared/resolved-status';
import { LIBRARY_PAGE_SIZE } from './library.query';
import { statusCodeOf } from '../shared/http-status';

export { LIBRARY_PAGE_SIZE };

export type ResolvedLibraryGame = LibraryGameResponse | ProfileLibraryGameResponse;

export type ResolvedLibrary =
  | {
      status: typeof ResolvedStatuses.ok;
      games: ResolvedLibraryGame[];
      total: number;
      genres: string[];
      schedule: RefreshScheduleResponse | null;
      trophyProgress: TrophyProgressResponse | null;
      hiddenCount: number;
      psPlus: PsPlusRotationSummaryResponse | null;
    }
  | { status: typeof ResolvedStatuses.forbidden }
  | { status: typeof ResolvedStatuses.error };

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

export function trophyProgressOf(page: LibraryPageResponse | ProfileLibraryPageResponse): TrophyProgressResponse | null {
  return 'trophy_progress' in page ? page.trophy_progress : null;
}

export function hiddenCountOf(page: LibraryPageResponse | ProfileLibraryPageResponse): number {
  return 'hidden_count' in page ? page.hidden_count : 0;
}

export const initialLibraryQuery: LibraryQuery = {
  sort: LibrarySortFields.title,
  sortDir: SortDirections.asc,
  limit: LIBRARY_PAGE_SIZE,
  offset: 0,
};

export const libraryResolver: ResolveFn<ResolvedLibrary> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get(RouteParams.sub);

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
        status: ResolvedStatuses.ok,
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
      of<ResolvedLibrary>(statusCodeOf(err) === HttpStatusCode.Forbidden ? { status: ResolvedStatuses.forbidden } : { status: ResolvedStatuses.error }),
    ),
  );
};
