import { test, expect } from './fixtures.js';
import { boxOf, computedStyle, ownHeight, settleWebfonts, trackCount } from './layout.js';

const SEEDED_LIBRARY_TITLES = 25;

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

  test('the footer row is the height of its own content, with no phantom paragraph margin', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');

    expect(await computedStyle(page, '#footer-note', 'margin-bottom')).toBe('0px');

    const rowHeight = await ownHeight(page, '#footer-inner');
    const paragraphHeight = await ownHeight(page, '#footer-note');
    expect(paragraphHeight).toBeGreaterThan(0);
    expect(rowHeight - paragraphHeight).toBeLessThan(4);
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
    await page.goto('/profile');
    await expect(page.locator('#profile-stat-grid')).toBeVisible();

    expect(await computedStyle(page, '#profile-view', 'max-width')).toBe('1000px');
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
});
