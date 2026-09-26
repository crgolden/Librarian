
import { randomUUID } from 'node:crypto';

import { newText } from '@crgolden/modules/testing';
import { test, expect, newCatalogGame, type TestStore } from './fixtures.js';
import { AppUrls, sharedCollectionUrl } from '../src/app/app-paths';
import { CollectionVisibilities } from '../src/curator/curator.models';

const SHARED_GENRE = newText();

interface PublishedCollection {
  sharePath: string;
  definitionId: string;
}

async function seedSharedGame(store: TestStore): Promise<string> {
  const gameId = randomUUID();
  await store.seedCatalogGames([{ ...newCatalogGame(), game_id: gameId, genre: SHARED_GENRE }]);
  return gameId;
}

async function createAndPublishCollection(
  page: import('@playwright/test').Page,
  gameId: string,
): Promise<PublishedCollection> {
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#genreFilter').selectOption({ label: SHARED_GENRE });
  await expect(page.locator('#genreFilter option:checked')).toHaveAttribute('data-genre', SHARED_GENRE);
  await page.locator('#collection-preview').click();
  await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', gameId);
  await page.locator('#name').fill(randomUUID());
  await page.locator('#collection-save').click();
  await expect(page.locator('#collection-name-0')).toBeVisible();

  const definitionId = await page.locator('#collection-name-0').getAttribute('data-definition-id');
  await page.locator('#collection-open-0').click();
  await page.locator('#visibility').selectOption(CollectionVisibilities.unlisted);
  await expect(page.locator('#collection-share-url')).toHaveAttribute('data-share-slug', /\S/);

  const shareSlug = await page.locator('#collection-share-url').getAttribute('data-share-slug');
  if (shareSlug === null || definitionId === null) {
    throw new Error('The saved collection carried no share slug or definition id');
  }
  return { sharePath: sharedCollectionUrl(shareSlug), definitionId };
}

test.describe('Public collection share page', () => {
  test('an anonymous visitor can open an unlisted collection and see its games with no account', async ({
    authedPage: owner,
    secondAnonymousPage: visitor,
    store,
  }) => {
    await store.reset();
    const gameId = await seedSharedGame(store);

    const { sharePath, definitionId } = await createAndPublishCollection(owner, gameId);

    await visitor.goto(sharePath);
    await expect(visitor.locator('#page-title')).toHaveAttribute('data-definition-id', definitionId);
    await expect(visitor.locator('#public-collection-title-0')).toHaveAttribute('data-game-id', gameId);
    await expect(visitor.locator('#public-collection-sign-in')).toBeVisible();
    await expect(visitor.locator('#public-collection-follow')).toHaveCount(0);
  });

  test('a second signed-in user can follow a shared collection and see it in "Collections I follow"', async ({
    authedPage: owner,
    secondAuthedPage: follower,
    store,
  }) => {
    await store.reset();
    const gameId = await seedSharedGame(store);

    const { sharePath, definitionId } = await createAndPublishCollection(owner, gameId);

    await follower.goto(sharePath);
    const followButton = follower.locator('#public-collection-follow');
    await expect(followButton).toHaveAttribute('data-following', String(false));
    await followButton.click();
    await expect(followButton).toHaveAttribute('data-following', String(true));

    await follower.goto(AppUrls.collections);
    await follower.locator('#collections-followed').click();
    await expect(follower.locator('#collection-followed-name-0')).toHaveAttribute('data-definition-id', definitionId);

    await follower.locator('#collection-followed-unfollow-0').click();
    await expect(follower.locator('#collections-followed-empty')).toBeVisible();
  });

  test('setting a collection back to private immediately breaks its old share link', async ({
    authedPage: owner,
    secondAnonymousPage: visitor,
    store,
  }) => {
    await store.reset();
    const gameId = await seedSharedGame(store);

    const { sharePath } = await createAndPublishCollection(owner, gameId);
    await owner.locator('#visibility').selectOption(CollectionVisibilities.private);
    await expect(owner.locator('#collection-copy-share-link')).toHaveCount(0);

    await visitor.goto(sharePath);
    await expect(visitor.locator('#public-collection-not-found')).toBeVisible();
    await expect(visitor.locator('#public-collection-title-0')).toHaveCount(0);
  });
});
