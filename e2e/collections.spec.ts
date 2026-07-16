/**
 * Collections page E2E — auth guard redirect, and the create -> preview -> save -> run -> install
 * toggle flow against the mock Curator API.
 */

import { test, expect } from './fixtures.js';

test.describe('Collections — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/collections');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Collections — authenticated', () => {
  test('shows an empty state when no collections are saved', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/collections');
    await expect(page.locator('h1')).toContainText('Collections');
    await expect(page.locator("text=haven't saved any collections")).toBeVisible();
  });

  test('creating a filter_list collection: preview, save, then it appears in the list', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.getByRole('button', { name: 'New collection' }).click();
    await page.getByLabel('Genres (comma-separated)').fill('RPG');
    await page.getByRole('button', { name: 'Preview' }).click();

    await expect(page.getByText('Bloodborne', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Name this collection').fill('RPG picks');
    await page.getByRole('button', { name: 'Save this collection' }).click();

    await expect(page.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });
  });

  test('capacity_fill preview without a console shows a client-side validation error', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/collections');
    await page.getByRole('button', { name: 'New collection' }).click();
    await page.getByLabel('Kind').selectOption('capacity_fill');
    await page.getByRole('button', { name: 'Preview' }).click();

    await expect(page.locator('text=A console is required for a capacity-fill collection.')).toBeVisible();
  });

  test('running a saved capacity_fill collection and toggling install state (known console)', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedConsoles(['console-1']);
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.getByRole('button', { name: 'New collection' }).click();
    await page.getByLabel('Kind').selectOption('capacity_fill');
    await page.getByLabel('Console ID').fill('console-1');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('Bloodborne', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Name this collection').fill('Console pack');
    await page.getByRole('button', { name: 'Save this collection' }).click();
    await expect(page.locator('text=Console pack')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'View / Run' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('button', { name: 'Mark installed' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Mark installed' }).click();
    await expect(page.getByRole('button', { name: 'Installed' })).toBeVisible({ timeout: 10_000 });
  });

  test('toggling install state after a console loses ownership shows an inline 404 message', async ({
    authedPage: page,
    store,
  }) => {
    // The real Curator API validates console ownership both when generating a capacity_fill run
    // (400 if unowned) and again on the install-toggle PUT (404 if unowned) — the only way to reach
    // the toggle's 404 is for ownership to change *after* a run already succeeded, so this seeds the
    // console, runs successfully, then revokes ownership before toggling.
    await store.reset();
    await store.seedConsoles(['console-1']);
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.getByRole('button', { name: 'New collection' }).click();
    await page.getByLabel('Kind').selectOption('capacity_fill');
    await page.getByLabel('Console ID').fill('console-1');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('Bloodborne', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Name this collection').fill('Console pack');
    await page.getByRole('button', { name: 'Save this collection' }).click();
    await expect(page.locator('text=Console pack')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'View / Run' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('button', { name: 'Mark installed' })).toBeVisible({ timeout: 10_000 });

    await store.seedConsoles([]);
    await page.getByRole('button', { name: 'Mark installed' }).click();

    await expect(page.locator("text=Console 'console-1' not found")).toBeVisible({ timeout: 10_000 });
  });
});
