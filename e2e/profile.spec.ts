
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

    await expect(page.locator('#page-title')).toContainText('PlayStation account');
    await expect(page.locator('#page-title')).not.toContainText('psn-account-owner');
    await expect(page.locator('#profile-follow-toggle')).toHaveCount(0);
    await expect(page.locator('#profile-library-link')).toHaveText('View library');
    await expect(page.locator('#profile-collections-link')).toHaveText('View collections');
  });

  test('shows "Unlinked user" when the owner has no PSN link', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile');
    await expect(page.locator('#page-title')).toContainText('Unlinked user');
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

    await viewerPage.goto('/profile');

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    await expect(viewerPage.locator('#page-title')).toContainText('Unlinked user');
    await expect(viewerPage.locator('#profile-stat-followers')).toBeVisible();
    await expect(viewerPage.locator('#profile-library-link')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-collections-link')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-trophy-level')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-trophies-earned')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-library')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-collections')).toHaveCount(0);
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

    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: 'psn-account-viewer' });

    await page.goto('/profile');

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    await expect(viewerPage.locator('#page-title')).toContainText('e2e_gamer');
    await expect(viewerPage.locator('#page-title')).not.toContainText('psn-account-owner');
    await expect(viewerPage.locator('#profile-library-link')).toHaveText('View library');
    await expect(viewerPage.locator('#profile-collections-link')).toHaveText('View collections');
    await expect(viewerPage.locator('#profile-stat-trophy-level')).toBeVisible();
    await expect(viewerPage.locator('#profile-stat-trophies-earned')).toBeVisible();
    await expect(viewerPage.locator('#profile-stat-library .stat-value')).toHaveText('1');
    await expect(viewerPage.locator('#profile-stat-member-since')).toBeVisible();
    await expect(viewerPage.locator('#profile-psn-badge')).toBeVisible();
    await expect(viewerPage.locator('body')).not.toContainText('psn-account-owner');
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


    await page.goto('/profile');
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);


    await expect(viewerPage.locator('#page-title')).toContainText('PlayStation account');
    await expect(viewerPage.locator('#page-title')).not.toContainText('psn-account-owner');
    await expect(viewerPage.locator('#profile-stat-trophy-level')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-trophies-earned')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-load-error')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-follow-error')).toHaveCount(0);
  });
});

test.describe('Profile — adding a PSN friend', () => {
  async function seedADisclosedIdentity(store: {
    seedUserPsnLink: (sub: string, link?: { psn_account_id?: string }) => Promise<void>;
    seedUserPsnPreferences: (sub: string, prefs: { harvest_identity?: boolean }) => Promise<void>;
    seedUserProfileSettings: (sub: string, settings: { is_public?: boolean; show_identity?: boolean }) => Promise<void>;
  }): Promise<void> {
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });
    await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_identity: true });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_identity: true });
  }

  test('offers a friend request on a disclosed identity, and sends it only after confirming', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await seedADisclosedIdentity(store);
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: 'psn-account-viewer' });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: true });

    await page.goto('/profile');
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    await expect(viewerPage.locator('#page-title')).toContainText('e2e_gamer');
    await viewerPage.locator('#profile-add-psn-friend').click();

    await expect(viewerPage.locator('#profile-add-psn-friend-prompt')).toContainText('e2e_gamer');
    await viewerPage.locator('#profile-add-psn-friend-confirm').click();

    await expect(viewerPage.locator('#profile-add-psn-friend-sent')).toContainText('e2e_gamer');
    await expect(viewerPage.locator('#profile-add-psn-friend')).toHaveCount(0);
  });

  test('withholds the friend request from a viewer who never granted friend writes', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await seedADisclosedIdentity(store);
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: 'psn-account-viewer' });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: false });

    await page.goto('/profile');
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    await expect(viewerPage.locator('#page-title')).toContainText('e2e_gamer');
    await expect(
      viewerPage.locator('#profile-add-psn-friend'),
      'the write consent is what PSN acts on, so offering the control without it would fail at the API',
    ).toHaveCount(0);
  });

  test('offers no friend request where the online id was never disclosed', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: 'psn-account-owner' });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: 'psn-account-viewer' });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { allow_friend_writes: true });

    await page.goto('/profile');
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);

    await expect(viewerPage.locator('#page-title')).toContainText('PlayStation account');
    await expect(viewerPage.locator('#profile-add-psn-friend')).toHaveCount(0);
  });

  test('no friend request is offered on your own profile', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: true });

    await page.goto('/profile');

    await expect(page.locator('#profile-add-psn-friend')).toHaveCount(0);
  });
});

test.describe('Profile — follow / unfollow', () => {
  test('follow() shows Unfollow and increments the follower count; unfollow() reverses it', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await page.goto('/profile');

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    const followerCount = viewerPage.locator('#profile-stat-followers .stat-value');
    await expect(followerCount).toHaveText('0');
    const followToggle = viewerPage.locator('#profile-follow-toggle');
    await expect(followToggle).toHaveText('Follow');

    await followToggle.click();
    await expect(followToggle).toHaveText('Unfollow', { timeout: 10_000 });
    await expect(followerCount).toHaveText('1');
    await expect(viewerPage.locator('#profile-stat-followers')).toHaveAttribute('aria-label', '1 follower');

    await followToggle.click();
    await expect(followToggle).toHaveText('Follow', { timeout: 10_000 });
    await expect(followerCount).toHaveText('0');
  });

  test('no Follow/Unfollow button is shown on your own profile', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile');
    await expect(page.locator('#profile-follow-toggle')).toHaveCount(0);
  });
});

