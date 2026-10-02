import { expect, type Page } from '@playwright/test';
import { ScrollRestorationModes } from '@crgolden/modules/scroll-restoration';
import {
  newCount,
  newCountCeiling,
  newId,
  newMemberOtherThan,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { DEFAULT_E2E_SUB, newCatalogGame, newScore } from '../fixtures.js';
import { dehydratedMarkersLeft, holdAppBootstrap } from '../hydration.js';
import { PsnGenreTokens } from '../psn-constants';
import { RawgConstants } from '../rawg-constants';
import e2eSettings from '../e2e-settings.json';
import { CURATOR_API_PREFIX, CuratorApi, CuratorQueryParams } from '../../src/curator/curator-api';
import { BffPaths } from '../../src/shared/bff-contract';
import { AppUrls, catalogGameUrl } from '../../src/app/app-paths';
import {
  CatalogSortFields,
  CollectionKinds,
  CollectionVisibilities,
  ContentKinds,
  SortDirections,
} from '../../src/curator/curator.models';
import { catalogSortValue } from '../../src/catalog/catalog-sort';
import { CATALOG_PAGE_SIZE, CATALOG_PAGE_SIZE_CEILING, CatalogQueryParams } from '../../src/catalog/catalog.query';
import { CATALOG_TITLE_ID_PREFIX, catalogTitleId } from '../../src/catalog/catalog-ids';
import { pageSizeChoicesUpTo } from '../../src/shared/page-size/page-size.preference';
import { Given, Then, When } from './fixtures.js';

const CATALOG_TILES = `[id^="${CATALOG_TITLE_ID_PREFIX}"]`;
const NO_ELEMENTS = 0;

const CATALOG_CHOSEN_PAGE_SIZE = newMemberOtherThan(
  pageSizeChoicesUpTo(CATALOG_PAGE_SIZE_CEILING, CATALOG_PAGE_SIZE),
  CATALOG_PAGE_SIZE,
);

const FREE_WITH_SUBSCRIPTION = {
  is_free: true,
  tied_to_subscription: true,
  base_cents: null,
  discounted_cents: null,
  discount_text: null,
  fetched_at: newUtcInstant(),
};

type CatalogGamesBody = { games: { game_id: string }[] };

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

const SHORT_VIEWPORT = e2eSettings.viewports.shortCatalog;
const SCROLL_DISTANCE_PX = e2eSettings.scrollRestoration.scrollDistancePx;
const WITHIN_FIVE_PIXELS = -1;
const ROUTER_OWNED_SCROLL_RESTORATION = ScrollRestorationModes.manual;

function recordCuratorRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith(CURATOR_API_PREFIX)) {
      requested.push(pathname);
    }
  });
  return requested;
}

async function openTheCatalogUntilInteractive(page: Page): Promise<void> {
  await page.goto(AppUrls.catalog, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);
}

async function theFirstFullyVisibleCatalogTitle(page: Page): Promise<{ id: string; href: string }> {
  return page.evaluate((idPrefix) => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`[id^="${idPrefix}"]`)].find((anchor) => {
      const box = anchor.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    if (link === undefined) {
      throw new Error('no catalog title is fully inside the viewport, so nothing can be clicked without moving it');
    }
    return { id: link.id, href: link.href };
  }, CATALOG_TITLE_ID_PREFIX);
}

async function clickInPage(page: Page, id: string): Promise<number> {
  return page.evaluate((linkId) => {
    const link = document.getElementById(linkId);
    if (link === null) {
      throw new Error(`#${linkId} left the page between being found and being clicked`);
    }
    link.click();
    return Math.round(window.scrollY);
  }, id);
}

async function expectTheGamePageAt(page: Page, href: string): Promise<void> {
  await expect(page).toHaveURL(href);
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
}

Given('the catalog holds a game', async ({ store, ctx }) => {
  const game = newCatalogGame();
  await store.seedCatalogGames([game]);
  ctx.catalogGameId = game.game_id;
});

Given('the catalog holds a game with a RAWG and an OpenCritic score but no PlayStation rating', async ({ store, ctx }) => {
  ctx.rawgScore = newScore();
  ctx.openCriticScore = newScore();
  await store.seedCatalogGames([
    { ...newCatalogGame(), critical_score: ctx.rawgScore, oc_score: ctx.openCriticScore, psn_rating: null },
  ]);
});

Given('the catalog holds a game with a RAWG score', async ({ store, ctx }) => {
  const game = { ...newCatalogGame(), critical_score: newScore(), oc_score: null, psn_rating: null };
  await store.seedCatalogGames([game]);
  ctx.catalogGameId = game.game_id;
});

