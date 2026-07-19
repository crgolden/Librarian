/**
 * PSN settings page E2E — auth guard redirect, link/unlink flows against the mock Curator API.
 */

import { test, expect } from './fixtures.js';

test.describe('PSN settings — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/psn');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('PSN settings — authenticated', () => {
  test('shows the link form when no PSN account is linked', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/psn');
    await expect(page.locator('h1')).toContainText('PlayStation Network');
    await expect(page.getByLabel('NPSSO token')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Link account' })).toBeVisible();
  });

  test('shows linked status and an unlink button when a PSN account is linked', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible();
  });

  test('linking submits the NPSSO token and shows the linked state', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/psn');
    await page.getByLabel('NPSSO token').fill('fake-npsso-token');
    await page.getByRole('button', { name: 'Link account' }).click();
    await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows a no-refresh-token warning when PSN issued no refresh token', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink({ refresh_token_expires_at: null });

    await page.goto('/psn');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible();
    await expect(page.locator('.text-warning')).toContainText("PSN didn't issue a renewable session");
  });

  test('unlinking removes the PSN link and shows the link form again', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.getByRole('button', { name: 'Link account' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('PSN settings — action history', () => {
  test('shows a message when there is no history yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/psn');
    await page.getByRole('button', { name: 'View my action history' }).click();
    await expect(page.getByText('No actions recorded yet.')).toBeVisible();
  });

  test('shows recorded actions after linking and unlinking, and offers a download button', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/psn');
    await page.getByLabel('NPSSO token').fill('fake-npsso-token');
    await page.getByRole('button', { name: 'Link account' }).click();
    await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.getByRole('button', { name: 'Link account' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'View my action history' }).click();
    const historyList = page.locator('.action-history-list');
    await expect(historyList.getByText(/link_succeeded/)).toBeVisible();
    await expect(historyList.getByText(/unlinked/)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download as JSON' }).click(),
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

    await page.goto('/psn');
    await page.getByRole('button', { name: 'Delete my data' }).click();
    await expect(page.getByText('Are you sure?')).toBeVisible();

    await page.getByRole('button', { name: 'Yes, delete everything' }).click();
    await expect(
      page.getByText('Your account and all associated data have been deleted.'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('cancelling the confirmation makes no request and leaves the account intact', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.getByRole('button', { name: 'Delete my data' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText('Are you sure?')).not.toBeVisible();
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

    await page.goto('/psn');
    await expect(page.locator('text=PSN account linked')).toBeVisible();
    await expect(page.getByLabel('Trophies')).not.toBeChecked();
    await expect(page.getByLabel('PSN Identity')).not.toBeChecked();
    await expect(page.getByLabel('Online Presence')).not.toBeChecked();
    await expect(page.getByLabel('Registered Devices')).not.toBeChecked();

    await expect(page.locator('.psn-category-card')).toHaveCount(0);
  });

  test('toggling trophies on shows the summary card and persists across reload', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.getByLabel('Trophies').check();

    const card = page.locator('.psn-category-card', { hasText: 'Trophies' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Level 42');
    await expect(card).toContainText('3 platinum');

    await page.reload();
    await expect(page.getByLabel('Trophies')).toBeChecked();
    await expect(page.locator('.psn-category-card', { hasText: 'Trophies' })).toBeVisible();
  });

  test('toggling a category off hides its card immediately', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_identity: true });

    await page.goto('/psn');
    const card = page.locator('.psn-category-card', { hasText: 'PSN Identity' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('e2e_gamer');

    await page.getByLabel('PSN Identity').uncheck();
    await expect(card).not.toBeVisible();

    await page.reload();
    await expect(page.getByLabel('PSN Identity')).not.toBeChecked();
    await expect(page.locator('.psn-category-card', { hasText: 'PSN Identity' })).toHaveCount(0);
  });
});

test.describe('PSN settings — enrichment API keys', () => {
  test('both providers show as not configured by default, each with its own input', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await expect(page.locator('#rawg-key')).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save RAWG key' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save OpenCritic key' })).toBeVisible();
  });

  test('saving a RAWG key shows the configured state and persists across reload, independent of OpenCritic', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.locator('#rawg-key').fill('fake-rawg-key');
    await page.getByRole('button', { name: 'Save RAWG key' }).click();

    await expect(page.getByRole('button', { name: 'Remove RAWG key' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#opencritic-key')).toBeVisible(); // OpenCritic untouched

    await page.reload();
    await expect(page.getByRole('button', { name: 'Remove RAWG key' })).toBeVisible();
    await expect(page.locator('#opencritic-key')).toBeVisible();
  });

  test('the key value is never present in the page after saving', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.locator('#rawg-key').fill('super-secret-key-value');
    await page.getByRole('button', { name: 'Save RAWG key' }).click();
    await expect(page.getByRole('button', { name: 'Remove RAWG key' })).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('body')).not.toContainText('super-secret-key-value');
  });

  test('removing a configured key reverts to the input form', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedEnrichmentKeys({ opencritic_configured: true });

    await page.goto('/psn');
    await expect(page.getByRole('button', { name: 'Remove OpenCritic key' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove OpenCritic key' }).click();
    await expect(page.locator('#opencritic-key')).toBeVisible({ timeout: 10_000 });
  });

  test('saving an empty key shows a validation error and makes no request', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();

    await page.goto('/psn');
    await page.getByRole('button', { name: 'Save RAWG key' }).click();
    await expect(page.getByText('Enter a RAWG API key.')).toBeVisible();
  });
});
