import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { lowercaseToken, newId, newText, randomIntBetween } from '@crgolden/modules/testing';
import { DEFAULT_E2E_SUB, SECOND_E2E_SUB, type TestStore } from '../fixtures.js';
import { PROFILE_LINK_HANDLE_PLACEHOLDER, ProfileLinkSites } from '../mocks/curator-constants';
import {
  AppUrls,
  FollowListKinds,
  userCollectionsUrl,
  userFollowListUrl,
  userLibraryUrl,
  userProfileUrl,
} from '../../src/app/app-paths';
import { CollectionKinds } from '../../src/curator/curator.models';
import { LinkRelTokens } from '../../src/testing/html-constants';
import e2eSettings from '../e2e-settings.json';
import { Given, Then, When } from './fixtures.js';

const NO_ELEMENTS = 0;
const ONE_ENTRY = 1;
const NO_FOLLOWERS = 0;
const ONE_FOLLOWER = 1;
const HANDLE_WORD_LENGTH_CEILING = e2eSettings.profile.handleWordLengthExclusiveCeiling;
const USER_CONTENT_LINK_REL = [LinkRelTokens.noopener, LinkRelTokens.noreferrer, LinkRelTokens.nofollow, LinkRelTokens.ugc].join(' ');

const OWN_PAGES: Readonly<Record<string, { byId: string; own: string }>> = {
  profile: { byId: userProfileUrl(DEFAULT_E2E_SUB), own: AppUrls.profile },
  followers: { byId: userFollowListUrl(DEFAULT_E2E_SUB, FollowListKinds.followers), own: AppUrls.profileFollowers },
  following: { byId: userFollowListUrl(DEFAULT_E2E_SUB, FollowListKinds.following), own: AppUrls.profileFollowing },
  library: { byId: userLibraryUrl(DEFAULT_E2E_SUB), own: AppUrls.library },
  collections: { byId: userCollectionsUrl(DEFAULT_E2E_SUB), own: AppUrls.collections },
};

function ownPage(name: string): { byId: string; own: string } {
  const pages = OWN_PAGES[name];
  if (pages === undefined) {
    throw new Error(`The feature names a page, '${name}', that has no own-id address.`);
  }
  return pages;
}

function profileLinkUrl(handle: string): string {
  return ProfileLinkSites.psnProfiles.url_template.replace(PROFILE_LINK_HANDLE_PLACEHOLDER, handle);
}

async function discloseOnlineId(store: TestStore, sub: string): Promise<string> {
  const onlineId = newText();
  await store.seedUserPsnProfile(sub, { online_id: onlineId });
  return onlineId;
}

async function saveProfileHandle(page: Page, handle: string): Promise<void> {
  await page.goto(AppUrls.profileSettings);
  await page.locator('#profile-link-handle-0').fill(handle);
  await page.locator('#profile-link-save-0').click();
  await expect(page.locator('#profile-link-url-0')).toBeVisible();
}

async function followMe(follower: Page, page: Page): Promise<void> {
  await page.goto(AppUrls.profile);
  await follower.goto(userProfileUrl(DEFAULT_E2E_SUB));
  const toggle = follower.locator('#profile-follow-toggle');
  await expect(toggle).toHaveAttribute('data-following', String(false));
  await expect(follower.locator('#profile-stat-followers')).toHaveAttribute('data-count', String(NO_FOLLOWERS));
  await toggle.click();
}

Given('my PlayStation account is linked under an account id', async ({ store, ctx }) => {
  ctx.psnAccountId = randomUUID();
  await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ctx.psnAccountId });
});

Given('my profile is fully public, with my online id, trophies and library', async ({ store, ctx }) => {
  ctx.psnAccountId = randomUUID();
  await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ctx.psnAccountId });
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
  ctx.libraryGames = [{ game_id: randomUUID(), title: randomUUID(), rawg_enriched: true, opencritic_enriched: false }];
  await store.seedUserLibraryGames(DEFAULT_E2E_SUB, ctx.libraryGames);
  ctx.onlineId = await discloseOnlineId(store, DEFAULT_E2E_SUB);
});

Given('my profile publicly shows my trophies', async ({ store, ctx }) => {
  ctx.psnAccountId = randomUUID();
  await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: ctx.psnAccountId });
  await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_trophies: true });
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_trophies: true });
});

