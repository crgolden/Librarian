/**
 * Social profile E2E — auth guard redirect, owner/viewer profile rendering, follow/unfollow,
 * followers/following pages, profile settings persistence, the /psn cross-reference copy and
 * region removal, and the bare-vs-:sub canonicalization redirect for /profile, /u/:sub,
 * /library, and /collections.
 *
 * Two distinct signed-in identities are needed for the viewer-mode cases (`authedPage`, sub
 * DEFAULT_E2E_SUB, and `secondAuthedPage`, sub SECOND_E2E_SUB) -- see fixtures.ts's module
 * docstring for how the mock Curator server tells them apart (X-E2E-Sub header, no real bearer
 * token validation).
 */

import { test, expect, DEFAULT_E2E_SUB, SECOND_E2E_SUB } from './fixtures.js';

test.describe('Profile — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/profile');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Profile — owner mode', () => {
  test('owner sees their own profile with no Follow button and library/collections links always shown', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });

    await page.goto('/profile');
    // No identity harvested/seeded here, so the heading falls back to a generic label — it must
    // never show the raw PSN account id (psn-account-owner).
    await expect(page.locator('h1')).toContainText('PlayStation account');
    await expect(page.locator('h1')).not.toContainText('psn-account-owner');
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unfollow' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'View library' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View collections' })).toBeVisible();
  });

  test('shows "Unlinked user" when the owner has no PSN link', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile');
    await expect(page.locator('h1')).toContainText('Unlinked user');
  });
});

test.describe('Profile — viewing another user', () => {
  test('viewing another user\'s private (default) profile shows only account-id-or-unlinked and counts', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });
    // Second user must exist (visits at least once) for the mock to know its sub.
    await viewerPage.goto('/profile');

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    // Private (is_public defaults false) -> psn_account_id hidden even though it's linked.
    await expect(viewerPage.locator('h1')).toContainText('Unlinked user');
    await expect(viewerPage.locator('.profile-counts')).toContainText('followers');
    await expect(viewerPage.locator('.profile-section-links a')).toHaveCount(0);
    await expect(viewerPage.locator('.psn-category-card')).toHaveCount(0);
  });

  test('viewing another user\'s fully public profile shows every gated section', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });
    await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, {
      harvest_trophies: true,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: false,
    });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, {
      is_public: true,
      show_library: true,
      show_collections: true,
      show_trophies: true,
      show_identity: true,
    });
    await store.seedUserLibraryGames(DEFAULT_E2E_SUB, [
      { game_id: 'g1', title: 'Bloodborne', rawg_enriched: true, opencritic_enriched: false },
    ]);
    // The viewer needs their own PSN link for cross-user trophies/identity to render.
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: 'psn-account-viewer' });

    await page.goto('/profile'); // registers DEFAULT_E2E_SUB with the mock

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    // Identity is harvested and shown here, so the heading uses the friendly online id, never
    // the raw PSN account id.
    await expect(viewerPage.locator('h1')).toContainText('e2e_gamer');
    await expect(viewerPage.locator('h1')).not.toContainText('psn-account-owner');
    await expect(viewerPage.getByRole('link', { name: 'View library' })).toBeVisible();
    await expect(viewerPage.getByRole('link', { name: 'View collections' })).toBeVisible();
    await expect(viewerPage.locator('.psn-category-card', { hasText: 'Trophies' })).toBeVisible();
    await expect(viewerPage.locator('.psn-category-card', { hasText: 'PSN Identity' })).toBeVisible();
  });

  test('show_trophies=true but the viewer has no PSN link -> no trophies section, no error', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });
    await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_trophies: true });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_trophies: true });
    // Viewer (SECOND_E2E_SUB) deliberately has no PSN link seeded.

    await page.goto('/profile');
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    // No identity harvested here, so the heading falls back to a generic label, not the raw id.
    await expect(viewerPage.locator('h1')).toContainText('PlayStation account');
    await expect(viewerPage.locator('h1')).not.toContainText('psn-account-owner');
    await expect(viewerPage.locator('.psn-category-card')).toHaveCount(0);
    await expect(viewerPage.locator('.text-error')).toHaveCount(0);
  });
});

test.describe('Profile — follow / unfollow', () => {
  test('follow() shows Unfollow and increments the follower count; unfollow() reverses it', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await page.goto('/profile'); // registers DEFAULT_E2E_SUB

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('.profile-counts')).toContainText('0 followers');
    await expect(viewerPage.getByRole('button', { name: 'Follow' })).toBeVisible();

    await viewerPage.getByRole('button', { name: 'Follow' }).click();
    await expect(viewerPage.getByRole('button', { name: 'Unfollow' })).toBeVisible({ timeout: 10_000 });
    await expect(viewerPage.locator('.profile-counts')).toContainText('1 follower');

    await viewerPage.getByRole('button', { name: 'Unfollow' }).click();
    await expect(viewerPage.getByRole('button', { name: 'Follow' })).toBeVisible({ timeout: 10_000 });
    await expect(viewerPage.locator('.profile-counts')).toContainText('0 followers');
  });

  test('no Follow/Unfollow button is shown on your own profile', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unfollow' })).toHaveCount(0);
  });
});

