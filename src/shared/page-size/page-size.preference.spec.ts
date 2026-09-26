import { beforeEach, describe, expect, it } from 'vitest';
import { PAGE_SIZE_STORAGE_PREFIX, pageSizeChoicesUpTo, readPageSize, writePageSize } from './page-size.preference';
import { environment } from '../../environments/environment';
import { newId, newText, randomIntBetween } from '@crgolden/modules/testing';

const SMALLEST_CHOICE = Math.min(...environment.pageSizeChoices);
const LARGEST_CHOICE = Math.max(...environment.pageSizeChoices);

describe('page size preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers no choice above the ceiling the route enforces', () => {
    const ceiling = randomIntBetween(SMALLEST_CHOICE, LARGEST_CHOICE);
    const choices = pageSizeChoicesUpTo(ceiling, SMALLEST_CHOICE);

    expect(choices.length).toBeGreaterThan(0);
    expect(Math.max(...choices)).toBeLessThanOrEqual(ceiling);
  });

  it('keeps the fallback selectable even when it is not one of the standard choices', () => {
    const fallback = randomIntBetween(1, SMALLEST_CHOICE);
    const choices = pageSizeChoicesUpTo(LARGEST_CHOICE, fallback);

    expect(choices).toContain(fallback);
    expect([...choices]).toEqual([...choices].sort((a, b) => a - b));
  });

  it('round-trips a stored choice', () => {
    const key = newId();
    const choices = pageSizeChoicesUpTo(LARGEST_CHOICE, SMALLEST_CHOICE);
    const chosen = choices[choices.length - 1];

    writePageSize(key, chosen);

    expect(readPageSize(key, choices, SMALLEST_CHOICE)).toBe(chosen);
  });

  it('falls back rather than trusting a stored value the choices no longer contain', () => {
    const key = newId();
    const fallback = SMALLEST_CHOICE;
    const narrowedChoices = pageSizeChoicesUpTo(LARGEST_CHOICE - 1, fallback);
    const widerChoice = Math.max(...pageSizeChoicesUpTo(LARGEST_CHOICE, fallback));

    writePageSize(key, widerChoice);

    expect(narrowedChoices).not.toContain(widerChoice);
    expect(readPageSize(key, narrowedChoices, fallback)).toBe(fallback);
  });

  it('falls back rather than throwing when storage holds something that is not a number', () => {
    const key = newId();
    const fallback = SMALLEST_CHOICE;
    localStorage.setItem(`${PAGE_SIZE_STORAGE_PREFIX}${key}`, newText());

    expect(readPageSize(key, pageSizeChoicesUpTo(LARGEST_CHOICE, fallback), fallback)).toBe(fallback);
  });
});