Given('my profile discloses my online id', async ({ store, ctx }) => {
  await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: newId() });
  await store.seedUserPsnPreferences(DEFAULT_E2E_SUB, { harvest_identity: true });
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_identity: true });
  ctx.onlineId = await discloseOnlineId(store, DEFAULT_E2E_SUB);
});

Given('my profile is public without my online id', async ({ store }) => {
  await store.seedUserPsnLink(DEFAULT_E2E_SUB, { psn_account_id: randomUUID() });
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
});

Given('another signed-in user has allowed friend requests to be sent from their account', async ({ store }) => {
  await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
  await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: true });
});

Given('another signed-in user has not allowed friend requests to be sent from their account', async ({ store }) => {
  await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
  await store.seedUserPsnPreferences(SECOND_E2E_SUB, { harvest_identity: true, allow_friend_writes: false });
});

Given('my PlayStation account is linked and allows friend requests', async ({ store }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: true });
});

Given('another signed-in user already follows me', async ({ page, secondAuthedPage }) => {
  await followMe(secondAuthedPage, page);
  await expect(secondAuthedPage.locator('#profile-follow-toggle')).toHaveAttribute('data-following', String(true));
});

Given('I follow another signed-in user', async ({ store, secondAuthedPage }) => {
  await secondAuthedPage.goto(AppUrls.profile);
  await store.seedFollow(DEFAULT_E2E_SUB, SECOND_E2E_SUB);
});

Given('I have saved a PlayStation profile handle', async ({ page, ctx }) => {
  ctx.profileHandle = newText();
  await saveProfileHandle(page, ctx.profileHandle);
});

Given('my profile is public', async ({ store }) => {
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true });
});

Given('my PlayStation account is linked and discloses my online id', async ({ store, ctx }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_identity: true });
  ctx.onlineId = await discloseOnlineId(store, DEFAULT_E2E_SUB);
});

Given('my library and collections are public and hold one game and one collection', async ({ store, ctx }) => {
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_library: true, show_collections: true });
  ctx.libraryGames = [{ game_id: randomUUID(), title: randomUUID(), rawg_enriched: true, opencritic_enriched: true }];
  ctx.sharedDefinitionId = randomUUID();
  await store.seedUserLibraryGames(DEFAULT_E2E_SUB, ctx.libraryGames);
  await store.seedUserCollections(DEFAULT_E2E_SUB, [
    { definition_id: ctx.sharedDefinitionId, name: randomUUID(), kind: CollectionKinds.filterList },
  ]);
});

Given('another user has signed in', async ({ secondAuthedPage }) => {
  await secondAuthedPage.goto(AppUrls.profile);
});

When('I open my profile', async ({ page }) => {
  await page.goto(AppUrls.profile);
});

When('another signed-in user opens my profile', async ({ page, secondAuthedPage }) => {
  await page.goto(AppUrls.profile);
  await secondAuthedPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
});

When('another signed-in user with a linked account opens my profile', async ({ page, store, secondAuthedPage }) => {
  await store.seedUserPsnLink(SECOND_E2E_SUB, { psn_account_id: randomUUID() });
  await page.goto(AppUrls.profile);
  await secondAuthedPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
});

When('they open my profile', async ({ page, secondAuthedPage }) => {
  await page.goto(AppUrls.profile);
  await secondAuthedPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
});

async function askToAddMeAsAFriend(page: Page, secondAuthedPage: Page, onlineId: string): Promise<void> {
  await page.goto(AppUrls.profile);
  await secondAuthedPage.goto(userProfileUrl(DEFAULT_E2E_SUB));
  await expect(secondAuthedPage.locator('#page-title')).toHaveAttribute('data-online-id', onlineId);
  await secondAuthedPage.locator('#profile-add-psn-friend').click();
}

async function typeAHandleWithASpace(page: Page): Promise<void> {
  await page.goto(AppUrls.profileSettings);
  await page
    .locator('#profile-link-handle-0')
    .fill(`${lowercaseToken(randomIntBetween(1, HANDLE_WORD_LENGTH_CEILING))} ${lowercaseToken(randomIntBetween(1, HANDLE_WORD_LENGTH_CEILING))}`);
}

When('they ask to add me as a PlayStation friend', async ({ page, secondAuthedPage, ctx }) => {
  await askToAddMeAsAFriend(page, secondAuthedPage, ctx.onlineId);
});

