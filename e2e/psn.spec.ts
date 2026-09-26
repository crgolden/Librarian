import { randomUUID } from 'node:crypto';

import type { Locator, Page } from '@playwright/test';

import { lowercaseToken, newText } from '@crgolden/modules/testing';
import { test, expect, DEFAULT_E2E_SUB, newFutureInstant, newTrophySummary } from './fixtures.js';
import { AppUrls } from '../src/app/app-paths';
import { CuratorApi } from '../src/curator/curator-api';
import { ACTION_HISTORY_FILE_NAME, NPSSO_LENGTH } from '../src/psn/psn-settings.messages';
import { AccountActionOutcomes, RefreshCadences } from '../src/curator/curator.models';
import { AccountActions } from './mocks/curator-constants';
import { waitForDownload } from './playwright-events';
import { BffPaths } from '../src/shared/bff-contract';
import { HttpMethods } from '../src/bff/http-headers';

const VALID_NPSSO = lowercaseToken(NPSSO_LENGTH);

function actionsOf(entries: Locator): Promise<(string | null)[]> {
  return entries.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-action')));
}

function trackRawgKeyWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== HttpMethods.get && new URL(request.url()).pathname === CuratorApi.meEnrichmentKeysRawg) {
      writes.push(request.method());
    }
  });
  return writes;
}

const SCHEDULE_NEXT_RUN_AT = newFutureInstant();

const CATEGORY_CARD_IDS = ['#psn-card-trophies', '#psn-card-identity', '#psn-card-presence', '#psn-card-devices'];

async function expectNoCategoryCards(page: Page): Promise<void> {
  for (const id of CATEGORY_CARD_IDS) {
    await expect(page.locator(id)).toHaveCount(0);
  }
}

test.describe('PSN settings — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('PSN settings — legacy /psn bookmarks', () => {
  test('an existing /psn bookmark lands on /account', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.psn);

    await page.waitForURL(`**${AppUrls.account}`);
    await expect(page.locator('#psn-schedule-card')).toBeVisible();
  });

  test('an anonymous /psn bookmark still reaches login rather than a dead route', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.psn);

    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('PSN settings — authenticated', () => {
  test('shows the link form when no PSN account is linked', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await expect(page.locator('#npsso')).toBeVisible();
    await expect(page.locator('#psn-link-submit')).toBeVisible();
    await expect(page.locator('#psn-linked-badge')).toHaveCount(0);
  });

  test('offers enrichment keys and scheduling with no PSN account linked', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-link-submit')).toBeVisible();
    await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
    await expect(page.locator('#psn-schedule-card')).toBeVisible();
    await expect(page.locator('#pref-trophies')).toHaveCount(0);
  });

  test('says there is no schedule yet rather than rendering an empty card', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.account);

    await expect(page.locator('#schedule-none')).toBeVisible();
    await expect(page.locator('#schedule-next-run')).toHaveCount(0);
    await expect(page.locator('#schedule-cancel')).toHaveCount(0);
  });

  test('shows the stored schedule instead of the no-schedule line once one exists', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
      cadence: RefreshCadences.daily,
      next_run_at: SCHEDULE_NEXT_RUN_AT,
    });

    await page.goto(AppUrls.account);

    await expect(page.locator('#schedule-next-run')).toBeVisible();
    await expect(page.locator('#schedule-cancel')).toBeVisible();
    await expect(page.locator('#schedule-none')).toHaveCount(0);
  });

  test('keeps enrichment keys and scheduling visible after unlinking and reloading', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible();

    await page.reload();

    await expect(page.locator('#psn-link-submit')).toBeVisible();
    await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
    await expect(page.locator('#psn-schedule-card')).toBeVisible();
    await expect(page.locator('#pref-trophies')).toHaveCount(0);
  });

  test('shows linked status and an unlink button when a PSN account is linked', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-linked-badge')).toBeVisible();
    await expect(page.locator('#psn-unlink')).toBeVisible();
    await expect(page.locator('#psn-link-submit')).toHaveCount(0);
  });

  test('linking submits the NPSSO token and shows the linked state', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();
    await expect(page.locator('#psn-unlink')).toBeVisible();
  });

  test('shows a no-refresh-token warning when PSN issued no refresh token', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink({ refresh_token_expires_at: null });

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-linked-badge')).toBeVisible();
    await expect(page.locator('#psn-unlink')).toBeVisible();
    await expect(page.locator('#psn-no-refresh-token-warning')).toBeVisible();
  });

  test('unlinking removes the PSN link and shows the link form again', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible();
  });
});