Given('the catalog holds a game with only an OpenCritic score', async ({ store, ctx }) => {
  ctx.openCriticScore = newScore();
  const game = { ...newCatalogGame(), critical_score: null, oc_score: ctx.openCriticScore, psn_rating: null };
  await store.seedCatalogGames([game]);
  ctx.catalogGameId = game.game_id;
});

Given('the catalog holds a game in a genre I choose and one outside it', async ({ store, ctx }) => {
  const chosenGame = { ...newCatalogGame(), genre: newText() };
  const games = [newCatalogGame(), chosenGame];
  await store.seedCatalogGames(games);
  ctx.seededCatalogCount = games.length;
  ctx.chosenGenre = chosenGame.genre;
  ctx.catalogGameId = chosenGame.game_id;
});

Given('the catalog holds a game I can name by title and genre, and one that matches neither', async ({ store, ctx }) => {
  const chosenGame = { ...newCatalogGame(), genre: newText() };
  const games = [newCatalogGame(), chosenGame];
  await store.seedCatalogGames(games);
  ctx.seededCatalogCount = games.length;
  ctx.chosenGenre = chosenGame.genre;
  ctx.searchTerm = chosenGame.canonical_title;
  ctx.catalogGameId = chosenGame.game_id;
});

Given('the catalog holds a game whose genre is a raw PlayStation token and one outside it', async ({ store, ctx }) => {
  const rawGenreGame = { ...newCatalogGame(), canonical_title: `a${newId()}`, genre: PsnGenreTokens.rolePlayingGames };
  const games = [rawGenreGame, { ...newCatalogGame(), canonical_title: `b${newId()}`, genre: PsnGenreTokens.musicRhythm }];
  await store.seedCatalogGames(games);
  ctx.seededCatalogCount = games.length;
  ctx.chosenGenre = rawGenreGame.genre;
  ctx.catalogGameId = rawGenreGame.game_id;
});

Given('the catalog holds a game and a media app', async ({ store, ctx }) => {
  const game = newCatalogGame();
  const mediaApp = { ...newCatalogGame(), genre: null, aaa_tier: null, content_kind: ContentKinds.mediaApp };
  await store.seedCatalogGames([game, mediaApp]);
  ctx.catalogGameId = game.game_id;
  ctx.otherGameId = mediaApp.game_id;
});

Given('the catalog holds a cheap game and a dear one', async ({ store, ctx }) => {
  const dearGame = { ...newCatalogGame(), canonical_title: `b${newId()}`, price: newCatalogPrice(newCountCeiling()) };
  const cheapGame = { ...newCatalogGame(), canonical_title: `a${newId()}`, price: newCatalogPrice(newCount()) };
  await store.seedCatalogGames([dearGame, cheapGame]);
  ctx.catalogGameId = cheapGame.game_id;
  ctx.otherGameId = dearGame.game_id;
});

Given(
  'the catalog holds a game free with a subscription, in one public and one private collection',
  async ({ store, ctx }) => {
    const game = { ...newCatalogGame(), price: FREE_WITH_SUBSCRIPTION };
    const publicDefinitionId = newId();
    await store.seedCatalogGames([game]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [
      { definition_id: publicDefinitionId, name: newId(), kind: CollectionKinds.filterList, visibility: CollectionVisibilities.public, game_ids: [game.game_id] },
      { definition_id: newId(), name: newId(), kind: CollectionKinds.filterList, visibility: CollectionVisibilities.private, game_ids: [game.game_id] },
    ]);
    ctx.catalogGameId = game.game_id;
    ctx.publicDefinitionId = publicDefinitionId;
  },
);

Given('the catalog holds more games than fit on one page', async ({ store }) => {
  await store.seedCatalogGames(
    Array.from({ length: CATALOG_PAGE_SIZE + randomIntBetween(1, CATALOG_PAGE_SIZE) }, newCatalogGame),
  );
});

Given('the catalog holds enough games to fill either page size', async ({ store }) => {
  await store.seedCatalogGames(Array.from({ length: CATALOG_PAGE_SIZE + CATALOG_CHOSEN_PAGE_SIZE }, newCatalogGame));
});

Given('I have moved to the next page of the catalog', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await page.locator('#catalog-next').click();
  await expect(page.locator('#catalog-prev')).toBeEnabled();
});

Given('the catalog holds a full page of games', async ({ store }) => {
  await store.seedCatalogGames(Array.from({ length: CATALOG_PAGE_SIZE }, newCatalogGame));
});

Given('I have opened the catalog and the page has become interactive', async ({ page, ctx }) => {
  await openTheCatalogUntilInteractive(page);
  ctx.curatorRequests = recordCuratorRequests(page);
});

