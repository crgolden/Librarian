import { expect } from '@playwright/test';
import { newCount, newId, newText, newUtcInstant } from '@crgolden/modules/testing';
import { DEFAULT_E2E_SUB, newCatalogGame } from '../fixtures.js';
import { AppUrls, catalogGameUrl } from '../../src/app/app-paths';
import { ConsolePlatforms, PsPlusTiers } from '../../src/curator/curator.models';
import { storeProductUrl } from '../../src/catalog/store-links';
import { BffPaths } from '../../src/shared/bff-contract';
import { Given, Then, When } from './fixtures.js';

const NO_ELEMENTS = 0;
const [PREVIOUS_WALK_AT, WALKED_AT] = [newUtcInstant(), newUtcInstant()].sort();
const CATALOGUED_GAME = newCatalogGame();
const EXTRA_CATEGORY_TOTAL = newCount();

const UNCLAIMED_STORE_TITLE = {
  title_id: newId(),
  game_id: null,
  title: newText(),
  tier: PsPlusTiers.extra,
  platforms: [ConsolePlatforms.ps5],
  cover_image_url: null,
  store_product_id: newId(),
  since_at: null,
};

const CATALOGUED_TITLE = {
  title_id: newId(),
  game_id: CATALOGUED_GAME.game_id,
  title: CATALOGUED_GAME.canonical_title,
  tier: PsPlusTiers.premium,
  platforms: [ConsolePlatforms.ps4],
  cover_image_url: null,
  store_product_id: null,
  since_at: null,
};

const UNCLAIMED = [UNCLAIMED_STORE_TITLE];
const LEAVING = [CATALOGUED_TITLE];

Given('the rotation has an unclaimed title in the Store and a leaving title in the catalog', async ({ store }) => {
  await store.seedCatalogGames([CATALOGUED_GAME]);
  await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
    catalog_walked_at: WALKED_AT,
    since: PREVIOUS_WALK_AT,
    unclaimed: UNCLAIMED,
    leaving: LEAVING,
    categories: [
      { tier: PsPlusTiers.extra, walked_at: WALKED_AT, total: EXTRA_CATEGORY_TOTAL },
      { tier: PsPlusTiers.premium, walked_at: WALKED_AT, total: newCount() },
    ],
  });
});

Given('the rotation has an unclaimed title in the catalog', async ({ store, ctx }) => {
  await store.seedCatalogGames([CATALOGUED_GAME]);
  await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
    catalog_walked_at: WALKED_AT,
    unclaimed: [CATALOGUED_TITLE],
  });
  ctx.catalogGameId = CATALOGUED_GAME.game_id;
});

Given('my refresh schedule watches the rotation', async ({ store }) => {
  await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { ps_plus_watch: true });
});

Given('my refresh schedule does not watch the rotation', async ({ store }) => {
  await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { ps_plus_watch: false });
});

When('I open the PlayStation Plus rotation', async ({ page }) => {
  await page.goto(AppUrls.psPlus);
});

When('I open that title from the rotation', async ({ page }) => {
  await page.goto(AppUrls.psPlus);
  await page.locator('#ps-plus-unclaimed-title-0').click();
});

When('I follow the rotation summary from my library', async ({ page }) => {
  await page.goto(AppUrls.library);
  await page.locator('#library-ps-plus-link').click();
});

Then('I am sent to sign in', async ({ page }) => {
  await page.waitForURL(`**${BffPaths.login}**`);
});

Then('I am asked to link a PlayStation account', async ({ page }) => {
  await expect(page.locator('#ps-plus-not-linked')).toBeVisible();
});

Then('I am shown no error', async ({ page }) => {
  await expect(page.locator('#ps-plus-error')).toHaveCount(NO_ELEMENTS);
});

Then('I see when the Game Catalog was last walked and its size per tier', async ({ page }) => {
  await expect(page.locator('#ps-plus-walked-at')).toHaveAttribute('data-walked-at', WALKED_AT);
  await expect(page.locator('#ps-plus-category-extra')).toHaveAttribute('data-total', String(EXTRA_CATEGORY_TOTAL));
});

Then('the unclaimed title links to the Store', async ({ page }) => {
  await expect(page.locator('#ps-plus-unclaimed-title-0')).toHaveAttribute(
    'href',
    String(storeProductUrl(UNCLAIMED_STORE_TITLE.store_product_id)),
  );
});

Then('the leaving title links to its catalog page', async ({ page }) => {
  await expect(page.locator('#ps-plus-leaving-title-0')).toHaveAttribute('href', catalogGameUrl(CATALOGUED_GAME.game_id));
});

Then('I am told nothing was added', async ({ page }) => {
  await expect(page.locator('#ps-plus-added-empty')).toBeVisible();
});

Then('I am told the Game Catalog has not been walked yet', async ({ page }) => {
  await expect(page.locator('#ps-plus-not-walked')).toBeVisible();
  await expect(page.locator('#ps-plus-walked-at')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#ps-plus-unclaimed-empty')).toBeVisible();
});

Then('I see how many titles are unclaimed and how many are leaving', async ({ page }) => {
  const summary = page.locator('#library-ps-plus-summary');
  await expect(summary).toHaveAttribute('data-unclaimed', String(UNCLAIMED.length));
  await expect(summary).toHaveAttribute('data-leaving', String(LEAVING.length));
});

Then('the summary links to the rotation', async ({ page }) => {
  await expect(page.locator('#library-ps-plus-link')).toHaveAttribute('href', AppUrls.psPlus);
});

Then("I see the rotation's unclaimed list", async ({ page }) => {
  await page.waitForURL(`**${AppUrls.psPlus}`);
  await expect(page.locator('#ps-plus-unclaimed')).toBeVisible();
});

Then('I see no rotation summary', async ({ page }) => {
  await expect(
    page.locator('#library-ps-plus-summary'),
    'the toggle is the consent to spend a walk on this user, so reporting a rotation they never asked for would make the toggle decorative',
  ).toHaveCount(NO_ELEMENTS);
});