test.describe('PSN settings — action history', () => {
  test('shows a message when there is no history yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await page.locator('#psn-action-history-load').click();
    await expect(page.locator('#psn-action-history-empty')).toBeVisible();
    await expect(page.locator('#psn-action-history-list')).toHaveCount(0);
  });

  test('shows recorded actions after linking and unlinking, and offers a download button', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();
    await expect(page.locator('#psn-unlink')).toBeVisible();

    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible();

    await page.locator('#psn-action-history-load').click();
    const historyEntries = page.locator('#psn-action-history-list [id^="psn-action-history-entry-"]');
    await expect
      .poll(() => actionsOf(historyEntries))
      .toEqual(expect.arrayContaining([AccountActions.linkRequested, AccountActions.unlinked]));
    await expect(page.locator('#psn-action-history-outcome-0')).toHaveAttribute(
      'data-outcome',
      AccountActionOutcomes.completed,
    );

    const [download] = await Promise.all([
      waitForDownload(page),
      page.locator('#psn-action-history-download').click(),
    ]);
    expect(download.suggestedFilename()).toBe(ACTION_HISTORY_FILE_NAME);
  });
});

test.describe('PSN settings — delete my data', () => {
  test('requires confirmation, then deletes the account and shows a confirmation message', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await page.locator('#psn-delete-request').click();
    await expect(page.locator('#psn-delete-confirm-prompt')).toBeVisible();
    await expect(page.locator('#psn-deleted-notice')).toHaveCount(0);

    await page.locator('#psn-delete-confirm').click();
    await expect(page.locator('#psn-deleted-notice')).toBeVisible();
  });

  test('cancelling the confirmation makes no request and leaves the account intact', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await page.locator('#psn-delete-request').click();
    await page.locator('#psn-delete-cancel').click();

    await expect(page.locator('#psn-delete-confirm-prompt')).toHaveCount(0);
    await expect(page.locator('#psn-linked-badge')).toBeVisible();
  });
});

test.describe('PSN settings — data-sharing preferences', () => {
  test('all toggles are off by default and no category cards render after linking', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-linked-badge')).toBeVisible();
    await expect(page.locator('#pref-trophies')).not.toBeChecked();
    await expect(page.locator('#pref-identity')).not.toBeChecked();
    await expect(page.locator('#pref-presence')).not.toBeChecked();
    await expect(page.locator('#pref-devices')).not.toBeChecked();

    await expectNoCategoryCards(page);
  });

  test('toggling trophies on shows the summary card and persists across reload', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    const trophySummary = newTrophySummary();
    await store.seedUserPsnProfile(DEFAULT_E2E_SUB, { trophy_summary: trophySummary });

    await page.goto(AppUrls.account);
    await page.locator('#pref-trophies').check();

    const card = page.locator('#psn-card-trophies');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-level', String(trophySummary.level));
    await expect(card).toHaveAttribute('data-platinum', String(trophySummary.earned.platinum));

    await page.reload();
    await expect(page.locator('#pref-trophies')).toBeChecked();
    await expect(page.locator('#psn-card-trophies')).toBeVisible();
  });

  test('the two write-consent toggles are off by default and persist independently', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await expect(page.locator('#pref-friend-writes')).not.toBeChecked();
    await expect(page.locator('#pref-chat-writes')).not.toBeChecked();

    await page.locator('#pref-friend-writes').check();
    await page.reload();

    await expect(page.locator('#pref-friend-writes')).toBeChecked();
    await expect(page.locator('#pref-chat-writes')).not.toBeChecked();
  });

  test('granting a write consent renders no category card, unlike the read preferences', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await page.locator('#pref-chat-writes').check();

    await expect(page.locator('#pref-chat-writes')).toBeChecked();
    await expectNoCategoryCards(page);
  });

  test('toggling a category off hides its card immediately', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true });
    const onlineId = newText();
    await store.seedUserPsnProfile(DEFAULT_E2E_SUB, { online_id: onlineId });

    await page.goto(AppUrls.account);
    const card = page.locator('#psn-card-identity');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-online-id', onlineId);

    await page.locator('#pref-identity').uncheck();
    await expect(card).not.toBeVisible();

    await page.reload();
    await expect(page.locator('#pref-identity')).not.toBeChecked();
    await expect(page.locator('#psn-card-identity')).toHaveCount(0);
  });
});

