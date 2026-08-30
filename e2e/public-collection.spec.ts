
import { test, expect } from './fixtures.js';

async function createAndPublishCollection(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/collections');
  await page.locator('#collections-new').click();
  await page.locator('#genreFilter').selectOption({ label: 'RPG' });
  await page.locator('#collection-preview').click();
  await expect(page.locator('#preview-included-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });
  await page.locator('#name').fill('RPG picks');
  await page.locator('#collection-save').click();
  await expect(page.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });

  await page.locator('#collection-open-0').click();
  await page.locator('#visibility').selectOption('unlisted');
  await expect(page.locator('#collection-share-url')).toContainText('/c/', { timeout: 10_000 });

  const shareUrl = await page.locator('#collection-share-url').textContent();
  const match = shareUrl === null ? null : shareUrl.match(/\/c\/[a-zA-Z0-9_-]+/);
  if (match === null) {
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
    await expect(visitor.locator('#page-title')).toContainText('RPG picks');
    await expect(visitor.locator('#public-collection-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });
    await expect(visitor.locator('#public-collection-sign-in')).toHaveText('Sign in to follow this collection');
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
    const followButton = follower.locator('#public-collection-follow');
    await expect(followButton).toHaveText('Follow this collection', { timeout: 10_000 });
    await followButton.click();
    await expect(followButton).toHaveText('Unfollow', { timeout: 10_000 });

    await follower.goto('/collections');
    await follower.locator('#collections-followed').click();
    await expect(follower.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });

    await follower.locator('#collection-followed-unfollow-0').click();
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
    await owner.locator('#visibility').selectOption('private');
    await expect(owner.locator('#collection-copy-share-link')).toHaveCount(0);

    await visitor.goto(sharePath);
    await expect(visitor.locator('#page-title')).toContainText('Collection not found');
  });
});
