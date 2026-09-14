import { Params } from '@angular/router';
import { LibrarySortField } from '../curator/curator.service';
import { trimmedOrNull } from '../shared/control-value';

export const LIBRARY_PAGE_SIZE_CEILING = 100;
export const LIBRARY_PAGE_SIZE_KEY = 'library';
export const DEFAULT_LIBRARY_SORT: LibrarySortField = 'title';

export const LIBRARY_SORT_FIELDS: ReadonlySet<string> = new Set<LibrarySortField>([
  'title',
  'genre',
  'rawg_rating',
  'opencritic_rating',
  'psn_rating',
  'percent_completed',
]);

function text(params: Params, key: string): string | null {
  const value: unknown = params[key];
  return typeof value === 'string' ? trimmedOrNull(value) : null;
}

export function librarySearchFrom(params: Params): string | null {
  return text(params, 'q');
}

export function libraryGenreFrom(params: Params): string | null {
  return text(params, 'genre');
}

export function librarySortFrom(params: Params): LibrarySortField {
  const requested = text(params, 'sort');
  return requested !== null && LIBRARY_SORT_FIELDS.has(requested)
    ? (requested as LibrarySortField)
    : DEFAULT_LIBRARY_SORT;
}

export function librarySortDescFrom(params: Params): boolean {
  return params['sortDir'] === 'desc';
}

export function libraryShowsHiddenFrom(params: Params): boolean {
  return params['hidden'] === 'only';
}

export function libraryPageSizeFrom(params: Params, fallback: number): number {
  const requested = Number(params['pageSize']);
  if (!Number.isInteger(requested) || requested < 1) {
    return fallback;
  }
  return Math.min(requested, LIBRARY_PAGE_SIZE_CEILING);
}

export function libraryPageFrom(params: Params): number {
  const requested = Number(params['page']);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

export function libraryQueryKey(params: Params, fallbackPageSize: number): string {
  return JSON.stringify([
    librarySearchFrom(params),
    libraryGenreFrom(params),
    librarySortFrom(params),
    librarySortDescFrom(params),
    libraryShowsHiddenFrom(params),
    libraryPageFrom(params),
    libraryPageSizeFrom(params, fallbackPageSize),
  ]);
}
