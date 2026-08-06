/**
 * Consoles & Storage page E2E — console/storage-device CRUD, attach/detach, and the auto-assigned
 * default-capacity flag, against the mock Curator API.
 */

import { test, expect } from './fixtures.js';

test.describe('Consoles & Storage — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page }) => {
    await page.goto('/consoles');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Consoles & Storage — authenticated', () => {
  test('shows empty states, then creates a console with an auto-assigned default capacity', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/consoles');
    await expect(page.locator('text=No consoles yet.')).toBeVisible();
    await expect(page.locator('text=No storage devices yet.')).toBeVisible();

    // "Add console" toggles from an open-the-form button to the form's own submit button (mutually
    // exclusive via @if/@else in the template) -- re-querying the same role/name locator after the
    // form appears resolves to the submit button, since the toggle button is gone by then.
    await page.getByRole('button', { name: 'Add console' }).click();
    await page.getByLabel('Name').fill('Living room PS5');
    await page.getByLabel('Platform', { exact: true }).selectOption('PS5');
    // Capacity left blank -- auto-assigned from the platform default.
    await page.getByRole('button', { name: 'Add console' }).click();

    await expect(page.getByText('Living room PS5', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=We guessed')).toBeVisible();
  });

  test('creates a storage device and attaches it to a console', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/consoles');
    await page.getByRole('button', { name: 'Add console' }).click();
    await page.getByLabel('Name').fill('Living room PS5');
    await page.getByLabel('Platform', { exact: true }).selectOption('PS5');
    await page.getByRole('button', { name: 'Add console' }).click();
    await expect(page.getByText('Living room PS5', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Add storage device' }).click();
    await page.getByLabel('Name').fill('Travel SSD');
    await page.getByLabel('Kind').selectOption('m2');
    await page.getByLabel('Capacity in GB').fill('1000');
    await page.getByRole('button', { name: 'Add storage device' }).click();
    await expect(page.locator('text=Travel SSD')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Not attached')).toBeVisible();

    await page.getByRole('button', { name: 'Attach' }).click();
    await page.locator('select[name="attachTarget"]').selectOption({ label: 'Living room PS5' });
    await page.getByRole('button', { name: 'Attach' }).click();
    await expect(page.locator('text=Attached to Living room PS5')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Detach' }).click();
    await expect(page.locator('text=Not attached')).toBeVisible({ timeout: 10_000 });
  });
});
