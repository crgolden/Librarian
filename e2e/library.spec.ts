/**
 * Library page E2E — auth guard redirect, and refresh-trigger + poll-to-terminal-status against
 * the mock Curator API (which transitions queued -> running -> a configurable terminal outcome
 * on short timers).
 */

import { test, expect } from './fixtures.js';

test.describe('Library — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Library — authenticated', () => {
  test('refreshing resolves to a success message', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.locator('h1')).toContainText('My Library');
    await page.getByRole('button', { name: 'Refresh library' }).click();

    await expect(page.locator('text=Library catalogued.')).toBeVisible({ timeout: 10_000 });
  });

  test('refreshing surfaces the job error on a failed run', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.setLibraryRefreshOutcome('failed', 'PSN entitlement fetch failed.');

    await page.goto('/library');
    await page.getByRole('button', { name: 'Refresh library' }).click();

    await expect(page.locator('text=PSN entitlement fetch failed.')).toBeVisible({ timeout: 10_000 });
  });

  test('shows a message when the library is empty', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.getByText('No games yet — run a refresh to build your library.')).toBeVisible();
  });

  test('renders ratings, category, and a PS Store link, with a dash for unresolved values', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: 'Elden Ring',
        category: 'Action RPG',
        rawg_rating: 96,
        opencritic_rating: 94,
        psn_rating: 4.8,
        psn_product_id: 'UP0700-CUSA23100_00-ELDENRING0000000',
        rawg_enriched: true,
        opencritic_enriched: true,
      },
      { game_id: 'g2', title: 'Unmatched Game', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const rows = page.locator('.library-table tbody tr');
    await expect(rows).toHaveCount(2);

    const eldenRow = rows.filter({ hasText: 'Elden Ring' });
    await expect(eldenRow).toContainText('Action RPG');
    await expect(eldenRow).toContainText('96');
    await expect(eldenRow).toContainText('94');
    await expect(eldenRow).toContainText('4.8');
    const link = eldenRow.getByRole('link', { name: 'View' });
    await expect(link).toHaveAttribute('href', 'https://store.playstation.com/en-us/product/UP0700-CUSA23100_00-ELDENRING0000000');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    const unmatchedRow = rows.filter({ hasText: 'Unmatched Game' });
    await expect(unmatchedRow).toContainText('—');
    await expect(unmatchedRow.getByRole('link', { name: 'View' })).toHaveCount(0);
  });

  test('searches by title', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Bloodborne', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(2);

    await page.getByPlaceholder('Search titles...').fill('elden');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.library-table tbody tr')).toContainText('Elden Ring');
  });

  test('filters by category', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', category: 'Action RPG', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Tetris Effect', category: 'Puzzle', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(2);

    await page.getByLabel('Filter by category').selectOption('Puzzle');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.library-table tbody tr')).toContainText('Tetris Effect');
  });

  test('sorts by clicking a column header, toggling direction on a second click', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Bloodborne', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Elden Ring', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const titles = () => page.locator('.library-table tbody tr td:first-child').allTextContents();
    // Title starts sorted ascending by default.
    await expect.poll(titles).toEqual(['Bloodborne', 'Elden Ring']);

    const titleHeader = page.getByRole('columnheader', { name: 'Title' });
    await titleHeader.click();
    await expect.poll(titles).toEqual(['Elden Ring', 'Bloodborne']);

    await titleHeader.click();
    await expect.poll(titles).toEqual(['Bloodborne', 'Elden Ring']);
  });

  test('pages through results', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames(
      Array.from({ length: 25 }, (_, i) => ({
        game_id: `g${i}`,
        title: `Game ${String(i).padStart(2, '0')}`,
        rawg_enriched: false,
        opencritic_enriched: false,
      })),
    );

    await page.goto('/library');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(20);
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.library-table tbody tr')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.locator('.library-table tbody tr')).toHaveCount(20);
  });

  test('combined search, sort, and page interaction stays internally consistent', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(
      Array.from({ length: 25 }, (_, i) => ({
        game_id: `g${i}`,
        title: `Ring Game ${String(i).padStart(2, '0')}`,
        rawg_enriched: false,
        opencritic_enriched: false,
      })).concat([
        { game_id: 'other-1', title: 'Something Else', rawg_enriched: false, opencritic_enriched: false },
        { game_id: 'other-2', title: 'Another Unrelated Game', rawg_enriched: false, opencritic_enriched: false },
      ]),
    );

    await page.goto('/library');
    // 27 total, unfiltered -> first page is a full 20-row page.
    await expect(page.locator('.library-table tbody tr')).toHaveCount(20);

    // Narrow to the 25 "Ring Game" titles -> still more than one page.
    await page.getByPlaceholder('Search titles...').fill('ring');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(20, { timeout: 5_000 });

    // Title starts sorted ascending by default -> one click flips it to descending: page 1 is
    // Ring Game 24 down through 05.
    const titleHeader = page.getByRole('columnheader', { name: 'Title' });
    await titleHeader.click();
    const titles = () => page.locator('.library-table tbody tr td:first-child').allTextContents();
    await expect
      .poll(titles)
      .toEqual(Array.from({ length: 20 }, (_, i) => `Ring Game ${String(24 - i).padStart(2, '0')}`));

    // Page forward -> the remaining 5 (Ring Game 04 down through 00), Next now disabled.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect.poll(titles).toEqual(Array.from({ length: 5 }, (_, i) => `Ring Game ${String(4 - i).padStart(2, '0')}`));
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // Changing the search again resets back to page 1.
    await page.getByPlaceholder('Search titles...').fill('ring game 01');
    await expect(page.locator('.library-table tbody tr')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.library-table tbody tr')).toContainText('Ring Game 01');
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  test('shows the post-refresh summary, capping the inline title list, and the OpenCritic top-up message', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const manyTitles = Array.from({ length: 12 }, (_, i) => `Game ${i + 1}`);
    await store.setLibraryRefreshOutcome('succeeded', undefined, {
      rawg_enriched_titles: manyTitles,
      opencritic_enriched_titles: ['Elden Ring'],
      opencritic_topup_incomplete: true,
    });

    await page.goto('/library');
    await page.getByRole('button', { name: 'Refresh library' }).click();

    await expect(page.locator('text=Library catalogued.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('+2 more')).toBeVisible();
    await expect(page.getByText('Elden Ring')).toBeVisible();
    await expect(
      page.getByText('OpenCritic still has more of your library to check'),
    ).toBeVisible();
  });
});
