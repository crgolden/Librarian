/**
 * Catalog page E2E — auth guard redirect, filtering, and pagination against the mock Curator API.
 */

import { test, expect } from './fixtures.js';

const MANY_GAMES = Array.from({ length: 60 }, (_, i) => ({
  game_id: `g${i}`,
  canonical_title: `Game ${String(i).padStart(2, '0')}`,
  franchise: 'Franchise',
  genre: i % 2 === 0 ? 'Action-Adventure' : 'RPG',
  aaa_tier: 'AAA',
}));

test.describe('Catalog — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Catalog — authenticated', () => {
  test('lists games from the catalog', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/catalog');
    await expect(page.locator('h1')).toContainText('Catalog');
    await expect(page.locator('text=Bloodborne')).toBeVisible();
  });

  test('filtering by genre narrows the results', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
      { game_id: 'g2', canonical_title: 'Hades', franchise: null, genre: 'Roguelike', aaa_tier: 'Indie' },
    ]);

    await page.goto('/catalog');
    await expect(page.locator('text=Bloodborne')).toBeVisible();
    await page.getByLabel('Genre').fill('Roguelike');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('text=Hades')).toBeVisible();
    await expect(page.locator('text=Bloodborne')).toHaveCount(0);
  });

  test('pager enables Next on a full page and Previous after advancing', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(MANY_GAMES);

    await page.goto('/catalog');
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });
});
