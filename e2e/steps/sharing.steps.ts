import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { newText } from '@crgolden/modules/testing';
import { newCatalogGame } from '../fixtures.js';
import { AppUrls, sharedCollectionUrl } from '../../src/app/app-paths';
import { CollectionVisibilities } from '../../src/curator/curator.models';
import { Given, Then, When } from './fixtures.js';

const NO_ELEMENTS = 0;

async function followTheSharedCollection(follower: Page, sharePath: string): Promise<void> {
  await follower.goto(sharePath);
  const followButton = follower.locator('#public-collection-follow');
  await expect(followButton).toHaveAttribute('data-following', String(false));
  await followButton.click();
  await expect(followButton).toHaveAttribute('data-following', String(true));
}

Given('the catalog holds a game in a genre I choose', async ({ store, ctx }) => {
  const game = { ...newCatalogGame(), game_id: randomUUID(), genre: newText() };
  await store.seedCatalogGames([game]);
  ctx.catalogGameId = game.game_id;
  ctx.chosenGenre = game.genre;
});

Given('I have saved a collection of that genre and shared it by link', async ({ page, ctx }) => {
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#genreFilter').selectOption({ label: ctx.chosenGenre });
  await expect(page.locator('#genreFilter option:checked')).toHaveAttribute('data-genre', ctx.chosenGenre);
  await page.locator('#collection-preview').click();
  await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', ctx.catalogGameId);
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
  ctx.sharePath = sharedCollectionUrl(shareSlug);
  ctx.sharedDefinitionId = definitionId;
});

Given('another signed-in user follows my shared collection', async ({ secondAuthedPage, ctx }) => {
  await followTheSharedCollection(secondAuthedPage, ctx.sharePath);
  await secondAuthedPage.goto(AppUrls.collections);
  await secondAuthedPage.locator('#collections-followed').click();
  await expect(secondAuthedPage.locator('#collection-followed-name-0')).toHaveAttribute(
    'data-definition-id',
    ctx.sharedDefinitionId,
  );
});

When('a visitor opens the share link', async ({ secondAnonymousPage, ctx }) => {
  await secondAnonymousPage.goto(ctx.sharePath);
});

When('another signed-in user opens the share link and follows the collection', async ({ secondAuthedPage, ctx }) => {
  await followTheSharedCollection(secondAuthedPage, ctx.sharePath);
});

When('they stop following it from their collections', async ({ secondAuthedPage }) => {
  await secondAuthedPage.locator('#collection-followed-unfollow-0').click();
});

When('I make the collection private', async ({ page }) => {
  await page.locator('#visibility').selectOption(CollectionVisibilities.private);
});

Then('the visitor sees my collection and its games', async ({ secondAnonymousPage, ctx }) => {
  await expect(secondAnonymousPage.locator('#page-title')).toHaveAttribute('data-definition-id', ctx.sharedDefinitionId);
  await expect(secondAnonymousPage.locator('#public-collection-title-0')).toHaveAttribute('data-game-id', ctx.catalogGameId);
});

Then('the visitor is invited to sign in rather than to follow it', async ({ secondAnonymousPage }) => {
  await expect(secondAnonymousPage.locator('#public-collection-sign-in')).toBeVisible();
  await expect(secondAnonymousPage.locator('#public-collection-follow')).toHaveCount(NO_ELEMENTS);
});

Then('the collection is among the collections they follow', async ({ secondAuthedPage, ctx }) => {
  await secondAuthedPage.goto(AppUrls.collections);
  await secondAuthedPage.locator('#collections-followed').click();
  await expect(secondAuthedPage.locator('#collection-followed-name-0')).toHaveAttribute(
    'data-definition-id',
    ctx.sharedDefinitionId,
  );
});

Then('they follow no collections', async ({ secondAuthedPage }) => {
  await expect(secondAuthedPage.locator('#collections-followed-empty')).toBeVisible();
});

Then('I am no longer offered a share link', async ({ page }) => {
  await expect(page.locator('#collection-copy-share-link')).toHaveCount(NO_ELEMENTS);
});

Then('a visitor opening the old share link is told it was not found', async ({ secondAnonymousPage, ctx }) => {
  await secondAnonymousPage.goto(ctx.sharePath);
  await expect(secondAnonymousPage.locator('#public-collection-not-found')).toBeVisible();
  await expect(secondAnonymousPage.locator('#public-collection-title-0')).toHaveCount(NO_ELEMENTS);
});
