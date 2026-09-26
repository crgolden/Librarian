import type { CatalogSortField, SortDirection } from '../curator/curator.models';

export function catalogSortValue(field: CatalogSortField, direction: SortDirection): string {
  return `${field}:${direction}`;
}
