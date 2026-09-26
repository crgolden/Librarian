export const CATALOG_TITLE_ID_PREFIX = 'catalog-title-';

export function catalogTitleId(index: number): string {
  return `${CATALOG_TITLE_ID_PREFIX}${index}`;
}
