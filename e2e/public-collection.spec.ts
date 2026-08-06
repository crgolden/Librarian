/**
 * Public collection share page (`/c/:slug`) E2E — the one anonymous route in the app. Covers the
 * two-account journey the product exists for: an owner publishes a collection and shares its link;
 * an anonymous visitor can open it with no account at all; a second signed-in user can follow it
 * from the share page and see it in "Collections I follow"; and setting visibility back to private
 * breaks the old link immediately.
 */

import { test, expect } from './fixtures.js';

async function createAndPublishCollection(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/collections');
  await page.getByRole('button', { name: 'New collection' }).click();
  await page.getByLabel('Genres (comma-separated)').fill('RPG');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Bloodborne', { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Name this collection').fill('RPG picks');
  await page.getByRole('button', { name: 'Save this collection' }).click();
  await expect(page.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'View / Edit' }).click();
  await page.getByLabel('Visibility').selectOption('unlisted');
  await expect(page.locator('.share-url')).toContainText('/c/', { timeout: 10_000 });

  const shareUrl = (await page.locator('.share-url').textContent()) ?? '';
  const match = shareUrl.match(/\/c\/[a-zA-Z0-9_-]+/);
  if (!match) {
    throw new Error(`Could not parse a share path out of "${shareUrl}"`);
  }
  return match[0];
}

test.describe('Public collection share page', () => {
  test('an anonymous visitor can open an unlisted collection and see its games with no account', async ({
    authedPage: owner,
    secondAnonymousPage: visitor,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const sharePath = await createAndPublishCollection(owner);

    await visitor.goto(sharePath);
    await expect(visitor.locator('h1')).toContainText('RPG picks');
    await expect(visitor.getByText('Bloodborne', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(visitor.getByRole('link', { name: 'Sign in to follow this collection' })).toBeVisible();
  });

  test('a second signed-in user can follow a shared collection and see it in "Collections I follow"', async ({
    authedPage: owner,
    secondAuthedPage: follower,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const sharePath = await createAndPublishCollection(owner);

    await follower.goto(sharePath);
    const followButton = follower.getByRole('button', { name: 'Follow this collection' });
    await expect(followButton).toBeVisible({ timeout: 10_000 });
    await followButton.click();
    await expect(follower.getByRole('button', { name: 'Unfollow' })).toBeVisible({ timeout: 10_000 });

    await follower.goto('/collections');
    await follower.getByRole('button', { name: 'Collections I follow' }).click();
    await expect(follower.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });

    await follower.getByRole('button', { name: 'Unfollow' }).click();
    await expect(follower.locator("text=aren't following")).toBeVisible({ timeout: 10_000 });
  });

  test('setting a collection back to private immediately breaks its old share link', async ({
    authedPage: owner,
    secondAnonymousPage: visitor,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    const sharePath = await createAndPublishCollection(owner);
    await owner.getByLabel('Visibility').selectOption('private');
    await expect(owner.getByRole('button', { name: 'Copy share link' })).toHaveCount(0);

    await visitor.goto(sharePath);
    await expect(visitor.locator('h1')).toContainText('Collection not found');
  });
});