test.describe('Profile — followers / following pages', () => {
  test('followers page renders entries and links back to /u/{sub}', async ({
    authedPage: page,
    secondAuthedPage: otherPage,
    store,
  }) => {
    await store.reset();
    await otherPage.goto('/profile'); // registers SECOND_E2E_SUB
    await store.seedFollow(SECOND_E2E_SUB, DEFAULT_E2E_SUB);

    await page.goto('/profile/followers');
    await expect(page.locator('.follow-list-entry')).toHaveCount(1);
    const link = page.locator('.follow-list-entry a');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(new RegExp(`/u/${SECOND_E2E_SUB}$`), { timeout: 10_000 });
  });

  test('following page renders entries', async ({ authedPage: page, secondAuthedPage: otherPage, store }) => {
    await store.reset();
    await otherPage.goto('/profile'); // registers SECOND_E2E_SUB
    await store.seedFollow(DEFAULT_E2E_SUB, SECOND_E2E_SUB);

    await page.goto('/profile/following');
    await expect(page.locator('.follow-list-entry')).toHaveCount(1);
  });

  test('shows a message when there are no followers yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/followers');
    await expect(page.getByText('No followers yet.')).toBeVisible();
  });
});

test.describe('Profile — settings', () => {
  test('toggles persist across reload', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/settings');
    await page.locator('#setting-is-public').check();
    await expect(page.locator('#setting-is-public')).toBeChecked({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('#setting-is-public')).toBeChecked();
  });

  test('links to the PSN settings page from the AND-gate explanation', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/settings');
    await expect(page.getByRole('link', { name: 'PlayStation settings page' })).toBeVisible();
  });
});

test.describe('Profile — /psn cross-reference copy and region removal', () => {
  test('shows the profile cross-reference copy and no longer shows a region field', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true });

    await page.goto('/psn');
    await expect(page.getByText('may also appear on your public profile')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profile Settings' })).toBeVisible();

    const card = page.locator('.psn-category-card', { hasText: 'PSN Identity' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('e2e_gamer');
    await expect(page.locator('body')).not.toContainText('Region');
  });
});

test.describe('Profile — library / collections sub-keyed routes', () => {
  test('/library/:sub and /collections/:sub render owner vs viewer mode for two seeded users', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_library: true, show_collections: true });
    await store.seedUserLibraryGames(DEFAULT_E2E_SUB, [
      { game_id: 'g1', title: 'Gran Turismo 7', rawg_enriched: true, opencritic_enriched: true },
    ]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [{ definition_id: 'd1', name: 'Weekend picks', kind: 'filter_list' }]);

    await page.goto('/library');
    await expect(page.getByRole('button', { name: 'Refresh library' })).toBeVisible();
    await expect(page.getByText('Gran Turismo 7')).toBeVisible();

    await page.goto('/collections');
    await expect(page.getByRole('button', { name: 'New collection' })).toBeVisible();
    await expect(page.getByText('Weekend picks')).toBeVisible();

    await viewerPage.goto(`/library/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.getByRole('button', { name: 'Refresh library' })).toHaveCount(0);
    await expect(viewerPage.getByText('Gran Turismo 7')).toBeVisible();

    await viewerPage.goto(`/collections/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.getByRole('button', { name: 'New collection' })).toHaveCount(0);
    await expect(viewerPage.getByText('Weekend picks')).toBeVisible();
  });

  test('viewer sees an inline message on a 403 (section not public)', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await page.goto('/profile'); // registers DEFAULT_E2E_SUB, profile stays private/default

    await viewerPage.goto(`/library/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.getByText("This section isn't available.")).toBeVisible();
  });
});

test.describe('Profile — own-sub canonicalization redirects', () => {
  test('/u/{own sub} silently redirects to /profile', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(`/u/${DEFAULT_E2E_SUB}`);
    await page.waitForURL('**/profile', { timeout: 10_000 });
  });

  test('/u/{own sub}/followers silently redirects to /profile/followers', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(`/u/${DEFAULT_E2E_SUB}/followers`);
    await page.waitForURL('**/profile/followers', { timeout: 10_000 });
  });

  test('/u/{own sub}/following silently redirects to /profile/following', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(`/u/${DEFAULT_E2E_SUB}/following`);
    await page.waitForURL('**/profile/following', { timeout: 10_000 });
  });

  test('/library/{own sub} silently redirects to /library', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(`/library/${DEFAULT_E2E_SUB}`);
    await page.waitForURL('**/library', { timeout: 10_000 });
  });

  test('/collections/{own sub} silently redirects to /collections', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(`/collections/${DEFAULT_E2E_SUB}`);
    await page.waitForURL('**/collections', { timeout: 10_000 });
  });

  test('navigating with a DIFFERENT user\'s sub does not redirect and renders viewer mode', async ({
    authedPage: page,
    secondAuthedPage: otherPage,
    store,
  }) => {
    await store.reset();
    await otherPage.goto('/profile'); // registers SECOND_E2E_SUB

    await page.goto(`/u/${SECOND_E2E_SUB}`);
    await expect(page).toHaveURL(new RegExp(`/u/${SECOND_E2E_SUB}$`));
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
  });
});
