export const LIBRARY_ROW_ID_PREFIX = 'library-row-';

export const LIBRARY_PLATFORM_ID_PREFIX = 'library-platform-';

const LIBRARY_HEADER_ID_PREFIX = 'library-header-';

const LIBRARY_SORT_ID_PREFIX = 'library-sort-';

const LIBRARY_SORT_ARROW_ID_PREFIX = 'library-sort-arrow-';

export function libraryRowId(gameId: string): string {
  return `${LIBRARY_ROW_ID_PREFIX}${gameId}`;
}

export function libraryPlatformId(rowIndex: number, platformIndex: number): string {
  return `${LIBRARY_PLATFORM_ID_PREFIX}${rowIndex}-${platformIndex}`;
}

export function libraryHeaderId(columnId: string): string {
  return `${LIBRARY_HEADER_ID_PREFIX}${columnId}`;
}

export function librarySortId(columnId: string): string {
  return `${LIBRARY_SORT_ID_PREFIX}${columnId}`;
}

export function librarySortArrowId(columnId: string): string {
  return `${LIBRARY_SORT_ARROW_ID_PREFIX}${columnId}`;
}
