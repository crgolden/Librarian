
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

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

function sizeSourceBadge(page: Page, index: number) {
  return page.locator(`#preview-included-size-source-${index}`);
}

test.describe('Collections — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/collections');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Collections — authenticated', () => {
  test('shows an empty state when no collections are saved', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/collections');
    await expect(page.locator('#page-title')).toContainText('Collections');
    await expect(page.locator("text=haven't saved any collections")).toBeVisible();
  });

  test('creating a filter_list collection: preview, save, then it appears in the list', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#genreFilter').selectOption({ label: 'RPG' });
    await page.locator('#collection-preview').click();

    await expect(page.locator('#preview-included-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });

    await page.locator('#name').fill('RPG picks');
    await page.locator('#collection-save').click();

    await expect(page.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });
  });

  test('a preview badges every included title with the rung its size came from', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g-measured', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA', size_source: 'measured' },
      { game_id: 'g-estimated', canonical_title: 'Returnal', franchise: null, genre: 'RPG', aaa_tier: 'AA', size_source: 'estimated' },
      { game_id: 'g-ico', canonical_title: 'Ico', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
      { game_id: 'g-vagrant-story', canonical_title: 'Vagrant Story', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#collection-preview').click();

    await expect(sizeSourceBadge(page, 0)).toHaveAttribute('data-size-source', 'measured', { timeout: 10_000 });
    await expect(sizeSourceBadge(page, 1)).toHaveAttribute('data-size-source', 'estimated');
    await expect(sizeSourceBadge(page, 2)).toHaveAttribute('data-size-source', 'default');
    await expect(sizeSourceBadge(page, 3)).toHaveAttribute('data-size-source', 'default');

    const labels = await Promise.all(
      [0, 1, 2].map(async (index) => (await sizeSourceBadge(page, index).textContent())?.trim()),
    );
    expect(
      labels,
      'a badge rendered no text at all, so the distinctness check below would be comparing nothings',
    ).not.toContain(undefined);
    expect(
      new Set(labels).size,
      `the three rungs render as ${JSON.stringify(labels)} — a reader cannot tell them apart`,
    ).toBe(3);
    expect(labels[2], 'the unmeasured rung leaks its raw wire value instead of a human label').not.toBe('default');

    await expect(page.locator('#preview-unmeasured-sizes')).toContainText('2 of the 4 titles');
  });

  test('an unmeasured size reads as ordinary metadata, never as an error state', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g-measured', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA', size_source: 'measured' },
      { game_id: 'g-ico', canonical_title: 'Ico', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#collection-preview').click();
    await expect(sizeSourceBadge(page, 1)).toHaveAttribute('data-size-source', 'default', { timeout: 10_000 });

    const muted = await computedColorOfToken(page, '--color-text-muted');
    const danger = await computedColorOfToken(page, '--color-danger');
    const error = await computedColorOfToken(page, '--color-error');
    const ok = await computedColorOfToken(page, '--color-ok');

    expect(muted, 'the token probe resolved nothing, so every comparison below would pass vacuously').not.toBe('');
    expect(muted, 'the token probe cannot distinguish muted from danger, so it proves nothing').not.toBe(danger);

    const unmeasuredColor = await sizeSourceBadge(page, 1).evaluate((el) => getComputedStyle(el).color);
    const measuredColor = await sizeSourceBadge(page, 0).evaluate((el) => getComputedStyle(el).color);

    expect(unmeasuredColor, 'the majority rung is painted as an alarm rather than as ordinary metadata').toBe(muted);
    expect(unmeasuredColor).not.toBe(danger);
    expect(unmeasuredColor).not.toBe(error);
    expect(measuredColor, 'a measured size is not marked as such, so the rungs are visually identical').toBe(ok);
  });

  test('capacity_fill preview without a console shows a client-side validation error', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#kind').selectOption('capacity_fill');
    await page.locator('#collection-preview').click();

    await expect(page.locator('text=A console is required for a capacity-fill collection.')).toBeVisible();
  });

  test('running a saved capacity_fill collection and toggling install state (known console)', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedConsoles(['console-1']);
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#kind').selectOption('capacity_fill');
    await page.locator('#consoleId').selectOption('console-1');
    await page.locator('#collection-preview').click();
    await expect(page.locator('#preview-included-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });

    await page.locator('#name').fill('Console pack');
    await page.locator('#collection-save').click();
    await expect(page.locator('text=Console pack')).toBeVisible({ timeout: 10_000 });


    await page.locator('#collection-open-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveText('Mark installed', { timeout: 10_000 });

    await page.locator('#collection-item-install-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveText('Installed', { timeout: 10_000 });
  });

  test('toggling install state after a console loses ownership shows an inline 404 message', async ({
    authedPage: page,
    store,
  }) => {

    await store.reset();
    await store.seedConsoles(['console-1']);
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#kind').selectOption('capacity_fill');
    await page.locator('#consoleId').selectOption('console-1');
    await page.locator('#collection-preview').click();
    await expect(page.locator('#preview-included-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });

    await page.locator('#name').fill('Console pack');
    await page.locator('#collection-save').click();
    await expect(page.locator('text=Console pack')).toBeVisible({ timeout: 10_000 });

    await page.locator('#collection-open-0').click();
    await expect(page.locator('#collection-item-install-0')).toHaveText('Mark installed', { timeout: 10_000 });

    await store.seedConsoles([]);
    await page.locator('#collection-item-install-0').click();

    await expect(page.locator("text=Console 'console-1' not found")).toBeVisible({ timeout: 10_000 });
  });

  test('collection detail: rename, set visibility to unlisted, copy the share link, then delete', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);

    await page.goto('/collections');
    await page.locator('#collections-new').click();
    await page.locator('#genreFilter').selectOption({ label: 'RPG' });
    await page.locator('#collection-preview').click();
    await expect(page.locator('#preview-included-title-0')).toHaveText('Bloodborne', { timeout: 10_000 });
    await page.locator('#name').fill('RPG picks');
    await page.locator('#collection-save').click();
    await expect(page.locator('text=RPG picks')).toBeVisible({ timeout: 10_000 });

    await page.locator('#collection-open-0').click();
    await page.locator('#collection-edit-meta').click();
    await page.locator('#editName').fill('RPG favorites');
    await page.locator('#collection-meta-save').click();
    await expect(page.locator('#collection-detail-title')).toContainText('RPG favorites');

    await page.locator('#visibility').selectOption('unlisted');
    await expect(page.locator('#collection-copy-share-link')).toHaveText('Copy share link', { timeout: 10_000 });
    await expect(page.locator('#collection-share-url')).toContainText('/c/');

    await page.locator('#collection-delete').click();
    await page.locator('#collection-delete-confirm').click();
    await expect(page.locator("text=haven't saved any collections")).toBeVisible({ timeout: 10_000 });
  });
});