test.describe('PSN settings — friend requests', () => {
  test('lists a received request once identity sharing is on, and accepting it clears the request', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: true });
    const requesterOnlineId = randomUUID();
    await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: requesterOnlineId, account_id: randomUUID() }]);

    await page.goto(AppUrls.account);

    await expect(page.locator('#friend-requests')).toBeVisible();
    await expect(page.locator('#friend-request-0')).toHaveAttribute('data-online-id', requesterOnlineId);

    await page.locator('#friend-request-accept-0').click();

    await expect(page.locator('#friend-request-accepted')).toHaveAttribute('data-online-id', requesterOnlineId);
    await expect(page.locator('#friend-requests-empty')).toBeVisible();
  });

  test('shows no friend-request list at all while identity sharing is off', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: newText(), account_id: randomUUID() }]);

    await page.goto(AppUrls.account);

    await expect(page.locator('#psn-linked-badge')).toBeVisible();
    await expect(page.locator('#friend-requests')).toHaveCount(0);
  });

  test('withholds accepting until the friend-writes consent is given', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true, allow_friend_writes: false });
    await store.seedUserFriendRequests(DEFAULT_E2E_SUB, [{ online_id: newText(), account_id: randomUUID() }]);

    await page.goto(AppUrls.account);

    await expect(page.locator('#friend-request-accept-0')).toBeDisabled();
    await expect(page.locator('#friend-requests-consent')).toBeVisible();
  });
});

test.describe('PSN settings — what linking does and does not switch on', () => {
  test('the post-link card states that every harvest is still off, and where each is turned on', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.account);
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();

    const card = page.locator('#psn-link-success');
    await expect(card).toBeVisible();
    await expect(card.locator('#psn-link-success-trophies')).toHaveAttribute('data-enabled', String(false));
    await expect(card.locator('#psn-link-success-identity')).toHaveAttribute('data-enabled', String(false));
    await expect(card.locator('#psn-link-success-presence')).toHaveAttribute('data-enabled', String(false));
    await expect(card.locator('#psn-link-success-devices')).toHaveAttribute('data-enabled', String(false));
    await expect(card.locator('#psn-link-success-trophies a')).toHaveAttribute('href', `${AppUrls.account}#pref-trophies`);
  });
});

test.describe('PSN settings — enrichment API keys', () => {
  test('both providers show as not configured by default, each with its own input', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await expect(page.locator('#rawg-key')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
    await expect(page.locator('#psn-rawg-key-save')).toBeVisible();
    await expect(page.locator('#psn-opencritic-key-save')).toBeVisible();
    await expect(page.locator('#psn-rawg-key-remove')).toHaveCount(0);
    await expect(page.locator('#psn-opencritic-key-remove')).toHaveCount(0);
  });

  test('saving a RAWG key shows the configured state and persists across reload, independent of OpenCritic', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    await page.locator('#rawg-key').fill(newText());
    await page.locator('#psn-rawg-key-save').click();

    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();

    await page.reload();
    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
  });

  test('the key value is never present in the page after saving', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto(AppUrls.account);
    const savedRawgKey = randomUUID();
    await page.locator('#rawg-key').fill(savedRawgKey);
    await page.locator('#psn-rawg-key-save').click();
    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();

    await expect(page.locator('body')).not.toContainText(savedRawgKey);
  });

  test('removing a configured key reverts to the input form', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedEnrichmentKeys({ opencritic_configured: true });

    await page.goto(AppUrls.account);
    await expect(page.locator('#psn-opencritic-key-remove')).toBeVisible();

    await page.locator('#psn-opencritic-key-remove').click();
    await expect(page.locator('#opencritic-key')).toBeVisible();
  });

  test('saving an empty key shows a validation error and makes no request', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    const rawgKeyWrites = trackRawgKeyWrites(page);

    await page.goto(AppUrls.account);
    await page.locator('#psn-rawg-key-save').click();
    await expect(page.locator('#psn-rawg-key-error')).toBeVisible();
    expect(rawgKeyWrites, 'an empty key was sent to Curator instead of being refused in the page').toEqual([]);
  });
});
