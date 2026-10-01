import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { newCatalogGame } from '../fixtures.js';
import { AppUrls } from '../../src/app/app-paths';
import { CuratorApi } from '../../src/curator/curator-api';
import { CollectionKinds, CollectionVisibilities, SizeSources } from '../../src/curator/curator.models';
import { HttpMethods } from '../../src/bff/http-headers';
import { Given, Then, When } from './fixtures.js';

const NO_ELEMENTS = 0;
const ONE_COLLECTION = 1;

function sizeSourceBadge(page: Page, index: number) {
  return page.locator(`#preview-included-size-source-${index}`);
}

async function saveThePreviewedCollection(page: Page): Promise<void> {
  await page.locator('#name').fill(randomUUID());
  await page.locator('#collection-save').click();
  await expect(page.locator('#collection-name-0')).toBeVisible();
}

async function previewCollectionOfGenre(page: Page, genre: string, gameId: string): Promise<void> {
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#genreFilter').selectOption({ label: genre });
  await expect(page.locator('#genreFilter option:checked')).toHaveAttribute('data-genre', genre);
  await page.locator('#collection-preview').click();
  await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', gameId);
}

Given('the catalog holds games whose sizes were measured, estimated and never measured', async ({ store, ctx }) => {
  const sizedGames = [
    { ...newCatalogGame(), size_source: SizeSources.measured },
    { ...newCatalogGame(), size_source: SizeSources.estimated },
  ];
  const unmeasuredGames = [newCatalogGame(), newCatalogGame()];
  const seededGames = [...sizedGames, ...unmeasuredGames];
  await store.seedCatalogGames(seededGames);
  ctx.expectedSizeSources = seededGames.map((game) => game.size_source ?? SizeSources.default);
  ctx.unmeasuredCount = unmeasuredGames.length;
});

Given('I have saved a capacity fill for one of my consoles and opened it', async ({ page, store }) => {
  const consoleId = randomUUID();
  const gameId = randomUUID();
  await store.seedConsoles([consoleId]);
  await store.seedCatalogGames([{ ...newCatalogGame(), game_id: gameId }]);
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#kind').selectOption(CollectionKinds.capacityFill);
  await expect(page.locator('#kind')).toHaveValue(CollectionKinds.capacityFill);
  await page.locator('#consoleId').selectOption(consoleId);
  await expect(page.locator('#consoleId')).toHaveValue(consoleId);
  await page.locator('#collection-preview').click();
  await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', gameId);
  await saveThePreviewedCollection(page);
  await page.locator('#collection-open-0').click();
  await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(false));
});

Given('that console is no longer mine', async ({ store }) => {
  await store.seedConsoles([]);
});

Given('I have saved a collection of that genre and opened it', async ({ page, ctx }) => {
  await previewCollectionOfGenre(page, ctx.chosenGenre, ctx.catalogGameId);
  await saveThePreviewedCollection(page);
  await page.locator('#collection-open-0').click();
  await expect(page.locator('#collection-detail-title')).toBeVisible();
});

When('I open my collections', async ({ page }) => {
  await page.goto(AppUrls.collections);
});

When('I preview a collection of that genre and save it', async ({ page, ctx }) => {
  await previewCollectionOfGenre(page, ctx.chosenGenre, ctx.catalogGameId);
  await saveThePreviewedCollection(page);
});

When('I preview a new collection', async ({ page }) => {
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#collection-preview').click();
});

When('I preview a capacity fill without choosing a console', async ({ page, ctx }) => {
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === CuratorApi.collectionsPreview) {
      ctx.curatorRequests.push(request.url());
    }
  });
  await page.goto(AppUrls.collections);
  await page.locator('#collections-new').click();
  await page.locator('#kind').selectOption(CollectionKinds.capacityFill);
  await expect(page.locator('#kind')).toHaveValue(CollectionKinds.capacityFill);
  await page.locator('#collection-preview').click();
});

When('I mark its title installed', async ({ page }) => {
  await page.locator('#collection-item-install-0').click();
});

