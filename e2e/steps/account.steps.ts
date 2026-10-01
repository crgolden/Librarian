import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { lowercaseToken, newText } from '@crgolden/modules/testing';
import { DEFAULT_E2E_SUB, newFutureInstant, newTrophySummary } from '../fixtures.js';
import { AppUrls } from '../../src/app/app-paths';
import { CuratorApi } from '../../src/curator/curator-api';
import { ACTION_HISTORY_FILE_NAME, NPSSO_LENGTH } from '../../src/psn/psn-settings.messages';
import { AccountActionOutcomes, RefreshCadences } from '../../src/curator/curator.models';
import { AccountActions } from '../mocks/curator-constants';
import { waitForDownload } from '../playwright-events';
import { HttpMethods } from '../../src/bff/http-headers';
import { Given, Then, When } from './fixtures.js';

const VALID_NPSSO = lowercaseToken(NPSSO_LENGTH);
const NO_ELEMENTS = 0;
const CATEGORY_CARD_IDS = ['#psn-card-trophies', '#psn-card-identity', '#psn-card-presence', '#psn-card-devices'];
const PREFERENCE_IDS = ['#pref-trophies', '#pref-identity', '#pref-presence', '#pref-devices'];
const LINK_SUCCESS_IDS = [
  '#psn-link-success-trophies',
  '#psn-link-success-identity',
  '#psn-link-success-presence',
  '#psn-link-success-devices',
];

function actionsOf(entries: Locator): Promise<(string | null)[]> {
  return entries.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-action')));
}

async function linkWithToken(page: Page): Promise<void> {
  await page.goto(AppUrls.account);
  await page.locator('#npsso').fill(VALID_NPSSO);
  await page.locator('#psn-link-submit').click();
}

Given('my refresh schedule runs daily', async ({ store }) => {
  await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { cadence: RefreshCadences.daily, next_run_at: newFutureInstant() });
});

Given('my PlayStation account is linked without a refresh token', async ({ store }) => {
  await store.seedPsnLink({ refresh_token_expires_at: null });
});

Given('I have linked and then unlinked my PlayStation account', async ({ page }) => {
  await linkWithToken(page);
  await expect(page.locator('#psn-unlink')).toBeVisible();
  await page.locator('#psn-unlink').click();
  await expect(page.locator('#psn-link-submit')).toBeVisible();
});

Given('my PlayStation account is linked and has a trophy summary', async ({ store, ctx }) => {
  await store.seedPsnLink();
  const trophySummary = newTrophySummary();
  await store.seedUserPsnProfile(DEFAULT_E2E_SUB, { trophy_summary: trophySummary });
  ctx.trophyLevel = trophySummary.level;
  ctx.platinumCount = trophySummary.earned.platinum;
});

Given('my PlayStation account is linked and shares my identity', async ({ store, ctx }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_identity: true });
  ctx.onlineId = newText();
  await store.seedUserPsnProfile(DEFAULT_E2E_SUB, { online_id: ctx.onlineId });
});

Given('my account shares my identity, allows friend requests and has received one', async ({ store, ctx }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: true });
  ctx.onlineId = randomUUID();
  await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: ctx.onlineId, account_id: randomUUID() }]);
});

Given('my PlayStation account is linked and has received a friend request', async ({ store }) => {
  await store.seedPsnLink();
  await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: newText(), account_id: randomUUID() }]);
});

Given('my account shares my identity, does not allow friend requests and has received one', async ({ store }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: false });
  await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: newText(), account_id: randomUUID() }]);
});

Given('my PlayStation account is linked and has an OpenCritic key set', async ({ store }) => {
  await store.seedPsnLink();
  await store.seedEnrichmentKeys({ opencritic_configured: true });
});

When('I open my old PlayStation settings bookmark', async ({ page }) => {
  await page.goto(AppUrls.psn);
});

When('I unlink my PlayStation account and reload', async ({ page }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
  await page.locator('#psn-unlink').click();
  await expect(page.locator('#psn-link-submit')).toBeVisible();
  await page.reload();
});

