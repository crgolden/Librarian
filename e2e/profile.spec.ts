
import { randomUUID } from 'node:crypto';

import { lowercaseToken, newId, newText, randomIntBetween } from '@crgolden/modules/testing';
import { test, expect, DEFAULT_E2E_SUB, SECOND_E2E_SUB, type TestStore } from './fixtures.js';
import { PROFILE_LINK_HANDLE_PLACEHOLDER, ProfileLinkSites } from './mocks/curator-constants';
import { AppUrls, FollowListKinds, userCollectionsUrl, userFollowListUrl, userLibraryUrl, userProfileUrl } from '../src/app/app-paths';
import { CollectionKinds } from '../src/curator/curator.models';
import { BffPaths } from '../src/shared/bff-contract';

const FIRST_LINK_SITE = ProfileLinkSites.psnProfiles;

function profileLinkUrl(handle: string): string {
  return FIRST_LINK_SITE.url_template.replace(PROFILE_LINK_HANDLE_PLACEHOLDER, handle);
}

function newHandleWithASpace(): string {
  return `${lowercaseToken(randomIntBetween(1, 8))} ${lowercaseToken(randomIntBetween(1, 8))}`;
}

async function seedADisclosedOnlineId(store: TestStore, sub: string): Promise<string> {
  const onlineId = newText();
  await store.seedUserPsnProfile(sub, { online_id: onlineId });
  return onlineId;
}

test.describe('Profile — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profile);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('Profile — owner mode', () => {
  test('owner sees their own profile with no Follow button and library/collections links always shown', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const ownerPsnAccountId = randomUUID();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ownerPsnAccountId });

    await page.goto(AppUrls.profile);

    await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
    await expect(page.locator('#page-title')).not.toHaveAttribute('data-online-id');
    await expect(page.locator('#page-title')).not.toContainText(ownerPsnAccountId);
    await expect(page.locator('#profile-follow-toggle')).toHaveCount(0);
    await expect(page.locator('#profile-library-link')).toHaveAttribute('href', AppUrls.library);
    await expect(page.locator('#profile-collections-link')).toHaveAttribute('href', AppUrls.collections);
  });

  test('shows UNLINKED_USER_NAME when the owner has no PSN link', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profile);
    await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(false));
  });
});

test.describe('Profile — viewing another user', () => {
  test('viewing another user\'s private (default) profile shows only account-id-or-unlinked and counts', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: randomUUID() });

    await viewerPage.goto(AppUrls.profile);

    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(false));
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
    const ownerPsnAccountId = randomUUID();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ownerPsnAccountId });
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
    const ownerLibrary = [{ game_id: randomUUID(), title: randomUUID(), rawg_enriched: true, opencritic_enriched: false }];
    await store.seedUserLibraryGames(DEFAULT_E2E_SUB, ownerLibrary);
    const ownerOnlineId = await seedADisclosedOnlineId(store, DEFAULT_E2E_SUB);

    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });

    await page.goto(AppUrls.profile);

    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-online-id', ownerOnlineId);
    await expect(viewerPage.locator('#page-title')).not.toContainText(ownerPsnAccountId);
    await expect(viewerPage.locator('#profile-library-link')).toHaveAttribute('href', userLibraryUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#profile-collections-link')).toHaveAttribute(
      'href',
      userCollectionsUrl(DEFAULT_E2E_SUB),
    );
    await expect(viewerPage.locator('#profile-stat-trophy-level')).toBeVisible();
    await expect(viewerPage.locator('#profile-stat-trophies-earned')).toBeVisible();
    await expect(viewerPage.locator('#profile-stat-library')).toHaveAttribute('data-count', String(ownerLibrary.length));
    await expect(viewerPage.locator('#profile-stat-member-since')).toBeVisible();
    await expect(viewerPage.locator('#profile-psn-badge')).toBeVisible();
    await expect(viewerPage.locator('body')).not.toContainText(ownerPsnAccountId);
  });

  test('show_trophies=true but the viewer has no PSN link -> no trophies section, no error', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    const ownerPsnAccountId = randomUUID();
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ownerPsnAccountId });
    await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_trophies: true });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_trophies: true });


    await page.goto(AppUrls.profile);
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));


    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
    await expect(viewerPage.locator('#page-title')).not.toHaveAttribute('data-online-id');
    await expect(viewerPage.locator('#page-title')).not.toContainText(ownerPsnAccountId);
    await expect(viewerPage.locator('#profile-stat-trophy-level')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-stat-trophies-earned')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-load-error')).toHaveCount(0);
    await expect(viewerPage.locator('#profile-follow-error')).toHaveCount(0);
  });
});

