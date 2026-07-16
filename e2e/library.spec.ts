/**
 * Library page E2E — auth guard redirect, and refresh-trigger + poll-to-terminal-status against
 * the mock Curator API (which transitions queued -> running -> a configurable terminal outcome
 * on short timers).
 */

import { test, expect } from './fixtures.js';

test.describe('Library — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Library — authenticated', () => {
  test('refreshing resolves to a success message', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.locator('h1')).toContainText('My Library');
    await page.getByRole('button', { name: 'Refresh library' }).click();

    await expect(page.locator('text=Library catalogued.')).toBeVisible({ timeout: 10_000 });
  });

  test('refreshing surfaces the job error on a failed run', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.setLibraryRefreshOutcome('failed', 'PSN entitlement fetch failed.');

    await page.goto('/library');
    await page.getByRole('button', { name: 'Refresh library' }).click();

    await expect(page.locator('text=PSN entitlement fetch failed.')).toBeVisible({ timeout: 10_000 });
  });
});
