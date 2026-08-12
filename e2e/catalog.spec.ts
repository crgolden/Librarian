/**
 * Catalog page E2E — anonymous access, filtering, and pagination against the mock Curator API.
 */

import { test, expect } from './fixtures.js';

const MANY_GAMES = Array.from({ length: 60 }, (_, i) => ({
  game_id: `g${i}`,
  canonical_title: `Game ${String(i).padStart(2, '0')}`,
  franchise: 'Franchise',
  genre: i % 2 === 0 ? 'Action-Adventure' : 'RPG',
  aaa_tier: 'AAA',
}));

test.describe('Catalog — anonymous', () => {
  test('an unauthenticated visitor browses the catalog without signing in', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/catalog');

    await expect(page.locator('h1')).toContainText('Catalog');
    await expect(page.locator('text=Bloodborne')).toBeVisible();
    expect(page.url()).not.toContain('/bff/login');
  });

  test('the catalog is reachable from the footer without an account', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('.footer-nav').getByRole('link', { name: 'Catalog', exact: true }).click();

    await page.waitForURL('**/catalog', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Catalog');
  });

  test('shows each rating, and a dash where a score is missing', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      {
        game_id: 'g1',
        canonical_title: 'Bloodborne',
        franchise: null,
        genre: 'RPG',
        aaa_tier: 'AAA',
        critical_score: 92,
        oc_score: 91,
        psn_rating: null,
      },
    ]);

    await page.goto('/catalog');

    const ratings = page.locator('#catalog-ratings-0');
    await expect(ratings).toContainText('RAWG 92');
    await expect(ratings).toContainText('OpenCritic 91');
    await expect(ratings).toContainText('PS Store —');
  });

  test('a catalog title opens that game’s own page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/catalog');
    await page.getByRole('link', { name: 'Bloodborne' }).click();

    await page.waitForURL('**/catalog/g1', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Bloodborne');
  });

  test('an unknown game id renders a not-found page rather than an error', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/catalog/no-such-game');

    await expect(page.locator('body')).toContainText('Game not found');
  });

  test('the detail page is server-rendered, so a crawler following the sitemap sees the game', async ({
    request,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const response = await request.get('/catalog/g1');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Bloodborne');
  });
});

test.describe('Sitemap and robots', () => {
  test('the sitemap lists the public pages and every catalog game', async ({ request, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const response = await request.get('/sitemap.xml');
    const xml = await response.text();

    expect(response.status()).toBe(200);
    expect(xml).toContain('<loc>');
    expect(xml).toContain('/catalog/g1</loc>');
    expect(xml).toContain('/faq</loc>');
    expect(xml).not.toContain('/library</loc>');
  });

  test('robots.txt advertises the sitemap and blocks the signed-in areas', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain('/sitemap.xml');
    expect(body).toContain('Disallow: /library');
    expect(body).toContain('Disallow: /admin');
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
