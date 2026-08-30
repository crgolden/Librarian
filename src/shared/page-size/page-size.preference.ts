const PAGE_SIZE_CHOICES = [20, 50, 100, 200];

const STORAGE_PREFIX = 'librarian.page-size.';

export function pageSizeChoicesUpTo(ceiling: number, fallback: number): number[] {
  const withinCeiling = PAGE_SIZE_CHOICES.filter((choice) => choice <= ceiling);
  return withinCeiling.includes(fallback) ? withinCeiling : [...withinCeiling, fallback].sort((a, b) => a - b);
}

export function readPageSize(key: string, choices: readonly number[], fallback: number): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_PREFIX + key));
    return choices.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function writePageSize(key: string, value: number): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, String(value));
  } catch {
    return;
  }
}
