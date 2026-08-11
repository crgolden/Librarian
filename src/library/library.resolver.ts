import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import { LibraryGameResponse, ProfileLibraryGameResponse } from '../curator/curator.models';

export const LIBRARY_PAGE_SIZE = 20;

export type ResolvedLibraryGame = LibraryGameResponse | ProfileLibraryGameResponse;

/**
 * "This library is private" is a different page from "this library failed to load", so a bare `null`
 * would flatten the two -- the same reason `publicCollectionResolver` returns a tagged result.
 */
export type ResolvedLibrary =
  | { status: 'ok'; games: ResolvedLibraryGame[]; total: number; categories: string[] }
  | { status: 'forbidden' }
  | { status: 'error' };

/** The query the table starts on: title ascending, first page, no search or category filter. */
export const initialLibraryQuery: LibraryQuery = {
  sort: 'title',
  sortDir: 'asc',
  limit: LIBRARY_PAGE_SIZE,
  offset: 0,
};

/**
 * Resolves the library's first page *and* its category options together, for either owner mode
 * (`/library`) or viewer mode (`/library/:sub`).
 *
 * Both were separate `ngOnInit` fetches with independent completion, which is what made the Library
 * E2E flaky enough to need `expect.poll(..., { timeout: 10_000 })` on every assertion (commit
 * `83f003f`): the table, the category `<select>` and the empty state each appeared on their own
 * schedule. Resolving them as one payload means the page has no half-rendered state to observe.
 *
 * The category list is best-effort -- a failure there yields an empty list rather than failing the
 * page, because the games are the page and the filter is an affordance on top of it.
 */
export const libraryResolver: ResolveFn<ResolvedLibrary> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get('sub');

  const games =
    sub !== null ? curator.getUserLibrary(sub, initialLibraryQuery) : curator.getLibrary(initialLibraryQuery);
  const categories = (sub !== null ? curator.getUserLibraryCategories(sub) : curator.getLibraryCategories()).pipe(
    catchError(() => of({ categories: [] })),
  );

  return forkJoin({ games, categories }).pipe(
    map(
      (data): ResolvedLibrary => ({
        status: 'ok',
        games: data.games.games,
        total: data.games.total,
        categories: data.categories.categories,
      }),
    ),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedLibrary>(err.status === 403 ? { status: 'forbidden' } : { status: 'error' }),
    ),
  );
};
