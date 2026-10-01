import { constants } from 'node:http2';
import { newText, randomIntBetween } from '@crgolden/modules/testing';
import { test, expect, newCatalogGame } from '../e2e/fixtures.js';
import { HtmlMarkup, SitemapMarkup } from '../e2e/markup-constants';
import { PRIVATE_PREFIXES, ROBOTS_DISALLOW, ROBOTS_PATH, SITEMAP_PATH } from '../src/bff/sitemap-contract';
import { AppUrls, catalogGameUrl } from '../src/app/app-paths';
import { CATALOG_PAGE_SIZE, CatalogQueryParams } from '../src/catalog/catalog.query';
import { MetaNames, MetaProperties } from '../src/shared/seo-contract';
import { PageTitles } from '../src/shared/page-title';

function gamesSpanningTwoPages() {
  return Array.from({ length: CATALOG_PAGE_SIZE + randomIntBetween(1, CATALOG_PAGE_SIZE) }, newCatalogGame);
}

test.describe('Catalog server rendering', () => {
  test('the detail page is server-rendered, so a crawler following the sitemap sees the game', async ({
    request,
    store,
  }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    const response = await request.get(catalogGameUrl(game.game_id));

    expect(response.status()).toBe(constants.HTTP_STATUS_OK);
    expect(await response.text()).toContain(game.canonical_title);
  });

  test('the catalog list is server-rendered, so a crawler sees the titles rather than an empty shell', async ({
    request,
    store,
  }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    const response = await request.get(AppUrls.catalog);

    expect(response.status()).toBe(constants.HTTP_STATUS_OK);
    expect(await response.text()).toContain(game.canonical_title);
  });

  test('a deep link into the list is server-rendered on the page it names', async ({ request, store }) => {
    await store.reset();
    const games = gamesSpanningTwoPages();
    await store.seedCatalogGames(games);
    const titlesInListOrder = games.map((game) => game.canonical_title).sort((left, right) => left.localeCompare(right));
    const lastPage = Math.ceil(games.length / CATALOG_PAGE_SIZE);
    const lastPageQuery = new URLSearchParams({
      [CatalogQueryParams.page]: String(lastPage),
      [CatalogQueryParams.pageSize]: String(CATALOG_PAGE_SIZE),
    });

    const body = await (await request.get(`${AppUrls.catalog}?${lastPageQuery.toString()}`)).text();

    expect(body).toContain(titlesInListOrder[CATALOG_PAGE_SIZE]);
    expect(body).not.toContain(titlesInListOrder[0]);
  });

  test('the server-rendered body names the game in the title and social tags, not the route default', async ({
    request,
    store,
  }) => {
    await store.reset();
    const game = { ...newCatalogGame(), franchise: newText() };
    await store.seedCatalogGames([game]);

    const body = await (await request.get(catalogGameUrl(game.game_id))).text();

    expect(body).toContain(`${HtmlMarkup.titleOpen}${game.canonical_title}`);
    expect(body).not.toContain(`${HtmlMarkup.titleOpen}${PageTitles.game}${HtmlMarkup.titleClose}`);
    expect(body).toContain(`property="${MetaProperties.ogTitle}"`);
    expect(body).toContain(`property="${MetaProperties.ogDescription}"`);
    expect(body).toMatch(new RegExp(`<meta name="${MetaNames.description}" content="[^"]*${game.canonical_title}`));
  });
});

test.describe('Sitemap and robots', () => {
  test('the sitemap lists the public pages and every catalog game', async ({ request, store }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    const response = await request.get(SITEMAP_PATH);
    const xml = await response.text();

    expect(response.status()).toBe(constants.HTTP_STATUS_OK);
    expect(xml).toContain(SitemapMarkup.locOpen);
    expect(xml).toContain(`${catalogGameUrl(game.game_id)}${SitemapMarkup.locClose}`);
    expect(xml).toContain(`${AppUrls.faq}${SitemapMarkup.locClose}`);
    expect(xml).not.toContain(`${AppUrls.library}${SitemapMarkup.locClose}`);
  });

  test('robots.txt advertises the sitemap and blocks the signed-in areas', async ({ request }) => {
    const response = await request.get(ROBOTS_PATH);
    const body = await response.text();

    expect(response.status()).toBe(constants.HTTP_STATUS_OK);
    expect(body).toContain(SITEMAP_PATH);
    for (const prefix of PRIVATE_PREFIXES) {
      expect(body).toContain(`${ROBOTS_DISALLOW}${prefix}`);
    }
  });
});
