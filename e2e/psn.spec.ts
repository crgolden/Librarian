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
