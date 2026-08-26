import { test, expect, DEFAULT_E2E_SUB } from './fixtures.js';
import { boxOf, computedStyle, ownHeight, settleWebfonts, trackCount } from './layout.js';

const SEEDED_LIBRARY_TITLES = 25;

const SWEPT_WIDTHS = [390, 768, 1024, 1440] as const;

const LONG_COLLECTION_NAME = 'Capacity-fill pack for the console in the living room, sorted by score';

test.describe('Layout invariants DESIGN.md states and markup cannot prove', () => {
  test('the pager count sits on the buttons’ centre line rather than stretching to their height', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(
      Array.from({ length: SEEDED_LIBRARY_TITLES }, (_, index) => ({
        game_id: `g${index}`,
        title: `Game ${String(index).padStart(2, '0')}`,
        rawg_enriched: false,
        opencritic_enriched: false,
      })),
    );

    await page.goto('/library');
    await expect(page.locator('#library-pager')).toBeVisible();
    await settleWebfonts(page, ['#library-page-range']);

    expect(await computedStyle(page, '#library-pager', 'align-items')).toBe('center');

    const countHeight = await ownHeight(page, '#library-page-range');
    const buttonHeight = await ownHeight(page, '#library-next');
    expect(countHeight).toBeGreaterThan(0);
    expect(
      countHeight,
      'a stretched count reports the row height while its line box stays pinned to the top, which is the ~6px-high text this assertion exists to catch',
    ).toBeLessThan(buttonHeight);
  });

  test('the library search and category filter share one row', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g0', title: 'Game 00', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');
    await expect(page.locator('#library-category-filter')).toBeVisible();

    const search = await boxOf(page, '#library-search');
    const filter = await boxOf(page, '#library-category-filter');
    expect(
      Math.abs(search.top - filter.top),
      'a control whose flex-basis resolves to the global `select`/`input` width: 100% claims the whole line and pushes its neighbour onto the next one',
    ).toBeLessThan(2);
    expect(filter.width).toBeLessThan(search.width);
  });

  test('a library column header keeps its sort arrow on the header’s own line', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g0', title: 'Game 00', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');
    await expect(page.locator('#library-pager')).toBeVisible();

    expect(await computedStyle(page, '#library-header-0', 'white-space')).toBe('nowrap');
  });

  test('the profile page holds the same measure as the library', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.locator('#library-page')).toBeVisible();
    const libraryMeasure = await computedStyle(page, '#library-page', 'max-width');

    await page.goto('/profile');
    await expect(page.locator('#profile-stat-grid')).toBeVisible();
    const profileMeasure = await computedStyle(page, '#profile-view', 'max-width');

    expect(libraryMeasure).not.toBe('none');
    expect(
      profileMeasure,
      'the two data pages must share one measure — both take --container-data',
    ).toBe(libraryMeasure);
  });

  for (const [width, expectedTracks] of [
    [1280, 4],
    [800, 3],
    [520, 2],
    [380, 1],
  ] as const) {
    test(`the profile stat grid resolves to ${expectedTracks} track(s) at ${width}px with no media query`, async ({
      authedPage: page,
      store,
    }) => {
      await store.reset();
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/profile');
      await expect(page.locator('#profile-stat-grid')).toBeVisible();

      await expect.poll(() => trackCount(page, '#profile-stat-grid')).toBe(expectedTracks);
    });
  }

  test('the home actions are equal-width and leave no orphan on its own row', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');
    await expect(page.locator('#home-actions')).toBeVisible();
    await settleWebfonts(page, ['#home-action-0']);

    const actions = await page.locator('[id^="home-action-"]').evaluateAll((links) =>
      links.map((link) => {
        const box = link.getBoundingClientRect();
        return {
          label: link.textContent?.trim() ?? null,
          width: Math.round(box.width),
          top: Math.round(box.top),
        };
      }),
    );

    expect(actions.length, 'the home card should offer four actions').toBe(4);

    const widths = [...new Set(actions.map((a) => a.width))];
    expect(
      widths,
      `content-sized buttons produce ragged spacing that reads as arbitrary; got ${JSON.stringify(actions)}`,
    ).toHaveLength(1);

    const rows = [...new Set(actions.map((a) => a.top))];
    expect(
      rows,
      'four equal buttons over two tracks is two rows of two; a third row means one wrapped alone, ' +
        `which is the orphan this layout replaced. Got ${JSON.stringify(actions)}`,
    ).toHaveLength(2);
  });

  for (const width of SWEPT_WIDTHS) {
    test(`the collection detail view fits a ${width}px viewport when deep-linked`, async ({
      authedPage: page,
      store,
    }) => {
      await store.reset();
      await store.seedCatalogGames([
        { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
      ]);
      await store.seedUserCollections(DEFAULT_E2E_SUB, [
        {
          definition_id: 'd1',
          name: LONG_COLLECTION_NAME,
          kind: 'manual_list',
          visibility: 'unlisted',
          game_ids: ['g1'],
        },
      ]);

      await page.setViewportSize({ width, height: 900 });
      await page.goto('/collections/d/d1');
      await expect(page.locator('#collection-detail-title')).toBeVisible({ timeout: 10_000 });
      await settleWebfonts(page, ['#collection-detail-title']);

      await expect(
        page.locator('#collection-open-0'),
        'the list view rendering here would mean the deep link fell back to /collections, ' +
          'and every measurement below would be of the wrong page',
      ).toHaveCount(0);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `the page scrolls sideways at ${width}px: ${JSON.stringify(overflow)}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const shareUrl = await page.locator('#collection-share-url').evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { right: Math.round(box.right), text: element.textContent?.trim() ?? null };
      });
      expect(
        shareUrl.text,
        'an unlisted collection publishes a share URL, which is the longest unbreakable token on the page',
      ).toContain('/c/');
      expect(shareUrl.right, `the share URL escapes a ${width}px viewport`).toBeLessThanOrEqual(width);
    });
  }
});