When('I link my PlayStation account with a sign-in token', async ({ page }) => {
  await linkWithToken(page);
});

When('I unlink my PlayStation account', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-unlink').click();
});

When('I open my account history', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-action-history-load').click();
});

When('I open my account history and download it', async ({ page, ctx }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-action-history-load').click();
  const [download] = await Promise.all([waitForDownload(page), page.locator('#psn-action-history-download').click()]);
  ctx.downloadedFileName = download.suggestedFilename();
});

function preferencesSaved(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) => response.request().method() === HttpMethods.put && new URL(response.url()).pathname === CuratorApi.mePsnPreferences,
  );
}

When('I ask to delete my data', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-delete-request').click();
});

Given('I have asked to delete my data', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-delete-request').click();
  await expect(page.locator('#psn-delete-confirm-prompt')).toBeVisible();
});

Given('I have turned trophy sharing on', async ({ page }) => {
  await page.goto(AppUrls.account);
  const saved = preferencesSaved(page);
  await page.locator('#pref-trophies').check();
  await saved;
  await expect(page.locator('#psn-card-trophies')).toBeVisible();
});

Given('I am looking at my identity card', async ({ page, ctx }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#psn-card-identity')).toHaveAttribute('data-online-id', ctx.onlineId);
});

Given('I have turned identity sharing off', async ({ page }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#psn-card-identity')).toBeVisible();
  const saved = preferencesSaved(page);
  await page.locator('#pref-identity').uncheck();
  await saved;
  await expect(page.locator('#psn-card-identity')).not.toBeVisible();
});

Given('I am looking at a friend request', async ({ page, ctx }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#friend-request-0')).toHaveAttribute('data-online-id', ctx.onlineId);
});

When('I confirm the deletion', async ({ page }) => {
  await page.locator('#psn-delete-confirm').click();
});

When('I ask to delete my data and back out', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#psn-delete-request').click();
  await page.locator('#psn-delete-cancel').click();
});

When('I turn trophy sharing on', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#pref-trophies').check();
});

When('I reload my account', async ({ page }) => {
  await page.reload();
});

When('I allow friend requests to be sent and reload my account', async ({ page }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#pref-friend-writes')).not.toBeChecked();
  await expect(page.locator('#pref-chat-writes')).not.toBeChecked();
  await page.locator('#pref-friend-writes').check();
  await page.reload();
});

When('I allow chat messages to be sent', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#pref-chat-writes').check();
});

When('I turn identity sharing off', async ({ page }) => {
  await page.locator('#pref-identity').uncheck();
});

When('I accept it', async ({ page }) => {
  await page.locator('#friend-request-accept-0').click();
});

When('I save a RAWG key and reload my account', async ({ page }) => {
  await page.goto(AppUrls.account);
  await page.locator('#rawg-key').fill(newText());
  await page.locator('#psn-rawg-key-save').click();
  await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
  await expect(page.locator('#opencritic-key')).toBeVisible();
  await page.reload();
});

When('I save a RAWG key', async ({ page, ctx }) => {
  ctx.savedKey = randomUUID();
  await page.goto(AppUrls.account);
  await page.locator('#rawg-key').fill(ctx.savedKey);
  await page.locator('#psn-rawg-key-save').click();
});

When('I remove my OpenCritic key', async ({ page }) => {
  await page.goto(AppUrls.account);
  await expect(page.locator('#psn-opencritic-key-remove')).toBeVisible();
  await page.locator('#psn-opencritic-key-remove').click();
});

When('I save an empty RAWG key', async ({ page, ctx }) => {
  page.on('request', (request) => {
    if (request.method() !== HttpMethods.get && new URL(request.url()).pathname === CuratorApi.meEnrichmentKeysRawg) {
      ctx.curatorRequests.push(request.method());
    }
  });
  await page.goto(AppUrls.account);
  await page.locator('#psn-rawg-key-save').click();
});

Then('I am on my account page', async ({ page }) => {
  await page.waitForURL(`**${AppUrls.account}`);
  await expect(page.locator('#psn-schedule-card')).toBeVisible();
});

