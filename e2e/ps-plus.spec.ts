import { test, expect, DEFAULT_E2E_SUB } from './fixtures.js';

const WALKED_AT = '2031-06-15T04:00:00+00:00';
const WALKED_AT_RENDERED = 'Jun 15, 2031';
const PREVIOUS_WALK_AT = '2031-06-08T04:00:00+00:00';

const UNCLAIMED_TITLE = {
  title_id: 'CUSA00001_00',
  game_id: null,
  title: 'Catalog Only Title',
  tier: 'extra' as const,
  platforms: ['PS5'],
  cover_image_url: null,
  store_product_id: 'UP9000-CUSA00001_00-STOREONLY0000000',
  since_at: null,
};

const LEAVING_TITLE = {
  title_id: 'CUSA00002_00',
  game_id: 'g-bloodborne',
  title: 'Bloodborne',
  tier: 'premium' as const,
  platforms: ['PS4'],
  cover_image_url: null,
  store_product_id: null,
  since_at: null,
};

test.describe('PlayStation Plus rotation — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/library/ps-plus');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('PlayStation Plus rotation', () => {
  test('asks for a linked account rather than reporting an error', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library/ps-plus');

    await expect(page.locator('#page-title')).toContainText('PlayStation Plus');
    await expect(page.locator('#ps-plus-not-linked')).toContainText('linked PlayStation Network account');
    await expect(page.locator('#ps-plus-error')).toHaveCount(0);
  });

  test('lists what is unclaimed and what is leaving, linking each title where it can be reached', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedCatalogGames([
      { game_id: 'g-bloodborne', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      since: PREVIOUS_WALK_AT,
      unclaimed: [UNCLAIMED_TITLE],
      leaving: [LEAVING_TITLE],
      categories: [
        { tier: 'extra', walked_at: WALKED_AT, total: 420 },
        { tier: 'premium', walked_at: WALKED_AT, total: 130 },
      ],
    });

    await page.goto('/library/ps-plus');

    await expect(page.locator('#ps-plus-walked-at')).toContainText(WALKED_AT_RENDERED);
    await expect(page.locator('#ps-plus-category-extra')).toContainText('420');

    await expect(page.locator('#ps-plus-unclaimed-title-0')).toHaveAttribute(
      'href',
      /store\.playstation\.com\/product\/UP9000-CUSA00001_00-STOREONLY0000000/,
    );
    await expect(page.locator('#ps-plus-leaving-title-0')).toHaveAttribute('href', '/catalog/g-bloodborne');
    await expect(page.locator('#ps-plus-added-empty')).toBeVisible();
  });

  test('says the catalog has not been walked yet rather than showing four empty lists as news', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/library/ps-plus');

    await expect(page.locator('#ps-plus-not-walked')).toBeVisible();
    await expect(page.locator('#ps-plus-walked-at')).toHaveCount(0);
    await expect(page.locator('#ps-plus-unclaimed-empty')).toBeVisible();
  });

  test('a catalogued title opens its catalog page', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedCatalogGames([
      { game_id: 'g-bloodborne', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      unclaimed: [LEAVING_TITLE],
    });

    await page.goto('/library/ps-plus');
    await page.locator('#ps-plus-unclaimed-title-0').click();

    await page.waitForURL('**/catalog/g-bloodborne', { timeout: 10_000 });
    await expect(page.locator('#page-title')).toContainText('Bloodborne');
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
    await store.seedUserPsPlusRotation(DEFAULT_E2E_SUB, {
      catalog_walked_at: WALKED_AT,
      unclaimed: [UNCLAIMED_TITLE],
      leaving: [LEAVING_TITLE],
    });

    await page.goto('/library');

    await expect(page.locator('#library-ps-plus-summary')).toContainText('1 unclaimed');
    await expect(page.locator('#library-ps-plus-link')).toHaveAttribute('href', '/library/ps-plus');

    await page.locator('#library-ps-plus-link').click();
    await page.waitForURL('**/library/ps-plus', { timeout: 10_000 });
    await expect(page.locator('#page-title')).toContainText('PlayStation Plus');
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

    await page.goto('/library');

    await expect(
      page.locator('#library-ps-plus-summary'),
      'the toggle is the consent to spend a walk on this user, so reporting a rotation they never asked '
        + 'for would make the toggle decorative',
    ).toHaveCount(0);
  });
});