test.describe('Profile — adding a PSN friend', () => {
  async function seedADisclosedIdentity(store: TestStore): Promise<string> {
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: newId() });
    await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_identity: true });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_identity: true });
    return seedADisclosedOnlineId(store, DEFAULT_E2E_SUB);
  }

  test('offers a friend request on a disclosed identity, and sends it only after confirming', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    const ownerOnlineId = await seedADisclosedIdentity(store);
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: true });

    await page.goto(AppUrls.profile);
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-online-id', ownerOnlineId);
    await viewerPage.locator('#profile-add-psn-friend').click();

    await expect(viewerPage.locator('#profile-add-psn-friend-prompt')).toBeVisible();
    await expect(viewerPage.locator('#profile-add-psn-friend-sent')).toHaveCount(0);
    await viewerPage.locator('#profile-add-psn-friend-confirm').click();

    await expect(viewerPage.locator('#profile-add-psn-friend-sent')).toBeVisible();
    await expect(viewerPage.locator('#profile-add-psn-friend')).toHaveCount(0);
  });

  test('withholds the friend request from a viewer who never granted friend writes', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    const ownerOnlineId = await seedADisclosedIdentity(store);
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: false });

    await page.goto(AppUrls.profile);
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-online-id', ownerOnlineId);
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
    await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: randomUUID() });
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
    await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
    await store.seedUserPsnPreferences(SECOND_E2E_SUB, { allow_friend_writes: true });

    await page.goto(AppUrls.profile);
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
    await expect(viewerPage.locator('#page-title')).not.toHaveAttribute('data-online-id');
    await expect(viewerPage.locator('#profile-add-psn-friend')).toHaveCount(0);
  });

  test('no friend request is offered on your own profile', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: true });

    await page.goto(AppUrls.profile);

    await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
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
    await page.goto(AppUrls.profile);

    const followersBefore = 0;
    const followersAfterOneFollow = followersBefore + 1;
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
    const followerStat = viewerPage.locator('#profile-stat-followers');
    await expect(followerStat).toHaveAttribute('data-count', String(followersBefore));
    const followToggle = viewerPage.locator('#profile-follow-toggle');
    await expect(followToggle).toHaveAttribute('data-following', String(false));

    await followToggle.click();
    await expect(followToggle).toHaveAttribute('data-following', String(true));
    await expect(followerStat).toHaveAttribute('data-count', String(followersAfterOneFollow));

    await followToggle.click();
    await expect(followToggle).toHaveAttribute('data-following', String(false));
    await expect(followerStat).toHaveAttribute('data-count', String(followersBefore));
  });

  test('no Follow/Unfollow button is shown on your own profile', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profile);
    await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account');
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
    await otherPage.goto(AppUrls.profile);
    await store.seedFollow(SECOND_E2E_SUB, DEFAULT_E2E_SUB);

    await page.goto(AppUrls.profileFollowers);
    await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(1);
    const link = page.locator('#follow-link-0');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(new RegExp(`${userProfileUrl(SECOND_E2E_SUB)}$`));
  });

  test('following page renders entries', async ({ authedPage: page, secondAuthedPage: otherPage, store }) => {
    await store.reset();
    await otherPage.goto(AppUrls.profile);
    await store.seedFollow(DEFAULT_E2E_SUB, SECOND_E2E_SUB);

    await page.goto(AppUrls.profileFollowing);
    await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(1);
  });

  test('shows a message when there are no followers yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profileFollowers);
    await expect(page.locator('#followers-empty')).toBeVisible();
    await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(0);
  });
});

