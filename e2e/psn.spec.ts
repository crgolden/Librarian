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
