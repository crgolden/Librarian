
import { randomUUID } from 'node:crypto';

import { lowercaseToken } from '@crgolden/modules/testing';
import { test, expect, DEFAULT_E2E_SUB } from './fixtures.js';
import { AngularSsrMarkers } from './angular-ssr-constants';
import { CuratorCollectionKinds } from './mocks/curator-constants';
import { AppUrls } from '../src/app/app-paths';
import { SITE_NAME } from '../src/shared/page-title';
import { NPSSO_LENGTH } from '../src/psn/psn-settings.messages';

const VALID_NPSSO = lowercaseToken(NPSSO_LENGTH);

function libraryGame(gameId: string, title: string) {
  return { game_id: gameId, title, rawg_enriched: false, opencritic_enriched: false };
}

test.describe('SSR — raw HTML assertions', () => {
  test('home page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get('/');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SITE_NAME);
  });
});

test.describe('HomePage', () => {
  test('anonymous visitor sees a sign-in call to action', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#home-sign-in')).toBeVisible();
    await expect(page.locator('#home-actions')).toHaveCount(0);
  });

  test('authenticated visitor sees a link to PSN settings', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#home-action-0')).toHaveAttribute('href', AppUrls.account);
  });
});

test.describe('HomePage — resolved collection summary', () => {
  test('reports the seeded library and collection totals, with no unlinked notice', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
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

    await page.goto('/');

    await expect(page.locator('#home-total-library')).toHaveAttribute('data-count', String(libraryGames.length));
    await expect(page.locator('#home-total-collections')).toHaveAttribute('data-count', String(collections.length));
    await expect(page.locator('#home-total-collection-entries')).toHaveAttribute(
      'data-count',
      String(backlog.game_ids.length + finished.game_ids.length),
    );
    await expect(page.locator('#home-unlinked-notice')).toHaveCount(0);
  });

  test('tells an unlinked account nothing has been catalogued yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');

    await expect(page.locator('#home-unlinked-notice')).toBeVisible();
  });

  test('drops the unlinked notice after linking, without a page reload', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#home-unlinked-notice')).toBeVisible();

    await page.locator('#nav-rail-5').click();
    await page.waitForURL(`**${AppUrls.account}`);
    await page.locator('#npsso').fill(VALID_NPSSO);
    await page.locator('#psn-link-submit').click();
    await expect(page.locator('#psn-unlink')).toBeVisible();

    await page.locator('#nav-rail-0').click();
    await page.waitForURL((url) => url.pathname === '/');

    await expect(page.locator('#home-total-library')).toBeVisible();
    await expect(page.locator('#home-unlinked-notice')).toHaveCount(0);
  });
});