Given('I have scrolled down the catalog on a short screen', async ({ page, ctx }) => {
  await page.setViewportSize(SHORT_VIEWPORT);
  await page.goto(AppUrls.catalog);
  await expect(page.locator('#catalog-title-0')).toBeVisible();
  await page.waitForFunction(
    (routerOwned) => window.history.scrollRestoration === routerOwned,
    ROUTER_OWNED_SCROLL_RESTORATION,
  );
  const readerPosition = await page.evaluate((distance) => {
    window.scrollBy(0, distance);
    return Math.round(window.scrollY);
  }, SCROLL_DISTANCE_PX);
  expect(
    readerPosition,
    'the catalog did not overflow the shortened viewport, so a restored position is indistinguishable from a reset one',
  ).toBeGreaterThan(0);
  ctx.readerPosition = readerPosition;
});

When('I open the catalog and the page becomes interactive', async ({ page, ctx }) => {
  ctx.curatorRequests = recordCuratorRequests(page);
  await openTheCatalogUntilInteractive(page);
});

When('I open that game from the catalog', async ({ page, ctx }) => {
  await page.locator(`#${catalogTitleId(0)}`).click();
  await expect(page).toHaveURL(new RegExp(`${catalogGameUrl(ctx.catalogGameId)}$`));
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
});

When('I open a game from the catalog and go back', async ({ page, ctx }) => {
  const leaving = await theFirstFullyVisibleCatalogTitle(page);
  ctx.markersAtTheLeave = await dehydratedMarkersLeft(page);
  const positionAtTheClick = await clickInPage(page, leaving.id);
  expect(positionAtTheClick, 'the in-page click must not move the viewport, or the scenario measures the driver').toBe(
    ctx.readerPosition,
  );
  await expectTheGamePageAt(page, leaving.href);
  await page.goBack();
});

When('I open a game from the catalog as a new page and go back', async ({ page, ctx }) => {
  const leaving = await theFirstFullyVisibleCatalogTitle(page);
  ctx.markersAtTheLeave = await dehydratedMarkersLeft(page);
  await page.goto(leaving.href);
  await expectTheGamePageAt(page, leaving.href);
  await page.goBack();
});

When('I open the catalog', async ({ page }) => {
  await page.goto(AppUrls.catalog);
});

When('I open that game from the catalog list', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await page.locator('#catalog-title-0').click();
});

When('I open a game that is not in the catalog', async ({ page }) => {
  await page.goto(catalogGameUrl(newId()));
});

When("I open that game's page", async ({ page, ctx }) => {
  await page.goto(catalogGameUrl(ctx.catalogGameId));
});

When('I filter the catalog by that genre', async ({ page, ctx }) => {
  const chosenGenre = ctx.chosenGenre;
  await page.goto(AppUrls.catalog);
  await expect(page.locator(CATALOG_TILES)).toHaveCount(ctx.seededCatalogCount);
  await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);
  await page.locator('#genre').selectOption(chosenGenre);
  await expect(page.locator('#genre')).toHaveValue(chosenGenre);
  const markersAtTheApply = await dehydratedMarkersLeft(page);
  await page.locator('#catalog-apply').click();
  await expect(
    page,
    `applying the filters must reach the address bar before anything loads (${markersAtTheApply} dehydrated markers were in the DOM when Apply was clicked)`,
  ).toHaveURL(new RegExp(`${CatalogQueryParams.genre}=${chosenGenre}`));
});

When('I ask for media apps', async ({ page }) => {
  const markersAtTheChange = await dehydratedMarkersLeft(page);
  await page.locator('#catalog-kind').selectOption(ContentKinds.mediaApp);
  await expect(
    page,
    `the kind control must reach the address bar before anything loads (${markersAtTheChange} dehydrated markers were in the DOM when the kind was chosen)`,
  ).toHaveURL(new RegExp(`${CatalogQueryParams.kind}=${ContentKinds.mediaApp}`));
});

When('I sort the catalog by price, dearest first', async ({ page, ctx }) => {
  await page.goto(AppUrls.catalog);
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.catalogGameId));
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
  ).toHaveURL(new RegExp(`${CatalogQueryParams.sort}=${CatalogSortFields.price}`));
  await expect(page).toHaveURL(new RegExp(`${CatalogQueryParams.sortDir}=${SortDirections.desc}`));
  const answered = (await (await priceSortedAnswer).json()) as CatalogGamesBody;
  ctx.answeredGameIds = answered.games.map((game) => game.game_id);
});

When('I go to the next page', async ({ page }) => {
  await page.locator('#catalog-next').click();
});

