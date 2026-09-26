
import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';
import { newText } from '@crgolden/modules/testing';
import { test, expect, newCatalogGame } from './fixtures.js';
import { AppUrls } from '../src/app/app-paths';
import { CuratorApi } from '../src/curator/curator-api';
import { CollectionKinds, CollectionVisibilities, SizeSources } from '../src/curator/curator.models';
import { BffPaths } from '../src/shared/bff-contract';
import { HttpMethods } from '../src/bff/http-headers';

async function computedColorOfToken(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

function trackPreviewRequests(page: Page): string[] {
  const previewRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === CuratorApi.collectionsPreview) {
      previewRequests.push(request.url());
    }
  });
  return previewRequests;
}

function sizeSourceBadge(page: Page, index: number) {
  return page.locator(`#preview-included-size-source-${index}`);
}

test.describe('Collections — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.collections);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('Collections — authenticated', () => {
  test('shows an empty state when no collections are saved', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.collections);
    await expect(page.locator('#collections-new')).toBeVisible();
    await expect(page.locator('#collections-empty')).toBeVisible();
  });

  test('creating a filter_list collection: preview, save, then it appears in the list', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const genre = newText();
    const gameId = randomUUID();
    await store.seedCatalogGames([{ ...newCatalogGame(), game_id: gameId, genre }]);

    await page.goto(AppUrls.collections);
    await page.locator('#collections-new').click();
    await page.locator('#genreFilter').selectOption({ label: genre });
    await expect(page.locator('#genreFilter option:checked')).toHaveAttribute('data-genre', genre);
    await page.locator('#collection-preview').click();

    await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', gameId);

    await page.locator('#name').fill(randomUUID());
    await page.locator('#collection-save').click();

    await expect(page.locator('#collection-name-0')).toBeVisible();
    await expect(page.locator('[id^="collection-name-"]')).toHaveCount(1);
    await expect(page.locator('#collections-empty')).toHaveCount(0);
  });

  test('a preview badges every included title with the rung its size came from', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const sizedGames = [
      { ...newCatalogGame(), size_source: SizeSources.measured },
      { ...newCatalogGame(), size_source: SizeSources.estimated },
    ];
    const unmeasuredGames = [newCatalogGame(), newCatalogGame()];
    const seededGames = [...sizedGames, ...unmeasuredGames];
    await store.seedCatalogGames(seededGames);
    const expectedRungs = seededGames.map((game) => game.size_source ?? SizeSources.default);
    const distinctRungs = [...new Set(expectedRungs)];
    const unmeasuredRungIndex = expectedRungs.indexOf(SizeSources.default);

    await page.goto(AppUrls.collections);
    await page.locator('#collections-new').click();
    await page.locator('#collection-preview').click();

    for (const [index, rung] of expectedRungs.entries()) {
      await expect(sizeSourceBadge(page, index)).toHaveAttribute('data-size-source', rung);
    }

    const labels = await Promise.all(
      distinctRungs.map(async (rung) => (await sizeSourceBadge(page, expectedRungs.indexOf(rung)).textContent())?.trim()),
    );
    expect(
      labels,
      'a badge rendered no text at all, so the distinctness check below would be comparing nothings',
    ).not.toContain(undefined);
    expect(
      new Set(labels).size,
      `the three rungs render as ${JSON.stringify(labels)} — a reader cannot tell them apart`,
    ).toBe(distinctRungs.length);
    expect(
      (await sizeSourceBadge(page, unmeasuredRungIndex).textContent())?.trim(),
      'the unmeasured rung leaks its raw wire value instead of a human label',
    ).not.toBe(SizeSources.default);

    const unmeasuredNote = page.locator('#preview-unmeasured-sizes');
    await expect(unmeasuredNote).toHaveAttribute('data-unmeasured-count', String(unmeasuredGames.length));
    await expect(unmeasuredNote).toHaveAttribute('data-shown-count', String(seededGames.length));
  });

  test('an unmeasured size reads as ordinary metadata, never as an error state', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([{ ...newCatalogGame(), size_source: SizeSources.measured }, newCatalogGame()]);

    await page.goto(AppUrls.collections);
    await page.locator('#collections-new').click();
    await page.locator('#collection-preview').click();
    await expect(sizeSourceBadge(page, 1)).toHaveAttribute('data-size-source', SizeSources.default);

    const muted = await computedColorOfToken(page, '--color-text-muted');
    const danger = await computedColorOfToken(page, '--color-danger');
    const ok = await computedColorOfToken(page, '--color-ok');

    expect(muted, 'the token probe resolved nothing, so every comparison below would pass vacuously').not.toBe('');
    expect(muted, 'the token probe cannot distinguish muted from danger, so it proves nothing').not.toBe(danger);

    const unmeasuredColor = await sizeSourceBadge(page, 1).evaluate((el) => getComputedStyle(el).color);
    const measuredColor = await sizeSourceBadge(page, 0).evaluate((el) => getComputedStyle(el).color);

    expect(unmeasuredColor, 'the majority rung is painted as an alarm rather than as ordinary metadata').toBe(muted);
    expect(unmeasuredColor).not.toBe(danger);
    expect(measuredColor, 'a measured size is not marked as such, so the rungs are visually identical').toBe(ok);
  });

  test('capacity_fill preview without a console shows a client-side validation error', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const previewRequests = trackPreviewRequests(page);

    await page.goto(AppUrls.collections);
    await page.locator('#collections-new').click();
    await page.locator('#kind').selectOption(CollectionKinds.capacityFill);
    await expect(page.locator('#kind')).toHaveValue(CollectionKinds.capacityFill);
    await page.locator('#collection-preview').click();

    await expect(page.locator('#collection-create-error')).toBeVisible();
    expect(previewRequests, 'the missing console was reported only after asking Curator for a preview').toEqual([]);
  });

  test('running a saved capacity_fill collection and toggling install state (known console)', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
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

    await page.locator('#name').fill(randomUUID());
    await page.locator('#collection-save').click();
    await expect(page.locator('#collection-name-0')).toBeVisible();

    await page.locator('#collection-open-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(false));

    await page.locator('#collection-item-install-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(true));
  });

  test('toggling install state after a console loses ownership shows an inline 404 message', async ({
    authedPage: page,
    store,
  }) => {

    await store.reset();
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

    await page.locator('#name').fill(randomUUID());
    await page.locator('#collection-save').click();
    await expect(page.locator('#collection-name-0')).toBeVisible();

    await page.locator('#collection-open-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(false));

    await store.seedConsoles([]);
    await page.locator('#collection-item-install-0').click();

    await expect(page.locator('#collection-item-install-error-0')).toBeVisible();
    await expect(page.locator('#collection-item-install-0')).toHaveAttribute('data-installed', String(false));
  });

  test('collection detail: rename, set visibility to unlisted, copy the share link, then delete', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const genre = newText();
    const gameId = randomUUID();
    const renamedName = randomUUID();
    await store.seedCatalogGames([{ ...newCatalogGame(), game_id: gameId, genre }]);

    await page.goto(AppUrls.collections);
    await page.locator('#collections-new').click();
    await page.locator('#genreFilter').selectOption({ label: genre });
    await expect(page.locator('#genreFilter option:checked')).toHaveAttribute('data-genre', genre);
    await page.locator('#collection-preview').click();
    await expect(page.locator('#preview-included-title-0')).toHaveAttribute('data-game-id', gameId);
    await page.locator('#name').fill(randomUUID());
    await page.locator('#collection-save').click();
    await expect(page.locator('#collection-name-0')).toBeVisible();

    await page.locator('#collection-open-0').click();
    await page.locator('#collection-edit-meta').click();
    await page.locator('#editName').fill(renamedName);
    const renamed = page.waitForResponse(
      (response) =>
        response.request().method() === HttpMethods.patch &&
        new URL(response.url()).pathname.startsWith(`${CuratorApi.collections}/`),
    );
    await page.locator('#collection-meta-save').click();
    const renamedBody = (await (await renamed).json()) as { name: string };
    expect(renamedBody.name, 'Curator did not store the new name').toBe(renamedName);
    await expect(page.locator('#collection-detail-title')).toBeVisible();
    await expect(page.locator('#editName')).toHaveCount(0);

    await page.locator('#visibility').selectOption(CollectionVisibilities.unlisted);
    await expect(page.locator('#collection-copy-share-link')).toBeVisible();
    await expect(page.locator('#collection-share-url')).toHaveAttribute('data-share-slug', /\S/);

    await page.locator('#collection-delete').click();
    await page.locator('#collection-delete-confirm').click();
    await expect(page.locator('#collections-empty')).toBeVisible();
  });
});
