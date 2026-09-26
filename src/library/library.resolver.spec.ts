import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { libraryResolver, initialLibraryQuery, ResolvedLibrary } from './library.resolver';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import {
  LibraryGameResponse,
  LibraryPageResponse,
  PsPlusRotationSummaryResponse,
  RefreshCadences,
  RefreshScheduleResponse,
  SortDirections,
  TrophyProgressReasons,
  TrophyProgressResponse,
  TrophyProgressStates,
} from '../curator/curator.models';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newCount, newId, newText, newUtcInstant } from '@crgolden/modules/testing';

const GAME_ID = newId();
const GAME_TITLE = newText();
const GENRE = newText();
const OTHER_SUB = newId();
const NEXT_RUN_AT = newUtcInstant();
const OWNER_TOTAL = newCount();

const GAMES = [{ game_id: GAME_ID, title: GAME_TITLE }] as unknown as LibraryGameResponse[];

const SCHEDULE = {
  cadence: RefreshCadences.daily,
  ps_plus_watch: false,
  next_run_at: NEXT_RUN_AT,
  last_run_at: null,
  consecutive_failures: 0,
  paused_reason: null,
} satisfies RefreshScheduleResponse;

const HARVESTING = { state: TrophyProgressStates.on, reason: null } satisfies TrophyProgressResponse;

function ownerPage(total: number): LibraryPageResponse {
  return { games: GAMES, total, trophy_progress: HARVESTING, hidden_count: 0 };
}

function run(curator: Partial<CuratorService>, sub: string | null): Promise<ResolvedLibrary> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  const route = { paramMap: { get: () => sub } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (libraryResolver(route, {} as never) as Observable<ResolvedLibrary>).subscribe(resolvePromise);
    });
  });
}

const fails = (status: number) => () => throwError(() => new HttpErrorResponse({ status }));

describe('libraryResolver', () => {
  it('resolves the caller’s own library and its genres', async () => {
    const result = await run(
      {
        getLibrary: () => of(ownerPage(OWNER_TOTAL)),
        getLibraryGenres: () => of({ genres: [GENRE] }),
        getRefreshSchedule: () => of(SCHEDULE),
      },
      null,
    );

    expect(result).toEqual({
      status: ResolvedStatuses.ok,
      games: GAMES,
      total: OWNER_TOTAL,
      genres: [GENRE],
      schedule: SCHEDULE,
      trophyProgress: HARVESTING,
      hiddenCount: 0,
      psPlus: null,
    });
  });

  it('carries the owner page’s trophy progress and hidden count through to the component', async () => {
    const trophyProgress = { state: TrophyProgressStates.off, reason: TrophyProgressReasons.harvestOff } satisfies TrophyProgressResponse;
    const hiddenCount = newCount();
    const result = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1, trophy_progress: trophyProgress, hidden_count: hiddenCount }),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(HttpStatusCode.NotFound),
      },
      null,
    );

    expect(result).toMatchObject({ trophyProgress, hiddenCount });
  });

  it('asks for the PS Plus rotation summary only when the schedule watches PS Plus', async () => {
    const summary = { catalog_walked_at: newUtcInstant(), unclaimed: newCount(), leaving: newCount() } satisfies PsPlusRotationSummaryResponse;
    let askedWhileUnwatched = false;
    const watched = await run(
      {
        getLibrary: () => of(ownerPage(1)),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => of({ ...SCHEDULE, ps_plus_watch: true }),
        getPsPlusRotationSummary: () => of(summary),
      },
      null,
    );
    const unwatched = await run(
      {
        getLibrary: () => of(ownerPage(1)),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => of(SCHEDULE),
        getPsPlusRotationSummary: () => {
          askedWhileUnwatched = true;
          return of(summary);
        },
      },
      null,
    );

    expect(watched).toMatchObject({ psPlus: summary });
    expect(unwatched).toMatchObject({ psPlus: null });
    expect(askedWhileUnwatched).toBe(false);
  });

  it('treats the PS Plus summary as best-effort, keeping the schedule when the summary fails', async () => {
    const result = await run(
      {
        getLibrary: () => of(ownerPage(1)),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => of({ ...SCHEDULE, ps_plus_watch: true }),
        getPsPlusRotationSummary: fails(HttpStatusCode.NotFound),
      },
      null,
    );

    expect(result).toMatchObject({ schedule: { ...SCHEDULE, ps_plus_watch: true }, psPlus: null });
  });

  it('asks for another user’s library when the route names a sub', async () => {
    const asked: string[] = [];
    const result = await run(
      {
        getUserLibrary: (sub: string) => {
          asked.push(sub);
          return of({ games: GAMES, total: 1 });
        },
        getUserLibraryGenres: () => of({ genres: [] }),
      },
      OTHER_SUB,
    );

    expect(asked).toEqual([OTHER_SUB]);
    expect(result).toEqual({ status: ResolvedStatuses.ok, games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
  });

  it('never asks for a schedule in viewer mode, because the schedule belongs to the library’s owner', async () => {
    let asked = false;
    const result = await run(
      {
        getUserLibrary: () => of({ games: GAMES, total: 1 }),
        getUserLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => {
          asked = true;
          return of(SCHEDULE);
        },
      },
      OTHER_SUB,
    );

    expect(asked).toBe(false);
    expect(result).toEqual({ status: ResolvedStatuses.ok, games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
  });

  it('treats a schedule as best-effort, so a 404 for “no schedule yet” still resolves the library', async () => {
    const result = await run(
      {
        getLibrary: () => of(ownerPage(1)),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(HttpStatusCode.NotFound),
      },
      null,
    );

    expect(result).toEqual({ status: ResolvedStatuses.ok, games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: HARVESTING, hiddenCount: 0, psPlus: null });
  });

  it('starts on title-ascending, first page, with no filters applied', async () => {
    const queries: LibraryQuery[] = [];
    await run(
      {
        getLibrary: (query: LibraryQuery) => {
          queries.push(query);
          return of(ownerPage(1));
        },
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(HttpStatusCode.NotFound),
      },
      null,
    );

    expect(queries).toEqual([initialLibraryQuery]);
    expect(initialLibraryQuery.offset).toBe(0);
    expect(initialLibraryQuery.sortDir).toBe(SortDirections.asc);
  });

  it('treats genres as best-effort, still resolving the games', async () => {
    const result = await run(
      {
        getLibrary: () => of(ownerPage(1)),
        getLibraryGenres: fails(HttpStatusCode.InternalServerError),
        getRefreshSchedule: fails(HttpStatusCode.NotFound),
      },
      null,
    );

    expect(result).toEqual({ status: ResolvedStatuses.ok, games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: HARVESTING, hiddenCount: 0, psPlus: null });
  });

  it('distinguishes a private library from a failed load', async () => {
    const forbidden = await run(
      { getUserLibrary: fails(HttpStatusCode.Forbidden), getUserLibraryGenres: () => of({ genres: [] }) },
      OTHER_SUB,
    );
    const failed = await run(
      { getUserLibrary: fails(HttpStatusCode.InternalServerError), getUserLibraryGenres: () => of({ genres: [] }) },
      OTHER_SUB,
    );

    expect(forbidden).toEqual({ status: ResolvedStatuses.forbidden });
    expect(failed).toEqual({ status: ResolvedStatuses.error });
  });
});