Given('they have asked to add me as a PlayStation friend', async ({ page, secondAuthedPage, ctx }) => {
  await askToAddMeAsAFriend(page, secondAuthedPage, ctx.onlineId);
  await expect(secondAuthedPage.locator('#profile-add-psn-friend-prompt')).toBeVisible();
});

When('they confirm', async ({ secondAuthedPage }) => {
  await secondAuthedPage.locator('#profile-add-psn-friend-confirm').click();
});

When('another signed-in user follows me', async ({ page, secondAuthedPage }) => {
  await followMe(secondAuthedPage, page);
});

When('they stop following me', async ({ secondAuthedPage }) => {
  await secondAuthedPage.locator('#profile-follow-toggle').click();
});

When('I open my followers and follow the first one', async ({ page }) => {
  await page.goto(AppUrls.profileFollowers);
  await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(ONE_ENTRY);
  await expect(page.locator('#follow-link-0')).toBeVisible();
  await page.locator('#follow-link-0').click();
});

When('I open who I follow', async ({ page }) => {
  await page.goto(AppUrls.profileFollowing);
});

When('I open my followers', async ({ page }) => {
  await page.goto(AppUrls.profileFollowers);
});

When('I make my profile public and reload the settings', async ({ page }) => {
  await page.goto(AppUrls.profileSettings);
  await page.locator('#setting-is-public').check();
  await expect(page.locator('#setting-is-public')).toBeChecked();
  await page.reload();
});

When('I open my profile settings', async ({ page }) => {
  await page.goto(AppUrls.profileSettings);
});

When('I save a PlayStation profile handle and reload the settings', async ({ page, ctx }) => {
  ctx.profileHandle = newText();
  await saveProfileHandle(page, ctx.profileHandle);
  await expect(page.locator('#profile-link-url-0')).toHaveAttribute('href', profileLinkUrl(ctx.profileHandle));
  await page.reload();
});

When('I remove the handle', async ({ page }) => {
  await page.locator('#profile-link-remove-0').click();
});

When('I type a handle with a space in it', async ({ page }) => {
  await typeAHandleWithASpace(page);
});

Given('I have typed a handle with a space in it', async ({ page }) => {
  await typeAHandleWithASpace(page);
  await expect(page.locator('#profile-link-save-0')).toBeDisabled();
});

When('I type a handle without one', async ({ page }) => {
  await page.locator('#profile-link-handle-0').fill(newText());
});

When('I open my account', async ({ page }) => {
  await page.goto(AppUrls.account);
});

When('I open my library and my collections, and another signed-in user opens them too', async ({ page, secondAuthedPage }) => {
  await page.goto(AppUrls.library);
  await secondAuthedPage.goto(userLibraryUrl(DEFAULT_E2E_SUB));
});

When('another signed-in user opens my library', async ({ page, secondAuthedPage }) => {
  await page.goto(AppUrls.profile);
  await secondAuthedPage.goto(userLibraryUrl(DEFAULT_E2E_SUB));
});

When('I open my {word} by my own id', async ({ page }, name: string) => {
  await page.goto(ownPage(name).byId);
});

When("I open that user's profile", async ({ page }) => {
  await page.goto(userProfileUrl(SECOND_E2E_SUB));
});

Then('my profile says I have a PlayStation account without showing its id', async ({ page, ctx }) => {
  await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
  await expect(page.locator('#page-title')).not.toHaveAttribute('data-online-id');
  await expect(page.locator('#page-title')).not.toContainText(ctx.psnAccountId);
});

Then('I am offered my library and my collections', async ({ page }) => {
  await expect(page.locator('#profile-library-link')).toHaveAttribute('href', AppUrls.library);
  await expect(page.locator('#profile-collections-link')).toHaveAttribute('href', AppUrls.collections);
});

Then('I am offered no way to follow myself', async ({ page }) => {
  await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account');
  await expect(page.locator('#profile-follow-toggle')).toHaveCount(NO_ELEMENTS);
});

Then('my profile says I have no PlayStation account', async ({ page }) => {
  await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(false));
});

Then('they see my follower count and nothing I have not made public', async ({ secondAuthedPage }) => {
  const viewer = secondAuthedPage;
  await expect(viewer.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(false));
  await expect(viewer.locator('#profile-stat-followers')).toBeVisible();
  for (const hidden of [
    '#profile-library-link',
    '#profile-collections-link',
    '#profile-stat-trophy-level',
    '#profile-stat-trophies-earned',
    '#profile-stat-library',
    '#profile-stat-collections',
  ]) {
    await expect(viewer.locator(hidden)).toHaveCount(NO_ELEMENTS);
  }
});

