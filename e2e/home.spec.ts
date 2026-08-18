/**
 * Home page E2E — anonymous browsing + SSR assertions, and authenticated state.
 */

import { test, expect, DEFAULT_E2E_SUB } from './fixtures.js';

const VALID_NPSSO = 'a'.repeat(64);
const UNLINKED_NOTICE = 'No PlayStation Network account is linked';

function libraryGame(gameId: string, title: string) {
  return { game_id: gameId, title, rawg_enriched: false, opencritic_enriched: false };
}

test.describe('SSR — raw HTML assertions', () => {
  test('home page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get('/');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain('ng-server-context');
    expect(html).toContain('Librarian');
  });
});

test.describe('HomePage', () => {
  test('anonymous visitor sees a sign-in call to action', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome to Librarian');
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });

  test('authenticated visitor sees a link to PSN settings', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Manage PSN Link' })).toBeVisible();
  });
});

test.describe('HomePage — resolved collection summary', () => {
  test('reports the seeded library and collection totals, with no unlinked notice', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedLibraryGames([libraryGame('g1', 'Bloodborne'), libraryGame('g2', 'Returnal')]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [
      { definition_id: 'd1', name: 'Backlog', kind: 'manual_list', game_ids: ['g1'] },
      { definition_id: 'd2', name: 'Finished', kind: 'manual_list', game_ids: ['g1', 'g2'] },
    ]);

    await page.goto('/');

    await expect(page.locator('.totals dd')).toHaveText(['2', '2', '3']);
    await expect(page.locator('.totals dt')).toHaveText(['Titles catalogued', 'Collections', 'Collection entries']);
    await expect(page.getByText(UNLINKED_NOTICE)).toHaveCount(0);
  });

  test('tells an unlinked account nothing has been catalogued yet', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');

    await expect(page.getByText(UNLINKED_NOTICE)).toBeVisible();
  });

  test('drops the unlinked notice after linking, without a page reload', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.getByText(UNLINKED_NOTICE)).toBeVisible();

    await page.locator('.site-nav-desktop').getByRole('link', { name: 'PSN Settings', exact: true }).click();
    await page.waitForURL('**/psn', { timeout: 10_000 });
    await page.getByLabel('NPSSO token').fill(VALID_NPSSO);
    await page.getByRole('button', { name: 'Link account' }).click();
    await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible({ timeout: 10_000 });

    await page.locator('.site-nav-desktop').getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 10_000 });

    await expect(page.locator('.totals dd').first()).toBeVisible();
    await expect(page.getByText(UNLINKED_NOTICE)).toHaveCount(0);
  });
});