test.describe('Profile — followers / following pages', () => {
  test('followers page renders entries and links back to /u/{sub}', async ({
    authedPage: page,
    secondAuthedPage: otherPage,
    store,
  }) => {
    await store.reset();
    await otherPage.goto('/profile');
    await store.seedFollow(SECOND_E2E_SUB, DEFAULT_E2E_SUB);

    await page.goto('/profile/followers');
    await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(1);
    const link = page.locator('#follow-link-0');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(new RegExp(`/u/${SECOND_E2E_SUB}$`), { timeout: 10_000 });
  });

  test('following page renders entries', async ({ authedPage: page, secondAuthedPage: otherPage, store }) => {
    await store.reset();
    await otherPage.goto('/profile');
    await store.seedFollow(DEFAULT_E2E_SUB, SECOND_E2E_SUB);

    await page.goto('/profile/following');
    await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(1);
  });

  test('shows a message when there are no followers yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/followers');
    await expect(page.locator('#followers-empty')).toHaveText('No followers yet.');
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
    await expect(page.locator('#profile-settings-psn-link')).toHaveText('PlayStation settings page');
  });

  test('a declared PlayStation profile handle persists and resolves to the site URL', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/profile/settings');
    await page.locator('#profile-link-handle-0').fill('e2e_curator');
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toHaveAttribute(
      'href',
      'https://psnprofiles.com/e2e_curator',
      { timeout: 10_000 },
    );

    await page.reload();
    await expect(page.locator('#profile-link-handle-0')).toHaveValue('e2e_curator');
    await expect(page.locator('#profile-link-url-0')).toHaveAttribute('rel', 'noopener noreferrer nofollow ugc');
  });

  test('removing a declared handle takes the link off the settings page', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/settings');
    await page.locator('#profile-link-handle-0').fill('e2e_curator');
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toBeVisible({ timeout: 10_000 });

    await page.locator('#profile-link-remove-0').click();
    await expect(page.locator('#profile-link-url-0')).toHaveCount(0);
    await expect(page.locator('#profile-link-handle-0')).toHaveValue('');
  });

  test('Save stays disabled for a handle the API would reject', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/profile/settings');
    await page.locator('#profile-link-handle-0').fill('no spaces');
    await expect(page.locator('#profile-link-save-0')).toBeDisabled();
    await expect(page.locator('#profile-link-invalid-0')).toBeVisible();

    await page.locator('#profile-link-handle-0').fill('e2e_curator');
    await expect(page.locator('#profile-link-save-0')).toBeEnabled();
  });
});

test.describe('Profile — declared PlayStation profile links', () => {
  test('a public profile shows the owner\'s links to a viewer; a private one shows none', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await viewerPage.goto('/profile');

    await page.goto('/profile/settings');
    await page.locator('#profile-link-handle-0').fill('e2e_curator');
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toBeVisible({ timeout: 10_000 });

    await page.goto('/profile');
    await expect(page.locator('#profile-stat-profile-links')).toBeVisible();
    await expect(page.locator('#profile-link-0')).toHaveAttribute('href', 'https://psnprofiles.com/e2e_curator');

    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('#profile-stat-profile-links')).toHaveCount(0);

    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
    await viewerPage.goto(`/u/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('#profile-stat-profile-links')).toBeVisible();
    await expect(viewerPage.locator('#profile-link-0')).toHaveAttribute(
      'href',
      'https://psnprofiles.com/e2e_curator',
    );
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

    await page.goto('/account');
    await expect(page.locator('#psn-public-profile-note')).toContainText('may also appear on your public profile');
    await expect(page.locator('#psn-profile-settings-link')).toHaveText('Profile Settings');

    const card = page.locator('#psn-card-identity');
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
    await expect(page.locator('#library-refresh')).toHaveText('Refresh library');
    await expect(page.locator('#library-title-0')).toHaveText('Gran Turismo 7');

    await page.goto('/collections');
    await expect(page.locator('#collections-new')).toHaveText('New collection');
    await expect(page.locator('#collection-name-0')).toHaveText('Weekend picks');

    await viewerPage.goto(`/library/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('#library-refresh')).toHaveCount(0);
    await expect(viewerPage.locator('#library-title-0')).toHaveText('Gran Turismo 7');

    await viewerPage.goto(`/collections/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('#collections-new')).toHaveCount(0);
    await expect(viewerPage.locator('#collection-viewer-name-0')).toHaveText('Weekend picks');
  });

  test('viewer sees an inline message on a 403 (section not public)', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await page.goto('/profile');

    await viewerPage.goto(`/library/${DEFAULT_E2E_SUB}`);
    await expect(viewerPage.locator('#library-forbidden')).toContainText('keeps their library private');
    await expect(viewerPage.locator('#library-forbidden')).toContainText(
      'following them does not grant access',
    );
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
    await otherPage.goto('/profile');

    await page.goto(`/u/${SECOND_E2E_SUB}`);
    await expect(page).toHaveURL(new RegExp(`/u/${SECOND_E2E_SUB}$`));
    await expect(page.locator('#profile-follow-toggle')).toHaveText('Follow');
  });
});
