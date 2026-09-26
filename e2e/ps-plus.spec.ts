import { test, expect, DEFAULT_E2E_SUB, newCatalogGame } from './fixtures.js';
import { newCount, newId, newText, newUtcInstant } from '@crgolden/modules/testing';

import { AppUrls, catalogGameUrl } from '../src/app/app-paths';
import { ConsolePlatforms, PsPlusTiers } from '../src/curator/curator.models';
import { storeProductUrl } from '../src/catalog/store-links';
import { BffPaths } from '../src/shared/bff-contract';

const [PREVIOUS_WALK_AT, WALKED_AT] = [newUtcInstant(), newUtcInstant()].sort();

const CATALOGUED_GAME = newCatalogGame();

const UNCLAIMED_TITLE = {
  title_id: newId(),
  game_id: null,
  title: newText(),
  tier: PsPlusTiers.extra,
  platforms: [ConsolePlatforms.ps5],
  cover_image_url: null,
  store_product_id: newId(),
  since_at: null,
};

const LEAVING_TITLE = {
  title_id: newId(),
  game_id: CATALOGUED_GAME.game_id,
  title: CATALOGUED_GAME.canonical_title,
  tier: PsPlusTiers.premium,
  platforms: [ConsolePlatforms.ps4],
  cover_image_url: null,
  store_product_id: null,
  since_at: null,
};

test.describe('PlayStation Plus rotation — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.psPlus);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('PlayStation Plus rotation', () => {
  test('asks for a linked account rather than reporting an error', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.psPlus);

    await expect(page.locator('#ps-plus-not-linked')).toBeVisible();
    await expect(page.locator('#ps-plus-error')).toHaveCount(0);
  });

  test('lists what is unclaimed and what is leaving, linking each title where it can be reached', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedCatalogGames([CATALOGUED_GAME]);
    const extraCategoryTotal = newCount();
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      since: PREVIOUS_WALK_AT,
      unclaimed: [UNCLAIMED_TITLE],
      leaving: [LEAVING_TITLE],
      categories: [
        { tier: PsPlusTiers.extra, walked_at: WALKED_AT, total: extraCategoryTotal },
        { tier: PsPlusTiers.premium, walked_at: WALKED_AT, total: newCount() },
      ],
    });

    await page.goto(AppUrls.psPlus);

    await expect(page.locator('#ps-plus-walked-at')).toHaveAttribute('data-walked-at', WALKED_AT);
    await expect(page.locator('#ps-plus-category-extra')).toHaveAttribute('data-total', String(extraCategoryTotal));

    await expect(page.locator('#ps-plus-unclaimed-title-0')).toHaveAttribute(
      'href',
      String(storeProductUrl(UNCLAIMED_TITLE.store_product_id)),
    );
    await expect(page.locator('#ps-plus-leaving-title-0')).toHaveAttribute('href', catalogGameUrl(CATALOGUED_GAME.game_id));
    await expect(page.locator('#ps-plus-added-empty')).toBeVisible();
  });

  test('says the catalog has not been walked yet rather than showing four empty lists as news', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.psPlus);

    await expect(page.locator('#ps-plus-not-walked')).toBeVisible();
    await expect(page.locator('#ps-plus-walked-at')).toHaveCount(0);
    await expect(page.locator('#ps-plus-unclaimed-empty')).toBeVisible();
  });

  test('a catalogued title opens its catalog page', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedCatalogGames([CATALOGUED_GAME]);
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      unclaimed: [LEAVING_TITLE],
    });

    await page.goto(AppUrls.psPlus);
    await page.locator('#ps-plus-unclaimed-title-0').click();

    await page.waitForURL(`**${catalogGameUrl(CATALOGUED_GAME.game_id)}`);
    await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
  });
});

test.describe('PlayStation Plus rotation — the library summary', () => {
  test('the library reports the rotation only when the schedule watches it, and links to the page', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { ps_plus_watch: true });
    const unclaimed = [UNCLAIMED_TITLE];
    const leaving = [LEAVING_TITLE];
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      unclaimed,
      leaving,
    });

    await page.goto(AppUrls.library);

    const summary = page.locator('#library-ps-plus-summary');
    await expect(summary).toHaveAttribute('data-unclaimed', String(unclaimed.length));
    await expect(summary).toHaveAttribute('data-leaving', String(leaving.length));
    await expect(page.locator('#library-ps-plus-link')).toHaveAttribute('href', AppUrls.psPlus);

    await page.locator('#library-ps-plus-link').click();
    await page.waitForURL(`**${AppUrls.psPlus}`);
    await expect(page.locator('#ps-plus-unclaimed')).toBeVisible();
  });

  test('the library stays silent about the rotation when the schedule does not watch it', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { ps_plus_watch: false });
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      unclaimed: [UNCLAIMED_TITLE],
    });

    await page.goto(AppUrls.library);

    await expect(
      page.locator('#library-ps-plus-summary'),
      'the toggle is the consent to spend a walk on this user, so reporting a rotation they never asked '
        + 'for would make the toggle decorative',
    ).toHaveCount(0);
  });
});
