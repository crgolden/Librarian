
import { constants } from 'node:http2';
import { newCount, newCountCeiling, newId, newMemberOtherThan, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

import { test, expect, DEFAULT_E2E_SUB, newCatalogGame, newScore } from './fixtures.js';
import { dehydratedMarkersLeft } from './hydration.js';
import { HtmlMarkup, SitemapMarkup } from './markup-constants';
import { PsnGenreTokens } from './psn-constants';
import { RawgConstants } from './rawg-constants';
import e2eSettings from './e2e-settings.json';
import { CuratorApi, CuratorQueryParams } from '../src/curator/curator-api';
import { BffPaths } from '../src/shared/bff-contract';
import { PRIVATE_PREFIXES, ROBOTS_DISALLOW, ROBOTS_PATH, SITEMAP_PATH } from '../src/bff/sitemap-contract';
import { AppUrls, catalogGameUrl } from '../src/app/app-paths';
import { CATALOG_TITLE_ID_PREFIX } from '../src/catalog/catalog-ids';
import {
  CatalogSortFields,
  CollectionKinds,
  CollectionVisibilities,
  ContentKinds,
  SortDirections,
} from '../src/curator/curator.models';
import { catalogSortValue } from '../src/catalog/catalog-sort';
import { CATALOG_PAGE_SIZE, CATALOG_PAGE_SIZE_CEILING, CatalogQueryParams } from '../src/catalog/catalog.query';
import { pageSizeChoicesUpTo } from '../src/shared/page-size/page-size.preference';
import { MetaNames, MetaProperties } from '../src/shared/seo-contract';
import { PageTitles } from '../src/shared/page-title';

const CATALOG_GRID_MINIMUM_TRACK_PX = e2eSettings.catalogGridMinimumTrackPx;

const CATALOG_TILES = `[id^="${CATALOG_TITLE_ID_PREFIX}"]`;

const CATALOG_CHOSEN_PAGE_SIZE = newMemberOtherThan(
  pageSizeChoicesUpTo(CATALOG_PAGE_SIZE_CEILING, CATALOG_PAGE_SIZE),
  CATALOG_PAGE_SIZE,
);

type CatalogGamesBody = { games: { game_id: string }[] };

function gamesSpanningTwoPages() {
  return Array.from({ length: CATALOG_PAGE_SIZE + randomIntBetween(1, CATALOG_PAGE_SIZE) }, newCatalogGame);
}

function gamesFillingEitherPageSize() {
  return Array.from({ length: CATALOG_PAGE_SIZE + CATALOG_CHOSEN_PAGE_SIZE }, newCatalogGame);
}

function newCatalogPrice(cents: number) {
  return {
    is_free: false,
    tied_to_subscription: false,
    base_cents: cents,
    discounted_cents: cents,
    discount_text: null,
    fetched_at: newUtcInstant(),
  };
}

test.describe('Catalog — anonymous', () => {
  test('an unauthenticated visitor browses the catalog without signing in', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    await page.goto(AppUrls.catalog);

    await expect(page.locator('#catalog-search')).toBeVisible();
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(game.game_id));
    expect(page.url()).not.toContain(BffPaths.login);
  });

  test('shows each rating, and a dash where a score is missing', async ({ anonymousPage: page, store }) => {
    await store.reset();
    const rawgScore = newScore();
    const openCriticScore = newScore();
    await store.seedCatalogGames([
      {
        ...newCatalogGame(),
        critical_score: rawgScore,
        oc_score: openCriticScore,
        psn_rating: null,
      },
    ]);

    await page.goto(AppUrls.catalog);

    await expect(page.locator('#catalog-rawg-score-0')).toHaveAttribute('data-score', String(rawgScore));
    await expect(page.locator('#catalog-opencritic-score-0')).toHaveAttribute('data-score', String(openCriticScore));
    await expect(page.locator('#catalog-psn-rating-0')).toBeVisible();
    await expect(page.locator('#catalog-psn-rating-0')).not.toHaveAttribute('data-score');
  });

  test('a RAWG score on either catalog page brings the backlink their terms require', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    const scoredGame = {
      ...newCatalogGame(),
      critical_score: newScore(),
      oc_score: null,
      psn_rating: null,
    };
    await store.seedCatalogGames([scoredGame]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RawgConstants.home);

    await page.goto(catalogGameUrl(scoredGame.game_id));
    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RawgConstants.home);
  });

  test('a catalog with no RAWG score claims no RAWG data', async ({ anonymousPage: page, store }) => {
    await store.reset();
    const gameId = newId();
    const openCriticScore = newScore();
    await store.seedCatalogGames([
      {
        ...newCatalogGame(),
        game_id: gameId,
        critical_score: null,
        oc_score: openCriticScore,
        psn_rating: null,
      },
    ]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-opencritic-score-0')).toHaveAttribute('data-score', String(openCriticScore));
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);

    await page.goto(catalogGameUrl(gameId));
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);
  });

  test('a catalog title opens that game’s own page', async ({ anonymousPage: page, store }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    await page.goto(AppUrls.catalog);
    await page.locator('#catalog-title-0').click();

    await page.waitForURL(`**${catalogGameUrl(game.game_id)}`);
    await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
  });

  test('an unknown game id renders a not-found page rather than an error', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(catalogGameUrl(newId()));

    await expect(page.locator('#catalog-detail-not-found')).toBeVisible();
    await expect(page.locator('#catalog-detail-ratings')).toHaveCount(0);
  });

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

