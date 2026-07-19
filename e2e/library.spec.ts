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

  test('renders a checkmark table reflecting per-provider enrichment status, including for a user with no keys configured', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', rawg_enriched: true, opencritic_enriched: true },
      { game_id: 'g2', title: 'Unmatched Game', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const rows = page.locator('.library-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Elden Ring' })).toContainText('✓');
    await expect(rows.filter({ hasText: 'Unmatched Game' })).toContainText('—');
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