When('I rename the collection', async ({ page, ctx }) => {
  ctx.renamedCollection = randomUUID();
  await page.locator('#collection-edit-meta').click();
  await page.locator('#editName').fill(ctx.renamedCollection);
  const renamed = page.waitForResponse(
    (response) =>
      response.request().method() === HttpMethods.patch &&
      new URL(response.url()).pathname.startsWith(`${CuratorApi.collections}/`),
  );
  await page.locator('#collection-meta-save').click();
  ctx.storedCollectionName = ((await (await renamed).json()) as { name: string }).name;
});

When('I make the collection unlisted', async ({ page }) => {
  await page.locator('#visibility').selectOption(CollectionVisibilities.unlisted);
});

When('I delete the collection', async ({ page }) => {
  await page.locator('#collection-delete').click();
  await page.locator('#collection-delete-confirm').click();
});

Then('I am told I have no collections', async ({ page }) => {
  await expect(page.locator('#collections-empty')).toBeVisible();
});

Then('I am offered to create one', async ({ page }) => {
  await expect(page.locator('#collections-new')).toBeVisible();
});

Then('my collections list that one collection', async ({ page }) => {
  await expect(page.locator('[id^="collection-name-"]')).toHaveCount(ONE_COLLECTION);
  await expect(page.locator('#collections-empty')).toHaveCount(NO_ELEMENTS);
});

Then('each included title says where its size came from, in words that tell them apart', async ({ page, ctx }) => {
  const expected = ctx.expectedSizeSources;
  for (const [index, rung] of expected.entries()) {
    await expect(sizeSourceBadge(page, index)).toHaveAttribute('data-size-source', rung);
  }
  const distinctRungs = [...new Set(expected)];
  const labels = await Promise.all(
    distinctRungs.map(async (rung) => (await sizeSourceBadge(page, expected.indexOf(rung)).textContent())?.trim()),
  );
  expect(labels, 'a badge rendered no text at all, so the distinctness check below would be comparing nothings').not.toContain(
    undefined,
  );
  expect(new Set(labels).size, `the rungs render as ${JSON.stringify(labels)}, which a reader cannot tell apart`).toBe(
    distinctRungs.length,
  );
  expect(
    (await sizeSourceBadge(page, expected.indexOf(SizeSources.default)).textContent())?.trim(),
    'the unmeasured rung leaks its raw wire value instead of a human label',
  ).not.toBe(SizeSources.default);
});

Then('I am told how many sizes were never measured', async ({ page, ctx }) => {
  const unmeasuredNote = page.locator('#preview-unmeasured-sizes');
  await expect(unmeasuredNote).toHaveAttribute('data-unmeasured-count', String(ctx.unmeasuredCount));
  await expect(unmeasuredNote).toHaveAttribute('data-shown-count', String(ctx.expectedSizeSources.length));
});

Then('I am told to choose a console', async ({ page }) => {
  await expect(page.locator('#collection-create-error')).toBeVisible();
});

Then('no preview was requested', ({ ctx }) => {
  expect(ctx.curatorRequests, 'the missing console was reported only after asking Curator for a preview').toEqual([]);
});

Then('the title is marked installed', async ({ page }) => {
  await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(true));
});

Then('I am told the title could not be marked installed', async ({ page }) => {
  await expect(page.locator('#collection-item-install-error-0')).toBeVisible();
});

Then('the title is not marked installed', async ({ page }) => {
  await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(false));
});

Then('the new name is stored and the collection is shown under it', async ({ page, ctx }) => {
  expect(ctx.storedCollectionName, 'Curator did not store the new name').toBe(ctx.renamedCollection);
  await expect(page.locator('#collection-detail-title')).toBeVisible();
  await expect(page.locator('#editName')).toHaveCount(NO_ELEMENTS);
});

Then('I am offered its share link', async ({ page }) => {
  await expect(page.locator('#collection-copy-share-link')).toBeVisible();
  await expect(page.locator('#collection-share-url')).toHaveAttribute('data-share-slug', /\S/);
});
