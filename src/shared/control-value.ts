export function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
}

export function selectionOf(value: string | null): string {
  return value ?? '';
}

export function nullIfNoSelection(value: string): string | null {
  return value.length > 0 ? value : null;
}
