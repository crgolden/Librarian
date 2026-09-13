
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


    await page.locator('#consoles-add-console').click();
    await page.locator('#consoleName').fill('Living room PS5');
    await page.locator('#consolePlatform').selectOption('PS5');

    await page.locator('#console-create-submit').click();

    await expect(page.locator('#console-name-0')).toHaveText('Living room PS5', { timeout: 10_000 });
    await expect(page.locator('text=We guessed')).toBeVisible();
  });

  test('reports a stale PSN device link in words, and offers the page that manages it', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedConsoles(['console-a']);
    await store.seedConsoleDeviceLink('console-a', { state: 'device_deactivated' });

    await page.goto('/consoles');

    await expect(page.locator('#console-device-link-0')).toContainText('deactivated');
    await expect(page.locator('#console-device-link-0')).not.toContainText('device_deactivated');
    await expect(page.locator('#console-device-link-account-0')).toHaveAttribute('href', '/account');
  });

  test('says nothing about a device link on a console that has none', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedConsoles(['console-a']);

    await page.goto('/consoles');

    await expect(page.locator('#console-name-0')).toBeVisible();
    await expect(page.locator('#console-device-link-0')).toHaveCount(0);
  });

  test('creates a storage device and attaches it to a console', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/consoles');
    await page.locator('#consoles-add-console').click();
    await page.locator('#consoleName').fill('Living room PS5');
    await page.locator('#consolePlatform').selectOption('PS5');
    await page.locator('#console-create-submit').click();
    await expect(page.locator('#console-name-0')).toHaveText('Living room PS5', { timeout: 10_000 });

    await page.locator('#consoles-add-device').click();
    await page.locator('#deviceName').fill('Travel SSD');
    await page.locator('#deviceKind').selectOption('m2');
    await page.locator('#deviceCapacityGb').fill('1000');
    await page.locator('#device-create-submit').click();
    await expect(page.locator('text=Travel SSD')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Not attached')).toBeVisible();

    await page.locator('#device-attach-0').click();
    await page.locator('select[name="attachTarget"]').selectOption({ label: 'Living room PS5' });
    await page.locator('#device-attach-confirm-0').click();
    await expect(page.locator('text=Attached to Living room PS5')).toBeVisible({ timeout: 10_000 });

    await page.locator('#device-detach-0').click();
    await expect(page.locator('text=Not attached')).toBeVisible({ timeout: 10_000 });
  });
});
