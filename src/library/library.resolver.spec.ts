import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { libraryResolver, initialLibraryQuery, ResolvedLibrary } from './library.resolver';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import {
  LibraryGameResponse,
  PsPlusRotationSummaryResponse,
  RefreshScheduleResponse,
  TrophyProgressResponse,
} from '../curator/curator.models';

const GAMES = [{ game_id: 'g1', title: 'Bloodborne' }] as unknown as LibraryGameResponse[];

const SCHEDULE = {
  cadence: 'daily',
  ps_plus_watch: false,
  next_run_at: '2026-09-08T12:00:00Z',
  last_run_at: null,
  consecutive_failures: 0,
  paused_reason: null,
} satisfies RefreshScheduleResponse;

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
        getLibrary: () => of({ games: GAMES, total: 42 }),
        getLibraryGenres: () => of({ genres: ['RPG'] }),
        getRefreshSchedule: () => of(SCHEDULE),
      },
      null,
    );

    expect(result).toEqual({
      status: 'ok',
      games: GAMES,
      total: 42,
      genres: ['RPG'],
      schedule: SCHEDULE,
      trophyProgress: null,
      hiddenCount: 0,
      psPlus: null,
    });
  });

  it('carries the owner page’s trophy progress and hidden count through to the component', async () => {
    const trophyProgress = { state: 'off', reason: 'harvest_off' } satisfies TrophyProgressResponse;
    const hiddenCount = Math.floor(Math.random() * 50) + 1;
    const result = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1, trophy_progress: trophyProgress, hidden_count: hiddenCount }),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(404),
      },
      null,
    );

    expect(result).toMatchObject({ trophyProgress, hiddenCount });
  });

  it('asks for the PS Plus rotation summary only when the schedule watches PS Plus', async () => {
    const summary = { catalog_walked_at: '2026-09-01T00:00:00Z', unclaimed: 3, leaving: 1 } satisfies PsPlusRotationSummaryResponse;
    let askedWhileUnwatched = false;
    const watched = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1 }),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => of({ ...SCHEDULE, ps_plus_watch: true }),
        getPsPlusRotationSummary: () => of(summary),
      },
      null,
    );
    const unwatched = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1 }),
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
        getLibrary: () => of({ games: GAMES, total: 1 }),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: () => of({ ...SCHEDULE, ps_plus_watch: true }),
        getPsPlusRotationSummary: fails(404),
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
      'u1',
    );

    expect(asked).toEqual(['u1']);
    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
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
      'u1',
    );

    expect(asked).toBe(false);
    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
  });

  it('treats a schedule as best-effort, so a 404 for “no schedule yet” still resolves the library', async () => {
    const result = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1 }),
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(404),
      },
      null,
    );

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
  });

  it('starts on title-ascending, first page, with no filters applied', async () => {
    const queries: LibraryQuery[] = [];
    await run(
      {
        getLibrary: (query: LibraryQuery) => {
          queries.push(query);
          return of({ games: GAMES, total: 1 });
        },
        getLibraryGenres: () => of({ genres: [] }),
        getRefreshSchedule: fails(404),
      },
      null,
    );

    expect(queries).toEqual([initialLibraryQuery]);
    expect(initialLibraryQuery.offset).toBe(0);
    expect(initialLibraryQuery.sortDir).toBe('asc');
  });

  it('treats genres as best-effort, still resolving the games', async () => {
    const result = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 1 }),
        getLibraryGenres: fails(500),
        getRefreshSchedule: fails(404),
      },
      null,
    );

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null, trophyProgress: null, hiddenCount: 0, psPlus: null });
  });

  it('distinguishes a private library from a failed load', async () => {
    const forbidden = await run(
      { getUserLibrary: fails(403), getUserLibraryGenres: () => of({ genres: [] }) },
      'u1',
    );
    const failed = await run(
      { getUserLibrary: fails(500), getUserLibraryGenres: () => of({ genres: [] }) },
      'u1',
    );

    expect(forbidden).toEqual({ status: 'forbidden' });
    expect(failed).toEqual({ status: 'error' });
  });
});