When('I open the catalog and choose another page size', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_PAGE_SIZE);
  const markersAtTheChange = await dehydratedMarkersLeft(page);
  await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));
  await expect(
    page,
    `the page-size control must reach the address bar before anything loads (${markersAtTheChange} dehydrated markers were in the DOM when the size was chosen)`,
  ).toHaveURL(new RegExp(`${CatalogQueryParams.pageSize}=${CATALOG_CHOSEN_PAGE_SIZE}`));
});

When('I choose another page size', async ({ page }) => {
  await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));
});

When('I reload the catalog', async ({ page }) => {
  await page.reload();
});

Given('I am browsing the catalog, which lists only the game', async ({ page, ctx }) => {
  await page.goto(AppUrls.catalog);
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.catalogGameId));
});

Given("the catalog has rendered but the app's scripts have not loaded yet", async ({ page, ctx }) => {
  ctx.releaseAppBootstrap = await holdAppBootstrap(page);
  await page.goto(AppUrls.catalog, { waitUntil: 'commit' });
  await expect(page.locator(CATALOG_TILES).first()).toBeVisible();
});

When('I enter its title and genre before the page is interactive, then apply them once it is', async ({ page, ctx }) => {
  expect(await dehydratedMarkersLeft(page), 'the page must still be server-rendered when the filters are entered').toBeGreaterThan(NO_ELEMENTS);
  await page.locator('#catalog-search').fill(ctx.searchTerm);
  await page.locator('#genre').selectOption(ctx.chosenGenre);
  ctx.releaseAppBootstrap();
  await expect.poll(() => dehydratedMarkersLeft(page)).toBe(NO_ELEMENTS);
  await expect(page.locator('#catalog-search')).toHaveValue(ctx.searchTerm);
  await expect(page.locator('#genre')).toHaveValue(ctx.chosenGenre);
  await page.locator('#catalog-apply').click();
  await expect(page).toHaveURL(new RegExp(`${CatalogQueryParams.genre}=${ctx.chosenGenre}`));
});

When('I ask for media apps before the page is interactive', async ({ page, ctx }) => {
  expect(await dehydratedMarkersLeft(page), 'the page must still be server-rendered when the kind is chosen').toBeGreaterThan(NO_ELEMENTS);
  await page.locator('#catalog-kind').selectOption(ContentKinds.mediaApp);
  ctx.releaseAppBootstrap();
  await expect(page).toHaveURL(new RegExp(`${CatalogQueryParams.kind}=${ContentKinds.mediaApp}`));
});

When('I sort the catalog by price, dearest first, before the page is interactive', async ({ page, ctx }) => {
  expect(await dehydratedMarkersLeft(page), 'the page must still be server-rendered when the sort is chosen').toBeGreaterThan(NO_ELEMENTS);
  await page.locator('#catalog-sort').selectOption(catalogSortValue(CatalogSortFields.price, SortDirections.desc));
  ctx.releaseAppBootstrap();
  await expect(page).toHaveURL(new RegExp(`${CatalogQueryParams.sort}=${CatalogSortFields.price}`));
});

Given('I am on the first catalog page', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await expect(page.locator('#catalog-prev')).toBeDisabled();
  await expect(page.locator('#catalog-next')).toBeEnabled();
});

Given('I have chosen another catalog page size', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_PAGE_SIZE);
  await page.locator('#catalog-page-size').selectOption(String(CATALOG_CHOSEN_PAGE_SIZE));
  await expect(page).toHaveURL(new RegExp(`${CatalogQueryParams.pageSize}=${CATALOG_CHOSEN_PAGE_SIZE}`));
  await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
});

Then('I see that game in the catalog', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-search')).toBeVisible();
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.catalogGameId));
});

Then('I am not sent to sign in', ({ page }) => {
  expect(page.url()).not.toContain(BffPaths.login);
});

Then('I see its RAWG and OpenCritic scores', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-rawg-score-0')).toHaveAttribute('data-score', String(ctx.rawgScore));
  await expect(page.locator('#catalog-opencritic-score-0')).toHaveAttribute('data-score', String(ctx.openCriticScore));
});

Then('its PlayStation rating reads as a dash', async ({ page }) => {
  await expect(page.locator('#catalog-psn-rating-0')).toBeVisible();
  await expect(page.locator('#catalog-psn-rating-0')).not.toHaveAttribute('data-score');
});

Then("the page links to RAWG, as RAWG's terms require", async ({ page }) => {
  await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RawgConstants.home);
});

Then('I see its OpenCritic score', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-opencritic-score-0')).toHaveAttribute('data-score', String(ctx.openCriticScore));
});

