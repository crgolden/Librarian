import { Params } from '@angular/router';
import { CollectionItemSortField, CollectionItemSortFields, SortDirection, SortDirections } from '../curator/curator.models';
import { trimmedOrNull } from '../shared/control-value';

export const ITEMS_PAGE_SIZE = 50;

export const DEFAULT_ITEM_SORT: CollectionItemSortField = CollectionItemSortFields.rank;

const SORT_FIELDS: ReadonlySet<string> = new Set<CollectionItemSortField>([
  CollectionItemSortFields.rank,
  CollectionItemSortFields.title,
  CollectionItemSortFields.ocScore,
  CollectionItemSortFields.psnRating,
]);

export function itemsSearchFrom(params: Params): string | null {
  const value: unknown = params['itemQ'];
  return typeof value === 'string' ? trimmedOrNull(value) : null;
}

export function itemsSortFrom(params: Params): CollectionItemSortField {
  const value: unknown = params['itemSort'];
  return typeof value === 'string' && SORT_FIELDS.has(value)
    ? (value as CollectionItemSortField)
    : DEFAULT_ITEM_SORT;
}

export function itemsSortDirFrom(params: Params): SortDirection {
  return params['itemSortDir'] === SortDirections.desc ? SortDirections.desc : SortDirections.asc;
}

export function itemsPageFrom(params: Params): number {
  const requested = Number(params['itemPage']);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

export function itemsOffsetFrom(params: Params): number {
  return (itemsPageFrom(params) - 1) * ITEMS_PAGE_SIZE;
}

export function itemsQueryKey(params: Params): string {
  return JSON.stringify([
    itemsSearchFrom(params),
    itemsSortFrom(params),
    itemsSortDirFrom(params),
    itemsPageFrom(params),
  ]);
}
