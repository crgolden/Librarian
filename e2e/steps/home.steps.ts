import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { lowercaseToken } from '@crgolden/modules/testing';
import { DEFAULT_E2E_SUB } from '../fixtures.js';
import { CuratorCollectionKinds } from '../mocks/curator-constants';
import { AppUrls } from '../../src/app/app-paths';
import { NPSSO_LENGTH } from '../../src/psn/psn-settings.messages';
import { Given, Then, When } from './fixtures.js';

const VALID_NPSSO = lowercaseToken(NPSSO_LENGTH);
const NO_ELEMENTS = 0;

function libraryGame(gameId: string, title: string) {
  return { game_id: gameId, title, rawg_enriched: false, opencritic_enriched: false };
}

Given('my PlayStation account is linked', async ({ store }) => {
  await store.seedPsnLink();
});

Given('I have games in my library and saved collections', async ({ store, ctx }) => {
  const firstGameId = randomUUID();
  const secondGameId = randomUUID();
  const libraryGames = [libraryGame(firstGameId, randomUUID()), libraryGame(secondGameId, randomUUID())];
  const backlog = { definition_id: randomUUID(), name: randomUUID(), kind: CuratorCollectionKinds.manualList, game_ids: [firstGameId] };
  const finished = {
    definition_id: randomUUID(),
    name: randomUUID(),
    kind: CuratorCollectionKinds.manualList,
    game_ids: [firstGameId, secondGameId],
  };
  const collections = [backlog, finished];
  await store.seedLibraryGames(libraryGames);
  await store.seedUserCollections(DEFAULT_E2E_SUB, collections);
  ctx.libraryCount = libraryGames.length;
  ctx.collectionCount = collections.length;
  ctx.collectionEntryCount = backlog.game_ids.length + finished.game_ids.length;
});

Given('I am told on the home page that my account is unlinked', async ({ page }) => {
  await page.goto(AppUrls.home);
  await expect(page.locator('#home-unlinked-notice')).toBeVisible();
});

When('I open the home page', async ({ page }) => {
  await page.goto(AppUrls.home);
});

When('I link my PlayStation account and return home', async ({ page }) => {
  await page.locator('#nav-rail-5').click();
  await page.waitForURL(`**${AppUrls.account}`);
  await page.locator('#npsso').fill(VALID_NPSSO);
  await page.locator('#psn-link-submit').click();
  await expect(page.locator('#psn-unlink')).toBeVisible();
  await page.locator('#nav-rail-0').click();
  await page.waitForURL((url) => url.pathname === AppUrls.home);
});

Then('I am invited to sign in', async ({ page }) => {
  await expect(page.locator('#home-sign-in')).toBeVisible();
});

Then('I am offered no owner actions', async ({ page }) => {
  await expect(page.locator('#home-actions')).toHaveCount(NO_ELEMENTS);
});

Then('I am offered my account settings first', async ({ page }) => {
  await expect(page.locator('#home-action-0')).toHaveAttribute('href', AppUrls.account);
});

Then('I see my library and collection totals', async ({ page, ctx }) => {
  await expect(page.locator('#home-total-library')).toHaveAttribute('data-count', String(ctx.libraryCount));
  await expect(page.locator('#home-total-collections')).toHaveAttribute('data-count', String(ctx.collectionCount));
  await expect(page.locator('#home-total-collection-entries')).toHaveAttribute('data-count', String(ctx.collectionEntryCount));
});

Then('I see my library totals', async ({ page }) => {
  await expect(page.locator('#home-total-library')).toBeVisible();
});

Then('I am told my account is unlinked', async ({ page }) => {
  await expect(page.locator('#home-unlinked-notice')).toBeVisible();
});

Then('I am not told my account is unlinked', async ({ page }) => {
  await expect(page.locator('#home-unlinked-notice')).toHaveCount(NO_ELEMENTS);
});
