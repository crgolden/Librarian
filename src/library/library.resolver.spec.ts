import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { libraryResolver, initialLibraryQuery, ResolvedLibrary } from './library.resolver';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import { LibraryGameResponse, RefreshScheduleResponse } from '../curator/curator.models';

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

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 42, genres: ['RPG'], schedule: SCHEDULE });
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
    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null });
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
    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null });
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

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null });
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

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, genres: [], schedule: null });
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
