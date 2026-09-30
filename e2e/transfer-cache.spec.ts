import type { Page } from '@playwright/test';
import { test, expect, newCatalogGame } from './fixtures.js';
import { dehydratedMarkersLeft } from './hydration.js';
import { CURATOR_API_PREFIX } from '../src/curator/curator-api';
import { AppUrls, catalogGameUrl } from '../src/app/app-paths';
import { catalogTitleId } from '../src/catalog/catalog-ids';

function recordCuratorRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith(CURATOR_API_PREFIX)) {
      requested.push(pathname);
    }
  });
  return requested;
}

test.describe('TransferCache', () => {
  test('hydrating a server-rendered catalog reuses the server response instead of asking Curator again', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([newCatalogGame()]);
    const curatorRequests = recordCuratorRequests(page);

    await page.goto(AppUrls.catalog, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);

    expect(curatorRequests).toEqual([]);
  });

  test('a client-side navigation after hydration still asks Curator', async ({ anonymousPage: page, store }) => {
    await store.reset();
    const game = newCatalogGame();
    await store.seedCatalogGames([game]);
    await page.goto(AppUrls.catalog, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => dehydratedMarkersLeft(page)).toBe(0);
    const curatorRequests = recordCuratorRequests(page);

    await page.locator(`#${catalogTitleId(0)}`).click();
    await expect(page).toHaveURL(new RegExp(`${catalogGameUrl(game.game_id)}$`));
    await expect(page.locator('#catalog-detail-ratings')).toBeVisible();

    expect(curatorRequests).not.toEqual([]);
  });
});
