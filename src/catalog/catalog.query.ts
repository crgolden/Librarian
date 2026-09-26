import { Params } from '@angular/router';
import { CatalogGamesQuery } from '../curator/curator.service';
import {
  ALL_CATALOG_KINDS,
  CatalogKind,
  CatalogSortField,
  CatalogSortFields,
  ContentKinds,
  SortDirections,
} from '../curator/curator.models';
import { trimmedOrNull } from '../shared/control-value';
import { catalogSortValue } from './catalog-sort';

export { catalogSortValue };

export const CATALOG_PAGE_SIZE = 50;
export const CATALOG_PAGE_SIZE_CEILING = 200;
export const CATALOG_PAGE_SIZE_KEY = 'catalog';
export const CatalogQueryParams = {
  q: 'q',
  franchise: 'franchise',
  genre: 'genre',
  aaaTier: 'aaaTier',
  kind: 'kind',
  sort: 'sort',
  sortDir: 'sortDir',
  page: 'page',
  pageSize: 'pageSize',
} as const;

export const DEFAULT_CATALOG_KIND: CatalogKind = ContentKinds.game;
export const DEFAULT_CATALOG_SORT = catalogSortValue(CatalogSortFields.title, SortDirections.asc);

export const CATALOG_KIND_OPTIONS: readonly { value: CatalogKind; label: string }[] = [
  { value: ContentKinds.game, label: 'Games' },
  { value: ContentKinds.mediaApp, label: 'Media apps' },
  { value: ContentKinds.addOn, label: 'Add-ons' },
  { value: ContentKinds.demo, label: 'Demos' },
  { value: ContentKinds.soundtrack, label: 'Soundtracks' },
  { value: ContentKinds.theme, label: 'Themes' },
  { value: ContentKinds.subscription, label: 'Subscriptions' },
  { value: ALL_CATALOG_KINDS, label: 'Everything' },
];

export const CATALOG_SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: catalogSortValue(CatalogSortFields.title, SortDirections.asc), label: 'Title (A–Z)' },
  { value: catalogSortValue(CatalogSortFields.title, SortDirections.desc), label: 'Title (Z–A)' },
  { value: catalogSortValue(CatalogSortFields.price, SortDirections.asc), label: 'Price (low to high)' },
  { value: catalogSortValue(CatalogSortFields.price, SortDirections.desc), label: 'Price (high to low)' },
];

const KIND_VALUES: ReadonlySet<string> = new Set(CATALOG_KIND_OPTIONS.map((option) => option.value));
const SORT_VALUES: ReadonlySet<string> = new Set(CATALOG_SORT_OPTIONS.map((option) => option.value));

function text(params: Params, key: string): string | null {
  const value: unknown = params[key];
  return typeof value === 'string' ? trimmedOrNull(value) : null;
}

export function catalogPageSizeFrom(params: Params): number {
  const requested = Number(params[CatalogQueryParams.pageSize]);
  if (!Number.isInteger(requested) || requested < 1) {
    return CATALOG_PAGE_SIZE;
  }
  return Math.min(requested, CATALOG_PAGE_SIZE_CEILING);
}

export function catalogPageFrom(params: Params): number {
  const requested = Number(params[CatalogQueryParams.page]);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

export function catalogKindFrom(params: Params): CatalogKind {
  const requested = text(params, CatalogQueryParams.kind);
  return requested !== null && KIND_VALUES.has(requested)
    ? (requested as CatalogKind)
    : DEFAULT_CATALOG_KIND;
}

export function catalogSortValueFrom(params: Params): string {
  const field = text(params, CatalogQueryParams.sort);
  const direction = text(params, CatalogQueryParams.sortDir);
  if (field === null || direction === null) {
    return DEFAULT_CATALOG_SORT;
  }
  const requested = `${field}:${direction}`;
  return SORT_VALUES.has(requested) ? requested : DEFAULT_CATALOG_SORT;
}

export function catalogSearchFrom(params: Params): string | null {
  return text(params, CatalogQueryParams.q);
}

export function catalogFranchiseFrom(params: Params): string | null {
  return text(params, CatalogQueryParams.franchise);
}

export function catalogGenreFrom(params: Params): string | null {
  return text(params, CatalogQueryParams.genre);
}

export function catalogTierFrom(params: Params): string | null {
  return text(params, CatalogQueryParams.aaaTier);
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
    sortDir: sortDir === SortDirections.desc ? SortDirections.desc : SortDirections.asc,
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