Then('I am offered the PlayStation link form', async ({ page }) => {
  await expect(page.locator('#npsso')).toBeVisible();
  await expect(page.locator('#psn-link-submit')).toBeVisible();
});

Then('I am not shown as linked', async ({ page }) => {
  await expect(page.locator('#psn-linked-badge')).toHaveCount(NO_ELEMENTS);
});

Then('I am offered enrichment keys and scheduling, but no data-sharing preferences', async ({ page }) => {
  await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
  await expect(page.locator('#psn-schedule-card')).toBeVisible();
  await expect(page.locator('#pref-trophies')).toHaveCount(NO_ELEMENTS);
});

Then('I am told there is no refresh schedule yet', async ({ page }) => {
  await expect(page.locator('#schedule-none')).toBeVisible();
  await expect(page.locator('#schedule-next-run')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#schedule-cancel')).toHaveCount(NO_ELEMENTS);
});

Then('I see my refresh schedule and can cancel it', async ({ page }) => {
  await expect(page.locator('#schedule-next-run')).toBeVisible();
  await expect(page.locator('#schedule-cancel')).toBeVisible();
  await expect(page.locator('#schedule-none')).toHaveCount(NO_ELEMENTS);
});

Then('I am shown as linked, with a way to unlink', async ({ page }) => {
  await expect(page.locator('#psn-linked-badge')).toBeVisible();
  await expect(page.locator('#psn-unlink')).toBeVisible();
  await expect(page.locator('#psn-link-submit')).toHaveCount(NO_ELEMENTS);
});

Then('I am offered a way to unlink', async ({ page }) => {
  await expect(page.locator('#psn-unlink')).toBeVisible();
});

Then('I am warned there is no refresh token', async ({ page }) => {
  await expect(page.locator('#psn-no-refresh-token-warning')).toBeVisible();
});

Then('I am told there is no history yet', async ({ page }) => {
  await expect(page.locator('#psn-action-history-empty')).toBeVisible();
  await expect(page.locator('#psn-action-history-list')).toHaveCount(NO_ELEMENTS);
});

Then('it lists the link and the unlink, and the latest completed', async ({ page }) => {
  const entries = page.locator('#psn-action-history-list [id^="psn-action-history-entry-"]');
  await expect.poll(() => actionsOf(entries)).toEqual(expect.arrayContaining([AccountActions.linkRequested, AccountActions.unlinked]));
  await expect(page.locator('#psn-action-history-outcome-0')).toHaveAttribute('data-outcome', AccountActionOutcomes.completed);
});

Then('I receive the history file', ({ ctx }) => {
  expect(ctx.downloadedFileName).toBe(ACTION_HISTORY_FILE_NAME);
});

Then('I am asked to confirm, and nothing is deleted yet', async ({ page }) => {
  await expect(page.locator('#psn-delete-confirm-prompt')).toBeVisible();
  await expect(page.locator('#psn-deleted-notice')).toHaveCount(NO_ELEMENTS);
});

Then('I am told my data was deleted', async ({ page }) => {
  await expect(page.locator('#psn-deleted-notice')).toBeVisible();
});

Then('I am no longer asked to confirm', async ({ page }) => {
  await expect(page.locator('#psn-delete-confirm-prompt')).toHaveCount(NO_ELEMENTS);
});

Then('every data-sharing preference is off', async ({ page }) => {
  await expect(page.locator('#psn-linked-badge')).toBeVisible();
  for (const id of PREFERENCE_IDS) {
    await expect(page.locator(id)).not.toBeChecked();
  }
});

Then('no shared data is shown', async ({ page }) => {
  for (const id of CATEGORY_CARD_IDS) {
    await expect(page.locator(id)).toHaveCount(NO_ELEMENTS);
  }
});

Then('I see my trophy level and platinum count', async ({ page, ctx }) => {
  const card = page.locator('#psn-card-trophies');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-level', String(ctx.trophyLevel));
  await expect(card).toHaveAttribute('data-platinum', String(ctx.platinumCount));
});

Then('trophy sharing is still on and the summary is shown', async ({ page }) => {
  await expect(page.locator('#pref-trophies')).toBeChecked();
  await expect(page.locator('#psn-card-trophies')).toBeVisible();
});

Then('friend requests are allowed and chat messages are not', async ({ page }) => {
  await expect(page.locator('#pref-friend-writes')).toBeChecked();
  await expect(page.locator('#pref-chat-writes')).not.toBeChecked();
});

Then('chat messages are allowed', async ({ page }) => {
  await expect(page.locator('#pref-chat-writes')).toBeChecked();
});

Then('I see my identity card with my online id', async ({ page, ctx }) => {
  const card = page.locator('#psn-card-identity');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-online-id', ctx.onlineId);
});

Then('my identity card is hidden', async ({ page }) => {
  await expect(page.locator('#psn-card-identity')).not.toBeVisible();
});

Then('identity sharing is still off and no identity card is shown', async ({ page }) => {
  await expect(page.locator('#pref-identity')).not.toBeChecked();
  await expect(page.locator('#psn-card-identity')).toHaveCount(NO_ELEMENTS);
});

Then('I see the friend request from its sender', async ({ page, ctx }) => {
  await expect(page.locator('#friend-requests')).toBeVisible();
  await expect(page.locator('#friend-request-0')).toHaveAttribute('data-online-id', ctx.onlineId);
});

Then('I am told it was accepted and have no requests left', async ({ page, ctx }) => {
  await expect(page.locator('#friend-request-accepted')).toHaveAttribute('data-online-id', ctx.onlineId);
  await expect(page.locator('#friend-requests-empty')).toBeVisible();
});

Then('I am shown as linked', async ({ page }) => {
  await expect(page.locator('#psn-linked-badge')).toBeVisible();
});

Then('I see no friend requests', async ({ page }) => {
  await expect(page.locator('#friend-requests')).toHaveCount(NO_ELEMENTS);
});

Then('I cannot accept the request, and I am told what would allow it', async ({ page }) => {
  await expect(page.locator('#friend-request-accept-0')).toBeDisabled();
  await expect(page.locator('#friend-requests-consent')).toBeVisible();
});

Then('I am told every data-sharing preference is still off', async ({ page }) => {
  const card = page.locator('#psn-link-success');
  await expect(card).toBeVisible();
  for (const id of LINK_SUCCESS_IDS) {
    await expect(card.locator(id)).toHaveAttribute('data-enabled', String(false));
  }
});

Then('I am offered where to turn trophies on', async ({ page }) => {
  await expect(page.locator('#psn-link-success-trophies a')).toHaveAttribute('href', `${AppUrls.account}#pref-trophies`);
});

Then('I am offered to save a RAWG key and an OpenCritic key, and to remove neither', async ({ page }) => {
  await expect(page.locator('#rawg-key')).toBeVisible();
  await expect(page.locator('#opencritic-key')).toBeVisible();
  await expect(page.locator('#psn-rawg-key-save')).toBeVisible();
  await expect(page.locator('#psn-opencritic-key-save')).toBeVisible();
  await expect(page.locator('#psn-rawg-key-remove')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#psn-opencritic-key-remove')).toHaveCount(NO_ELEMENTS);
});

Then('my RAWG key is set and the OpenCritic key is still offered', async ({ page }) => {
  await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
  await expect(page.locator('#opencritic-key')).toBeVisible();
});

Then('my RAWG key is set', async ({ page }) => {
  await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
});

Then('the key appears nowhere on the page', async ({ page, ctx }) => {
  await expect(page.locator('body')).not.toContainText(ctx.savedKey);
});

Then('I am offered to save an OpenCritic key', async ({ page }) => {
  await expect(page.locator('#opencritic-key')).toBeVisible();
});

Then('I am told the key is required', async ({ page }) => {
  await expect(page.locator('#psn-rawg-key-error')).toBeVisible();
});

Then('no RAWG key was sent', ({ ctx }) => {
  expect(ctx.curatorRequests, 'an empty key was sent to Curator instead of being refused in the page').toEqual([]);
});