test.describe('Profile — settings', () => {
  test('toggles persist across reload', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profileSettings);
    await page.locator('#setting-is-public').check();
    await expect(page.locator('#setting-is-public')).toBeChecked();

    await page.reload();
    await expect(page.locator('#setting-is-public')).toBeChecked();
  });

  test('links to the PSN settings page from the AND-gate explanation', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profileSettings);
    await expect(page.locator('#profile-settings-psn-link')).toHaveAttribute('href', AppUrls.account);
  });

  test('a declared PlayStation profile handle persists and resolves to the site URL', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const handle = newText();

    await page.goto(AppUrls.profileSettings);
    await page.locator('#profile-link-handle-0').fill(handle);
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toHaveAttribute('href', profileLinkUrl(handle));

    await page.reload();
    await expect(page.locator('#profile-link-handle-0')).toHaveValue(handle);
    await expect(page.locator('#profile-link-url-0')).toHaveAttribute('rel', 'noopener noreferrer nofollow ugc');
  });

  test('removing a declared handle takes the link off the settings page', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profileSettings);
    await page.locator('#profile-link-handle-0').fill(newText());
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toBeVisible();

    await page.locator('#profile-link-remove-0').click();
    await expect(page.locator('#profile-link-url-0')).toHaveCount(0);
    await expect(page.locator('#profile-link-handle-0')).toHaveValue('');
  });

  test('Save stays disabled for a handle the API would reject', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.profileSettings);
    await page.locator('#profile-link-handle-0').fill(newHandleWithASpace());
    await expect(page.locator('#profile-link-save-0')).toBeDisabled();
    await expect(page.locator('#profile-link-invalid-0')).toBeVisible();

    await page.locator('#profile-link-handle-0').fill(newText());
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
    const handle = newText();
    await viewerPage.goto(AppUrls.profile);

    await page.goto(AppUrls.profileSettings);
    await page.locator('#profile-link-handle-0').fill(handle);
    await page.locator('#profile-link-save-0').click();
    await expect(page.locator('#profile-link-url-0')).toBeVisible();

    await page.goto(AppUrls.profile);
    await expect(page.locator('#profile-stat-profile-links')).toBeVisible();
    await expect(page.locator('#profile-link-0')).toHaveAttribute('href', profileLinkUrl(handle));

    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#profile-stat-profile-links')).toHaveCount(0);

    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
    await viewerPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#profile-stat-profile-links')).toBeVisible();
    await expect(viewerPage.locator('#profile-link-0')).toHaveAttribute('href', profileLinkUrl(handle));
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
    const onlineId = await seedADisclosedOnlineId(store, DEFAULT_E2E_SUB);

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-public-profile-note')).toBeVisible();
    await expect(page.locator('#psn-profile-settings-link')).toHaveAttribute('href', AppUrls.profileSettings);

    const card = page.locator('#psn-card-identity');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-online-id', onlineId);
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
    const gameId = randomUUID();
    const definitionId = randomUUID();
    await store.seedUserLibraryGames(DEFAULT_E2E_SUB, [
      { game_id: gameId, title: randomUUID(), rawg_enriched: true, opencritic_enriched: true },
    ]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [{ definition_id: definitionId, name: randomUUID(), kind: CollectionKinds.filterList }]);

    await page.goto(AppUrls.library);
    await expect(page.locator('#library-refresh')).toBeVisible();
    await expect(page.locator(`#library-row-${gameId}`)).toBeVisible();

    await page.goto(AppUrls.collections);
    await expect(page.locator('#collections-new')).toBeVisible();
    await expect(page.locator('#collection-name-0')).toHaveAttribute('data-definition-id', definitionId);

    await viewerPage.goto(userLibraryUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#library-refresh')).toHaveCount(0);
    await expect(viewerPage.locator(`#library-row-${gameId}`)).toBeVisible();

    await viewerPage.goto(userCollectionsUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#collections-new')).toHaveCount(0);
    await expect(viewerPage.locator('#collection-viewer-name-0')).toHaveAttribute('data-definition-id', definitionId);
  });

  test('viewer sees an inline message on a 403 (section not public)', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    await page.goto(AppUrls.profile);

    await viewerPage.goto(userLibraryUrl(DEFAULT_E2E_SUB));
    await expect(viewerPage.locator('#library-forbidden')).toBeVisible();
    await expect(viewerPage.locator('#library-table-scroll')).toHaveCount(0);
  });
});

test.describe('Profile — own-sub canonicalization redirects', () => {
  test('/u/{own sub} silently redirects to /profile', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(userProfileUrl(DEFAULT_E2E_SUB));
    await page.waitForURL(`**${AppUrls.profile}`);
  });

  test('/u/{own sub}/followers silently redirects to /profile/followers', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(userFollowListUrl(DEFAULT_E2E_SUB, FollowListKinds.followers));
    await page.waitForURL(`**${AppUrls.profileFollowers}`);
  });

  test('/u/{own sub}/following silently redirects to /profile/following', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(userFollowListUrl(DEFAULT_E2E_SUB, FollowListKinds.following));
    await page.waitForURL(`**${AppUrls.profileFollowing}`);
  });

  test('/library/{own sub} silently redirects to /library', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(userLibraryUrl(DEFAULT_E2E_SUB));
    await page.waitForURL(`**${AppUrls.library}`);
  });

  test('the collections page for your own sub silently redirects to your own collections page', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(userCollectionsUrl(DEFAULT_E2E_SUB));
    await page.waitForURL(`**${AppUrls.collections}`);
  });

  test('navigating with a DIFFERENT user\'s sub does not redirect and renders viewer mode', async ({
    authedPage: page,
    secondAuthedPage: otherPage,
    store,
  }) => {
    await store.reset();
    await otherPage.goto(AppUrls.profile);

    await page.goto(userProfileUrl(SECOND_E2E_SUB));
    await expect(page).toHaveURL(new RegExp(`${userProfileUrl(SECOND_E2E_SUB)}$`));
    await expect(page.locator('#profile-follow-toggle')).toHaveAttribute('data-following', String(false));
  });
});