Then("I see that game's ratings", async ({ page }) => {
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
});

Then('the page claims no RAWG data', async ({ page }) => {
  await expect(page.locator('#rawg-attribution')).toHaveCount(NO_ELEMENTS);
});

Then("I see that game's page", async ({ page, ctx }) => {
  await page.waitForURL(`**${catalogGameUrl(ctx.catalogGameId)}`);
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
});

Then('I am told the game was not found', async ({ page }) => {
  await expect(page.locator('#catalog-detail-not-found')).toBeVisible();
  await expect(page.locator('#catalog-detail-ratings')).toHaveCount(NO_ELEMENTS);
});

Then('only the game in that genre is listed', async ({ page, ctx }) => {
  await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.catalogGameId));
});

Then('only the game is listed', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.catalogGameId));
  await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
});

Then('only the media app is listed, labelled as not a game', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.otherGameId));
  await expect(page.locator('#catalog-kind-0')).toBeVisible();
  await expect(page.locator(CATALOG_TILES)).toHaveCount(1);
});

Then('the dear game is listed first', async ({ page, ctx }) => {
  expect(ctx.answeredGameIds, 'Curator answered the price-sorted request').toEqual([ctx.otherGameId, ctx.catalogGameId]);
  await expect(page.locator('#catalog-title-0')).toHaveAttribute('href', catalogGameUrl(ctx.otherGameId));
  await expect(page.locator('#catalog-price-0')).toBeVisible();
});

Then('I see it is free with a subscription', async ({ page }) => {
  const price = page.locator('#catalog-detail-price');
  await expect(price).toHaveAttribute('data-is-free', String(FREE_WITH_SUBSCRIPTION.is_free));
  await expect(price).toHaveAttribute('data-tied-to-subscription', String(FREE_WITH_SUBSCRIPTION.tied_to_subscription));
});

Then('I see only the public collection holding it', async ({ page, ctx }) => {
  await expect(page.locator('#catalog-detail-collections')).toBeVisible();
  await expect(page.locator('[id^="catalog-detail-collection-"]')).toHaveCount(1);
  await expect(page.locator('#catalog-detail-collection-0')).toHaveAttribute('data-definition-id', ctx.publicDefinitionId);
});

Then('I see no collections section and no price', async ({ page }) => {
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
  await expect(page.locator('#catalog-detail-collections')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#catalog-detail-price')).toHaveCount(NO_ELEMENTS);
});

Then('I can go to the next page but not the previous one', async ({ page }) => {
  await expect(page.locator('#catalog-prev')).toBeDisabled();
  await expect(page.locator('#catalog-next')).toBeEnabled();
});

Then('I can go back to the previous page', async ({ page }) => {
  await expect(page.locator('#catalog-prev')).toBeEnabled();
});

Then('the page shows that many games', async ({ page }) => {
  await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
});

Then('the page still shows that many games', async ({ page }) => {
  await expect(
    page.locator(CATALOG_TILES),
    'the catalog stores its choice under its own key, so a reload that falls back to the default means the catalog is reading the library preference or none at all',
  ).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
  await expect(page.locator('#catalog-page-size')).toHaveValue(String(CATALOG_CHOSEN_PAGE_SIZE));
});

Then('I am back on the first page, showing that many games', async ({ page }) => {
  await expect(
    page.locator('#catalog-prev'),
    'keeping the old offset after a resize can land past the end of the result set, which renders an empty page the pager still reports as valid',
  ).toBeDisabled();
  await expect(page.locator(CATALOG_TILES)).toHaveCount(CATALOG_CHOSEN_PAGE_SIZE);
});

Then('the page is complete without asking the server for its data again', ({ ctx }) => {
  expect(ctx.curatorRequests).toEqual([]);
});

Then('the page has asked the server for that game', ({ ctx }) => {
  expect(ctx.curatorRequests).not.toEqual([]);
});

Then('I am where I was in the catalog', async ({ page, ctx }) => {
  const readerPosition = ctx.readerPosition;
  await expect(page.locator('#catalog-title-0')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.history.scrollRestoration), {
      message: `after Back the router, not the browser, must own restoration: history.scrollRestoration must become '${ROUTER_OWNED_SCROLL_RESTORATION}'`,
    })
    .toBe(ROUTER_OWNED_SCROLL_RESTORATION);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), {
      message: `Back did not land within five pixels of the reader's ${readerPosition}px (${ctx.markersAtTheLeave} dehydrated markers were in the DOM when the reader left)`,
    })
    .toBeCloseTo(readerPosition, WITHIN_FIVE_PIXELS);
});
