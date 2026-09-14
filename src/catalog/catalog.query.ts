import { Params } from '@angular/router';
import { CatalogGamesQuery } from '../curator/curator.service';
import { CatalogKind, CatalogSortField } from '../curator/curator.models';
import { trimmedOrNull } from '../shared/control-value';

export const CATALOG_PAGE_SIZE = 50;
export const CATALOG_PAGE_SIZE_CEILING = 200;
export const CATALOG_PAGE_SIZE_KEY = 'catalog';
export const DEFAULT_CATALOG_KIND: CatalogKind = 'game';
export const DEFAULT_CATALOG_SORT = 'title:asc';

export const CATALOG_KIND_OPTIONS: readonly { value: CatalogKind; label: string }[] = [
  { value: 'game', label: 'Games' },
  { value: 'media_app', label: 'Media apps' },
  { value: 'add_on', label: 'Add-ons' },
  { value: 'demo', label: 'Demos' },
  { value: 'soundtrack', label: 'Soundtracks' },
  { value: 'theme', label: 'Themes' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'all', label: 'Everything' },
];

export const CATALOG_SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'title:asc', label: 'Title (A–Z)' },
  { value: 'title:desc', label: 'Title (Z–A)' },
  { value: 'price:asc', label: 'Price (low to high)' },
  { value: 'price:desc', label: 'Price (high to low)' },
];

const KIND_VALUES: ReadonlySet<string> = new Set(CATALOG_KIND_OPTIONS.map((option) => option.value));
const SORT_VALUES: ReadonlySet<string> = new Set(CATALOG_SORT_OPTIONS.map((option) => option.value));

function text(params: Params, key: string): string | null {
  const value: unknown = params[key];
  return typeof value === 'string' ? trimmedOrNull(value) : null;
}

export function catalogPageSizeFrom(params: Params): number {
  const requested = Number(params['pageSize']);
  if (!Number.isInteger(requested) || requested < 1) {
    return CATALOG_PAGE_SIZE;
  }
  return Math.min(requested, CATALOG_PAGE_SIZE_CEILING);
}

export function catalogPageFrom(params: Params): number {
  const requested = Number(params['page']);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

export function catalogKindFrom(params: Params): CatalogKind {
  const requested = text(params, 'kind');
  return requested !== null && KIND_VALUES.has(requested)
    ? (requested as CatalogKind)
    : DEFAULT_CATALOG_KIND;
}

export function catalogSortValueFrom(params: Params): string {
  const field = text(params, 'sort');
  const direction = text(params, 'sortDir');
  if (field === null || direction === null) {
    return DEFAULT_CATALOG_SORT;
  }
  const requested = `${field}:${direction}`;
  return SORT_VALUES.has(requested) ? requested : DEFAULT_CATALOG_SORT;
}

export function catalogSearchFrom(params: Params): string | null {
  return text(params, 'q');
}

export function catalogFranchiseFrom(params: Params): string | null {
  return text(params, 'franchise');
}

export function catalogGenreFrom(params: Params): string | null {
  return text(params, 'genre');
}

export function catalogTierFrom(params: Params): string | null {
  return text(params, 'aaaTier');
}

export function catalogQueryFromParams(params: Params): CatalogGamesQuery {
  const pageSize = catalogPageSizeFrom(params);
  const [sort, sortDir] = catalogSortValueFrom(params).split(':');

  return {
    q: catalogSearchFrom(params) ?? undefined,
    franchise: catalogFranchiseFrom(params) ?? undefined,
    genre: catalogGenreFrom(params) ?? undefined,
    aaaTier: catalogTierFrom(params) ?? undefined,
    kind: catalogKindFrom(params),
    sort: sort as CatalogSortField,
    sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    limit: pageSize,
    offset: (catalogPageFrom(params) - 1) * pageSize,
  };
}

export function catalogQueryKey(query: CatalogGamesQuery): string {
  return JSON.stringify([
    query.q,
    query.franchise,
    query.genre,
    query.aaaTier,
    query.kind,
    query.sort,
    query.sortDir,
    query.limit,
    query.offset,
  ]);
}