test.describe('Catalog — authenticated', () => {
  test('lists games from the catalog', async ({ authedPage: page, store }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-search')).toBeVisible();
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(game.game_id));
  });

  test('filtering by genre narrows the results', async ({ authedPage: page, store }) => {
    await store.reset();
    const chosenGenre = newText();
    const chosenGame = { ...newCatalogGame(), genre: chosenGenre };
    const seededGames = [newCatalogGame(), chosenGame];
    await store.seedCatalogGames(seededGames);

    await page.goto(AppUrls.catalog);
    await expect(page.locator(CATALOG_TILES)).toHaveCount(seededGames.length);
    await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);
    await page.locator('#genre').selectOption(chosenGenre);
    await expect(page.locator('#genre')).toHaveValue(chosenGenre);
    const markersAtTheApply = await dehydratedMarkersLeft(page);
    await page.locator('#catalog-apply').click();
    await expect(
      page,
      `applying the filters must reach the address bar before anything loads (${markersAtTheApply} dehydrated markers were in the DOM when Apply was clicked)`,
    ).toHaveURL(new RegExp(`${CatalogQueryParams.genre}=${chosenGenre}`));

    await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(chosenGame.game_id));
  });

  test('a raw genre token filters on the whole token and fits the narrowest card the grid can produce', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const rawGenreToken = PsnGenreTokens.rolePlayingGames;
    const rawGenreGameId = newId();
    await store.seedCatalogGames([
      { ...newCatalogGame(), game_id: rawGenreGameId, canonical_title: `a${newId()}`, genre: rawGenreToken },
      { ...newCatalogGame(), canonical_title: `b${newId()}`, genre: PsnGenreTokens.musicRhythm },
    ]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-genre-0')).toHaveAttribute('data-genre', rawGenreToken);

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

    await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);
    await page.locator('#genre').selectOption(rawGenreToken);
    await expect(page.locator('#genre')).toHaveValue(rawGenreToken);
    const markersAtTheApply = await dehydratedMarkersLeft(page);
    await page.locator('#catalog-apply').click();
    await expect(
      page,
      `applying the filters must reach the address bar before anything loads (${markersAtTheApply} dehydrated markers were in the DOM when Apply was clicked)`,
    ).toHaveURL(new RegExp(`genre=${rawGenreToken}`));

    await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(rawGenreGameId));
  });

  test('browses games by default and lists a media app only when asked for that kind', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const gameId = newId();
    const mediaAppId = newId();
    await store.seedCatalogGames([
      { ...newCatalogGame(), game_id: gameId },
      {
        ...newCatalogGame(),
        game_id: mediaAppId,
        genre: null,
        aaa_tier: null,
        content_kind: ContentKinds.mediaApp,
      },
    ]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(gameId));
    await expect(page.locator(CATALOG_TILES)).toHaveCount(1);

    const markersAtTheChange = await dehydratedMarkersLeft(page);
    await page.locator('#catalog-kind').selectOption(ContentKinds.mediaApp);
    await expect(
      page,
      `the kind control must reach the address bar before anything loads (${markersAtTheChange} dehydrated markers were in the DOM when the kind was chosen)`,
    ).toHaveURL(/kind=media_app/);

    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(mediaAppId));
    await expect(page.locator('#catalog-kind-0')).toBeVisible();
    await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
  });

  test('sorting by price orders the page by what the storefront charges', async ({ authedPage: page, store }) => {
    await store.reset();
    const dearGameId = newId();
    const cheapGameId = newId();
    await store.seedCatalogGames([
      {
        ...newCatalogGame(),
        game_id: dearGameId,
        canonical_title: `b${newId()}`,
        price: newCatalogPrice(newCountCeiling()),
      },
      {
        ...newCatalogGame(),
        game_id: cheapGameId,
        canonical_title: `a${newId()}`,
        price: newCatalogPrice(newCount()),
      },
    ]);

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(cheapGameId));
    await expect(page.locator('#catalog-price-0')).toBeVisible();

    const priceSortedAnswer = page.waitForResponse(
      (response) =>
        response.url().includes(CuratorApi.catalogGames) &&
        response.url().includes(`${CuratorQueryParams.sort}=${CatalogSortFields.price}`),
    );
    const markersAtTheChange = await dehydratedMarkersLeft(page);
    await page.locator('#catalog-sort').selectOption(catalogSortValue(CatalogSortFields.price, SortDirections.desc));

    await expect(
      page,
      `the sort control must reach the address bar before anything loads (${markersAtTheChange} dehydrated markers were in the DOM when the sort was chosen)`,
    ).toHaveURL(/sort=price/);
    await expect(page).toHaveURL(/sortDir=desc/);
    const answered = (await (await priceSortedAnswer).json()) as CatalogGamesBody;
    expect(answered.games.map((game) => game.game_id), 'Curator answered the price-sorted request').toEqual([
      dearGameId,
      cheapGameId,
    ]);

    await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(dearGameId));
    await expect(page.locator('#catalog-price-0')).toBeVisible();
  });

  test('the detail page states the price and the public collections holding the game', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const gameId = newId();
    const publicDefinitionId = newId();
    const freeWithSubscription = {
      is_free: true,
      tied_to_subscription: true,
      base_cents: null,
      discounted_cents: null,
      discount_text: null,
      fetched_at: newUtcInstant(),
    };
    await store.seedCatalogGames([
      {
        ...newCatalogGame(),
        game_id: gameId,
        price: freeWithSubscription,
      },
    ]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [
      { definition_id: publicDefinitionId, name: newId(), kind: CollectionKinds.filterList, visibility: CollectionVisibilities.public, game_ids: [gameId] },
      { definition_id: newId(), name: newId(), kind: CollectionKinds.filterList, visibility: CollectionVisibilities.private, game_ids: [gameId] },
    ]);

    await page.goto(catalogGameUrl(gameId));

    const price = page.locator('#catalog-detail-price');
    await expect(price).toHaveAttribute('data-is-free', String(freeWithSubscription.is_free));
    await expect(price).toHaveAttribute('data-tied-to-subscription', String(freeWithSubscription.tied_to_subscription));
    await expect(page.locator('#catalog-detail-collections')).toBeVisible();
    await expect(page.locator('[id^="catalog-detail-collection-"]')).toHaveCount(1);
    await expect(page.locator('#catalog-detail-collection-0')).toHaveAttribute('data-definition-id', publicDefinitionId);
  });

  test('the detail page renders no collections section for a game no public collection holds', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);

    await page.goto(catalogGameUrl(game.game_id));

    await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
    await expect(page.locator('#catalog-detail-collections')).toHaveCount(0);
    await expect(page.locator('#catalog-detail-price')).toHaveCount(0);
  });

  test('pager enables Next on a full page and Previous after advancing', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(gamesSpanningTwoPages());

    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-prev')).toBeDisabled();
    await expect(page.locator('#catalog-next')).toBeEnabled();

    await page.locator('#catalog-next').click();
    await expect(page.locator('#catalog-prev')).toBeEnabled();
  });

  test('the per-page choice resizes the page and outlives a reload', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(gamesFillingEitherPageSize());

    await page.goto(AppUrls.catalog);
    await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_PAGE_SIZE);

    const markersAtTheChange = await dehydratedMarkersLeft(page);
    await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));
    await expect(
      page,
      `the page-size control must reach the address bar before anything loads (${markersAtTheChange} dehydrated markers were in the DOM when the size was chosen)`,
    ).toHaveURL(new RegExp(`${CatalogQueryParams.pageSize}=${CATALOG_CHOSEN_PAGE_SIZE}`));
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
    await store.seedCatalogGames(gamesFillingEitherPageSize());

    await page.goto(AppUrls.catalog);
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
