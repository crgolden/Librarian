import { beforeEach, describe, expect, it } from 'vitest';
import { pageSizeChoicesUpTo, readPageSize, writePageSize } from './page-size.preference';

describe('page size preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers no choice above the ceiling the route enforces', () => {
    const ceiling = 100;
    const choices = pageSizeChoicesUpTo(ceiling, 20);

    expect(choices.length).toBeGreaterThan(0);
    expect(Math.max(...choices)).toBeLessThanOrEqual(ceiling);
  });

  it('keeps the fallback selectable even when it is not one of the standard choices', () => {
    const fallback = 7 + Math.floor(Math.random() * 11);
    const choices = pageSizeChoicesUpTo(200, fallback);

    expect(choices).toContain(fallback);
    expect([...choices]).toEqual([...choices].sort((a, b) => a - b));
  });

  it('round-trips a stored choice', () => {
    const key = `key-${Math.floor(Math.random() * 1000)}`;
    const choices = pageSizeChoicesUpTo(200, 50);
    const chosen = choices[choices.length - 1];

    writePageSize(key, chosen);

    expect(readPageSize(key, choices, 50)).toBe(chosen);
  });

  it('falls back rather than trusting a stored value the choices no longer contain', () => {
    const key = `key-${Math.floor(Math.random() * 1000)}`;
    const fallback = 20;
    const narrowedChoices = pageSizeChoicesUpTo(100, fallback);
    const widerChoice = Math.max(...pageSizeChoicesUpTo(200, fallback));

    writePageSize(key, widerChoice);

    expect(narrowedChoices).not.toContain(widerChoice);
    expect(readPageSize(key, narrowedChoices, fallback)).toBe(fallback);
  });

  it('falls back rather than throwing when storage holds something that is not a number', () => {
    const key = `key-${Math.floor(Math.random() * 1000)}`;
    const fallback = 20;
    localStorage.setItem(`librarian.page-size.${key}`, 'not-a-number');

    expect(readPageSize(key, pageSizeChoicesUpTo(200, fallback), fallback)).toBe(fallback);
  });
});
