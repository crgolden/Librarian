
import { test, expect } from './fixtures.js';

const CATALOG_GRID_MINIMUM_TRACK_PX = 220;

const CATALOG_TILES = '[id^="catalog-title-"]';

const CATALOG_DEFAULT_PAGE_SIZE = 50;
const CATALOG_CHOSEN_PAGE_SIZE = 20;

const RAWG_HOME = 'https://rawg.io';

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

    await expect(page.locator('#page-title')).toContainText('Catalog');
    await expect(page.locator('text=Bloodborne')).toBeVisible();
    expect(page.url()).not.toContain('/bff/login');
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

  test('a RAWG score on either catalog page brings the backlink their terms require', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      {
        game_id: 'g1',
        canonical_title: 'Bloodborne',
        franchise: null,
        genre: 'RPG',
        aaa_tier: 'AAA',
        critical_score: 92,
        oc_score: null,
        psn_rating: null,
      },
    ]);

    await page.goto('/catalog');
    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RAWG_HOME);

    await page.goto('/catalog/g1');
    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RAWG_HOME);
  });

  test('a catalog with no RAWG score claims no RAWG data', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      {
        game_id: 'g1',
        canonical_title: 'Bloodborne',
        franchise: null,
        genre: 'RPG',
        aaa_tier: 'AAA',
        critical_score: null,
        oc_score: 91,
        psn_rating: null,
      },
    ]);

    await page.goto('/catalog');
    await expect(page.locator('#catalog-ratings-0')).toContainText('OpenCritic 91');
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);

    await page.goto('/catalog/g1');
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);
  });

  test('a catalog title opens that game’s own page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/catalog');
    await page.locator('#catalog-title-0').click();

    await page.waitForURL('**/catalog/g1', { timeout: 10_000 });
    await expect(page.locator('#page-title')).toContainText('Bloodborne');
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

  test('the server-rendered body names the game in the title and social tags, not the route default', async ({
    request,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: 'Souls', genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const body = await (await request.get('/catalog/g1')).text();

    expect(body).toContain('<title>Bloodborne');
    expect(body).not.toContain('<title>Game</title>');
    expect(body).toContain('property="og:title"');
    expect(body).toContain('property="og:description"');
    expect(body).toMatch(/<meta name="description" content="[^"]*Bloodborne/);
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
    await expect(page.locator('#page-title')).toContainText('Catalog');
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
    await page.locator('#genre').selectOption('Roguelike');
    await page.locator('#catalog-apply').click();

    await expect(page.locator('text=Hades')).toBeVisible();
    await expect(page.locator('text=Bloodborne')).toHaveCount(0);
  });

  test('a raw genre token filters on the whole token and fits the narrowest card the grid can produce', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'ROLE_PLAYING_GAMES', aaa_tier: 'AAA' },
      { game_id: 'g2', canonical_title: 'Thumper', franchise: null, genre: 'MUSIC/RHYTHM', aaa_tier: 'Indie' },
    ]);

    await page.goto('/catalog');
    await expect(page.locator('#catalog-genre-0')).toHaveText('ROLE_PLAYING_GAMES');

    const fit = await page.locator('#catalog-genre-0').evaluate((label, minimumTrack) => {
      const card = label.closest('li');
      if (card === null) return { renderedTokenWidth: Number.NaN, narrowestCardContent: Number.NaN };
      const cardStyle = getComputedStyle(card);
      const range = document.createRange();
      range.selectNodeContents(label);
      return {
        renderedTokenWidth: range.getBoundingClientRect().width,
        narrowestCardContent:
          minimumTrack - parseFloat(cardStyle.paddingLeft) - parseFloat(cardStyle.paddingRight),
      };
    }, CATALOG_GRID_MINIMUM_TRACK_PX);

    expect(
      fit.renderedTokenWidth,
      'the token measured zero width, so the fit assertion below would pass against nothing — the label box stretches to its flex line, so scrollWidth measures the box rather than the text',
    ).toBeGreaterThan(0);
    expect(
      fit.renderedTokenWidth,
      `the raw token renders at ${fit.renderedTokenWidth}px, wider than the ${fit.narrowestCardContent}px a card has at the grid floor, so it spills out of its tile on a narrow viewport`,
    ).toBeLessThanOrEqual(fit.narrowestCardContent);

    await page.locator('#genre').selectOption('ROLE_PLAYING_GAMES');
    await expect(page.locator('#genre')).toHaveValue('ROLE_PLAYING_GAMES');
    await page.locator('#catalog-apply').click();

    await expect(page.locator('[id^="catalog-title-"]')).toHaveCount(1);
    await expect(page.locator('#catalog-title-0')).toHaveText('Bloodborne');
  });

  test('pager enables Next on a full page and Previous after advancing', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(MANY_GAMES);

    await page.goto('/catalog');
    await expect(page.locator('#catalog-prev')).toBeDisabled();
    await expect(page.locator('#catalog-next')).toBeEnabled();

    await page.locator('#catalog-next').click();
    await expect(page.locator('#catalog-prev')).toBeEnabled();
  });

  test('the per-page choice resizes the page and outlives a reload', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(MANY_GAMES);

    await page.goto('/catalog');
    await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_DEFAULT_PAGE_SIZE);

    await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));
    await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);

    await page.reload();

    await expect(
      page.locator(CATALOG_TILES),
      'the catalog stores its choice under its own key, so a reload that falls back to 50 means the catalog is reading the library preference or none at all',
    ).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
    await expect(page.locator('#catalog-page-size')).toHaveValue(String(CATALOG_CHOSEN_PAGE_SIZE));
  });

  test('resizing the page returns to the first one rather than holding a stale offset', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames(MANY_GAMES);

    await page.goto('/catalog');
    await page.locator('#catalog-next').click();
    await expect(page.locator('#catalog-prev')).toBeEnabled();

    await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));

    await expect(
      page.locator('#catalog-prev'),
      'keeping the old offset after a resize can land past the end of the result set, which renders an empty page the pager still reports as valid',
    ).toBeDisabled();
    await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
  });
});
