export const CATALOG_TITLE_ID_PREFIX = 'catalog-title-';
export const CATALOG_KIND_CONTROL_ID = 'catalog-kind';
export const CATALOG_SORT_CONTROL_ID = 'catalog-sort';
export const CATALOG_SEARCH_CONTROL_ID = 'catalog-search';
export const CATALOG_FRANCHISE_CONTROL_ID = 'franchise';
export const CATALOG_GENRE_CONTROL_ID = 'genre';
export const CATALOG_TIER_CONTROL_ID = 'aaaTier';
export const ANY_OPTION_INDEX = 0;

export function catalogTitleId(index: number): string {
  return `${CATALOG_TITLE_ID_PREFIX}${index}`;
}