Then('they see my online id, trophies, library, collections and membership', async ({ secondAuthedPage, ctx }) => {
  const viewer = secondAuthedPage;
  await expect(viewer.locator('#page-title')).toHaveAttribute('data-online-id', ctx.onlineId);
  await expect(viewer.locator('#profile-library-link')).toHaveAttribute('href', userLibraryUrl(DEFAULT_E2E_SUB));
  await expect(viewer.locator('#profile-collections-link')).toHaveAttribute('href', userCollectionsUrl(DEFAULT_E2E_SUB));
  await expect(viewer.locator('#profile-stat-trophy-level')).toBeVisible();
  await expect(viewer.locator('#profile-stat-trophies-earned')).toBeVisible();
  await expect(viewer.locator('#profile-stat-library')).toHaveAttribute('data-count', String(ctx.libraryGames.length));
  await expect(viewer.locator('#profile-stat-member-since')).toBeVisible();
  await expect(viewer.locator('#profile-psn-badge')).toBeVisible();
});

Then('my account id appears nowhere on the page', async ({ secondAuthedPage, ctx }) => {
  await expect(secondAuthedPage.locator('#page-title')).not.toContainText(ctx.psnAccountId);
  await expect(secondAuthedPage.locator('body')).not.toContainText(ctx.psnAccountId);
});

Then('they see I have a PlayStation account, without its id', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
  await expect(secondAuthedPage.locator('#page-title')).not.toHaveAttribute('data-online-id');
});

Then('they see no trophies and no error', async ({ secondAuthedPage }) => {
  const viewer = secondAuthedPage;
  await expect(viewer.locator('#profile-stat-trophy-level')).toHaveCount(NO_ELEMENTS);
  await expect(viewer.locator('#profile-stat-trophies-earned')).toHaveCount(NO_ELEMENTS);
  await expect(viewer.locator('#profile-load-error')).toHaveCount(NO_ELEMENTS);
  await expect(viewer.locator('#profile-follow-error')).toHaveCount(NO_ELEMENTS);
});

Then('they are asked to confirm, and nothing is sent yet', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#profile-add-psn-friend-prompt')).toBeVisible();
  await expect(secondAuthedPage.locator('#profile-add-psn-friend-sent')).toHaveCount(NO_ELEMENTS);
});

Then('they are told the request was sent', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#profile-add-psn-friend-sent')).toBeVisible();
  await expect(secondAuthedPage.locator('#profile-add-psn-friend')).toHaveCount(NO_ELEMENTS);
});

Then('they see my online id', async ({ secondAuthedPage, ctx }) => {
  await expect(secondAuthedPage.locator('#page-title')).toHaveAttribute('data-online-id', ctx.onlineId);
});

Then('they are offered no friend request', async ({ secondAuthedPage }) => {
  await expect(
    secondAuthedPage.locator('#profile-add-psn-friend'),
    'the write consent is what PSN acts on, so offering the control without it would fail at the API',
  ).toHaveCount(NO_ELEMENTS);
});

Then('my profile says I have a PlayStation account', async ({ page }) => {
  await expect(page.locator('#page-title')).toHaveAttribute('data-has-psn-account', String(true));
});

Then('I am offered no friend request', async ({ page }) => {
  await expect(page.locator('#profile-add-psn-friend')).toHaveCount(NO_ELEMENTS);
});

Then('they are following me and I have one follower', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#profile-follow-toggle')).toHaveAttribute('data-following', String(true));
  await expect(secondAuthedPage.locator('#profile-stat-followers')).toHaveAttribute('data-count', String(ONE_FOLLOWER));
});

Then('they are not following me and I have no followers', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#profile-follow-toggle')).toHaveAttribute('data-following', String(false));
  await expect(secondAuthedPage.locator('#profile-stat-followers')).toHaveAttribute('data-count', String(NO_FOLLOWERS));
});

Then('I am on their profile', async ({ page }) => {
  await page.waitForURL(new RegExp(`${userProfileUrl(SECOND_E2E_SUB)}$`));
});

Then('I see one user I follow', async ({ page }) => {
  await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(ONE_ENTRY);
});

