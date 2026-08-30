import type { Page } from '@playwright/test';

import { test, expect } from './fixtures.js';

const VALID_NPSSO = 'a'.repeat(64);

const CATEGORY_CARD_IDS = ['#psn-card-trophies', '#psn-card-identity', '#psn-card-presence', '#psn-card-devices'];

async function expectNoCategoryCards(page: Page): Promise<void> {
  for (const id of CATEGORY_CARD_IDS) {
    await expect(page.locator(id)).toHaveCount(0);
  }
}

test.describe('PSN settings — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/account');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('PSN settings — legacy /psn bookmarks', () => {
  test('an existing /psn bookmark lands on /account', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/psn');

    await page.waitForURL('**/account', { timeout: 10_000 });
    await expect(page.locator('#page-title')).toContainText('Account');
  });

  test('an anonymous /psn bookmark still reaches login rather than a dead route', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/psn');

    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('PSN settings — authenticated', () => {
  test('shows the link form when no PSN account is linked', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/account');
    await expect(page.locator('#page-title')).toContainText('Account');
    await expect(page.locator('#npsso')).toBeVisible();
    await expect(page.locator('#psn-link-submit')).toHaveText('Link account');
  });

  test('offers enrichment keys and scheduling with no PSN account linked', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/account');
    await expect(page.locator('#psn-link-submit')).toBeVisible();
    await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
    await expect(page.locator('#psn-schedule-card')).toBeVisible();
    await expect(page.locator('#pref-trophies')).toHaveCount(0);
  });

  test('keeps enrichment keys and scheduling visible after unlinking and reloading', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await expect(page.locator('#psn-enrichment-keys-card')).toBeVisible();
    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible({ timeout: 10_000 });

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

    await page.goto('/account');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
    await expect(page.locator('#psn-unlink')).toHaveText('Unlink');
  });

  test('linking submits the NPSSO token and shows the linked state', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/account');
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();
    await expect(page.locator('#psn-unlink')).toBeVisible({ timeout: 10_000 });
  });

  test('shows a no-refresh-token warning when PSN issued no refresh token', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink({ refresh_token_expires_at: null });

    await page.goto('/account');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
    await expect(page.locator('#psn-unlink')).toBeVisible();
    await expect(page.locator('#psn-no-refresh-token-warning')).toContainText(
      "PSN didn't issue a renewable session",
    );
  });

  test('unlinking removes the PSN link and shows the link form again', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('PSN settings — action history', () => {
  test('shows a message when there is no history yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/account');
    await page.locator('#psn-action-history-load').click();
    await expect(page.locator('#psn-action-history-empty')).toHaveText('No actions recorded yet.');
  });

  test('shows recorded actions after linking and unlinking, and offers a download button', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/account');
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();
    await expect(page.locator('#psn-unlink')).toBeVisible({ timeout: 10_000 });

    await page.locator('#psn-unlink').click();
    await expect(page.locator('#psn-link-submit')).toBeVisible({ timeout: 10_000 });

    await page.locator('#psn-action-history-load').click();
    const historyList = page.locator('#psn-action-history-list');
    await expect(historyList).toContainText('link_succeeded');
    await expect(historyList).toContainText('unlinked');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#psn-action-history-download').click(),
    ]);
    expect(download.suggestedFilename()).toBe('librarian-account-history.json');
  });
});

test.describe('PSN settings — delete my data', () => {
  test('requires confirmation, then deletes the account and shows a confirmation message', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#psn-delete-request').click();
    await expect(page.locator('#psn-delete-confirm-prompt')).toContainText('Are you sure?');

    await page.locator('#psn-delete-confirm').click();
    await expect(page.locator('#psn-deleted-notice')).toContainText(
      'Your account and all associated data have been deleted.',
      { timeout: 10_000 },
    );
  });

  test('cancelling the confirmation makes no request and leaves the account intact', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#psn-delete-request').click();
    await page.locator('#psn-delete-cancel').click();

    await expect(page.locator('#psn-delete-confirm-prompt')).toHaveCount(0);
    await expect(page.locator('text=PSN account linked')).toBeVisible();
  });
});

test.describe('PSN settings — data-sharing preferences', () => {
  test('all toggles are off by default and no category cards render after linking', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
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

    await page.goto('/account');
    await page.locator('#pref-trophies').check();

    const card = page.locator('#psn-card-trophies');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Level 42');
    await expect(card).toContainText('3 platinum');

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

    await page.goto('/account');
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

    await page.goto('/account');
    await page.locator('#pref-chat-writes').check();

    await expect(page.locator('#pref-chat-writes')).toBeChecked();
    await expectNoCategoryCards(page);
  });

  test('toggling a category off hides its card immediately', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true });

    await page.goto('/account');
    const card = page.locator('#psn-card-identity');
    await expect(card).toBeVisible();
    await expect(card).toContainText('e2e_gamer');

    await page.locator('#pref-identity').uncheck();
    await expect(card).not.toBeVisible();

    await page.reload();
    await expect(page.locator('#pref-identity')).not.toBeChecked();
    await expect(page.locator('#psn-card-identity')).toHaveCount(0);
  });
});

test.describe('PSN settings — enrichment API keys', () => {
  test('both providers show as not configured by default, each with its own input', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await expect(page.locator('#rawg-key')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
    await expect(page.locator('#psn-rawg-key-save')).toHaveText('Save RAWG key');
    await expect(page.locator('#psn-opencritic-key-save')).toHaveText('Save OpenCritic key');
  });

  test('saving a RAWG key shows the configured state and persists across reload, independent of OpenCritic', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#rawg-key').fill('fake-rawg-key');
    await page.locator('#psn-rawg-key-save').click();

    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#opencritic-key')).toBeVisible();

    await page.reload();
    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
  });

  test('the key value is never present in the page after saving', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#rawg-key').fill('super-secret-key-value');
    await page.locator('#psn-rawg-key-save').click();
    await expect(page.locator('#psn-rawg-key-remove')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('body')).not.toContainText('super-secret-key-value');
  });

  test('removing a configured key reverts to the input form', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedEnrichmentKeys({ opencritic_configured: true });

    await page.goto('/account');
    await expect(page.locator('#psn-opencritic-key-remove')).toBeVisible();

    await page.locator('#psn-opencritic-key-remove').click();
    await expect(page.locator('#opencritic-key')).toBeVisible({ timeout: 10_000 });
  });

  test('saving an empty key shows a validation error and makes no request', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/account');
    await page.locator('#psn-rawg-key-save').click();
    await expect(page.locator('#psn-rawg-key-error')).toHaveText('Enter a RAWG API key.');
  });
});
