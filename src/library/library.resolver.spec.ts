import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { libraryResolver, initialLibraryQuery, ResolvedLibrary } from './library.resolver';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import { LibraryGameResponse } from '../curator/curator.models';

const GAMES = [{ game_id: 'g1', title: 'Bloodborne' }] as unknown as LibraryGameResponse[];

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
  it('resolves the caller’s own library and its categories', async () => {
    const result = await run(
      {
        getLibrary: () => of({ games: GAMES, total: 42 }),
        getLibraryCategories: () => of({ categories: ['RPG'] }),
      },
      null,
    );

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 42, categories: ['RPG'] });
  });

  it('asks for another user’s library when the route names a sub', async () => {
    const asked: string[] = [];
    const result = await run(
      {
        getUserLibrary: (sub: string) => {
          asked.push(sub);
          return of({ games: GAMES, total: 1 });
        },
        getUserLibraryCategories: () => of({ categories: [] }),
      },
      'u1',
    );

    expect(asked).toEqual(['u1']);
    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, categories: [] });
  });

  it('starts on title-ascending, first page, with no filters applied', async () => {
    const queries: LibraryQuery[] = [];
    await run(
      {
        getLibrary: (query: LibraryQuery) => {
          queries.push(query);
          return of({ games: GAMES, total: 1 });
        },
        getLibraryCategories: () => of({ categories: [] }),
      },
      null,
    );

    expect(queries).toEqual([initialLibraryQuery]);
    expect(initialLibraryQuery.offset).toBe(0);
    expect(initialLibraryQuery.sortDir).toBe('asc');
  });

  it('treats categories as best-effort, still resolving the games', async () => {
    const result = await run(
      { getLibrary: () => of({ games: GAMES, total: 1 }), getLibraryCategories: fails(500) },
      null,
    );

    expect(result).toEqual({ status: 'ok', games: GAMES, total: 1, categories: [] });
  });

  it('distinguishes a private library from a failed load', async () => {
    const forbidden = await run(
      { getUserLibrary: fails(403), getUserLibraryCategories: () => of({ categories: [] }) },
      'u1',
    );
    const failed = await run(
      { getUserLibrary: fails(500), getUserLibraryCategories: () => of({ categories: [] }) },
      'u1',
    );

    expect(forbidden).toEqual({ status: 'forbidden' });
    expect(failed).toEqual({ status: 'error' });
  });
});