Then('I am told I have no followers yet', async ({ page }) => {
  await expect(page.locator('#followers-empty')).toBeVisible();
  await expect(page.locator('[id^="follow-entry-"]')).toHaveCount(NO_ELEMENTS);
});

Then('my profile is still public', async ({ page }) => {
  await expect(page.locator('#setting-is-public')).toBeChecked();
});

Then('I am offered my account page to change what PlayStation shares', async ({ page }) => {
  await expect(page.locator('#profile-settings-psn-link')).toHaveAttribute('href', AppUrls.account);
});

Then('the handle is kept and links to that site, marked as user content', async ({ page, ctx }) => {
  await expect(page.locator('#profile-link-handle-0')).toHaveValue(ctx.profileHandle);
  await expect(page.locator('#profile-link-url-0')).toHaveAttribute('rel', USER_CONTENT_LINK_REL);
});

Then('the settings offer no link and the handle is empty', async ({ page }) => {
  await expect(page.locator('#profile-link-url-0')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#profile-link-handle-0')).toBeEmpty();
});

Then('I cannot save it and I am told why', async ({ page }) => {
  await expect(page.locator('#profile-link-save-0')).toBeDisabled();
  await expect(page.locator('#profile-link-invalid-0')).toBeVisible();
});

Then('I can save it', async ({ page }) => {
  await expect(page.locator('#profile-link-save-0')).toBeEnabled();
});

Then('my profile links to that PlayStation profile', async ({ page, ctx }) => {
  await expect(page.locator('#profile-stat-profile-links')).toBeVisible();
  await expect(page.locator('#profile-link-0')).toHaveAttribute('href', profileLinkUrl(ctx.profileHandle));
});

Then('they see no PlayStation profile links', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#profile-stat-profile-links')).toHaveCount(NO_ELEMENTS);
});

Then('they see a link to my PlayStation profile', async ({ secondAuthedPage, ctx }) => {
  await expect(secondAuthedPage.locator('#profile-stat-profile-links')).toBeVisible();
  await expect(secondAuthedPage.locator('#profile-link-0')).toHaveAttribute('href', profileLinkUrl(ctx.profileHandle));
});

Then('I am told the public profile is set on the profile settings page', async ({ page }) => {
  await expect(page.locator('#psn-public-profile-note')).toBeVisible();
  await expect(page.locator('#psn-profile-settings-link')).toHaveAttribute('href', AppUrls.profileSettings);
});

Then('my identity card shows my online id', async ({ page, ctx }) => {
  const card = page.locator('#psn-card-identity');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-online-id', ctx.onlineId);
});

Then('I see my game and collection with owner controls', async ({ page, ctx }) => {
  const [game] = ctx.libraryGames;
  await expect(page.locator('#library-refresh')).toBeVisible();
  await expect(page.locator(`#library-row-${game.game_id}`)).toBeVisible();
  await page.goto(AppUrls.collections);
  await expect(page.locator('#collections-new')).toBeVisible();
  await expect(page.locator('#collection-name-0')).toHaveAttribute('data-definition-id', ctx.sharedDefinitionId);
});

Then('they see the same game and collection without owner controls', async ({ secondAuthedPage, ctx }) => {
  const [game] = ctx.libraryGames;
  await expect(secondAuthedPage.locator('#library-refresh')).toHaveCount(NO_ELEMENTS);
  await expect(secondAuthedPage.locator(`#library-row-${game.game_id}`)).toBeVisible();
  await secondAuthedPage.goto(userCollectionsUrl(DEFAULT_E2E_SUB));
  await expect(secondAuthedPage.locator('#collections-new')).toHaveCount(NO_ELEMENTS);
  await expect(secondAuthedPage.locator('#collection-viewer-name-0')).toHaveAttribute('data-definition-id', ctx.sharedDefinitionId);
});

Then('they are told the library is not public, and shown no table', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#library-forbidden')).toBeVisible();
  await expect(secondAuthedPage.locator('#library-table-scroll')).toHaveCount(NO_ELEMENTS);
});

Then('I am on my own {word}', async ({ page }, name: string) => {
  await page.waitForURL(`**${ownPage(name).own}`);
});

Then('I stay on their profile and am offered to follow them', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`${userProfileUrl(SECOND_E2E_SUB)}$`));
  await expect(page.locator('#profile-follow-toggle')).toHaveAttribute('data-following', String(false));
});
