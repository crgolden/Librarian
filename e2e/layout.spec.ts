import { test, expect, DEFAULT_E2E_SUB, type LibraryGameFixture } from './fixtures.js';
import { boxOf, computedStyle, ownHeight, settleWebfonts, trackCount } from './layout.js';

const SEEDED_LIBRARY_TITLES = 25;

const XL_VIEWPORT = { width: 1280, height: 900 };
const LONG_LIBRARY_TITLE = 'A Quiet Place: The Road Ahead Deluxe Collector Edition';
const SHORT_LIBRARY_TITLE = '4 YoRHa';
const WIDEST_GENRE_TOKEN = 'ROLE_PLAYING_GAMES';
const EVERY_PLATFORM = ['PS3', 'PS4', 'PS5'];

function libraryWithALongAndAShortTitle(): LibraryGameFixture[] {
  return [SHORT_LIBRARY_TITLE, LONG_LIBRARY_TITLE].map((title, index) => ({
    game_id: `g${index}`,
    title,
    genre: WIDEST_GENRE_TOKEN,
    rawg_rating: 100,
    opencritic_rating: 100,
    psn_rating: 4.99,
    platforms: EVERY_PLATFORM,
    rawg_enriched: true,
    opencritic_enriched: true,
  }));
}

const SWEPT_WIDTHS = [390, 768, 1024, 1440] as const;
const SQUARE_COVER_DATA_URL =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#666"/></svg>');

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

  test('the library search and genre filter share one row', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g0', title: 'Game 00', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');
    await expect(page.locator('#library-genre-filter')).toBeVisible();

    const search = await boxOf(page, '#library-search');
    const filter = await boxOf(page, '#library-genre-filter');
    expect(
      Math.abs(search.top - filter.top),
      'a control whose flex-basis resolves to the global `select`/`input` width: 100% claims the whole line and pushes its neighbour onto the next one',
    ).toBeLessThan(2);
    expect(filter.width).toBeLessThan(search.width);
  });

  test('the per-page control renders at the pager’s meta size, not the body size', async ({
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

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');
    await expect(page.locator('#library-page-size')).toBeVisible();

    expect(
      await computedStyle(page, '#library-page-size', 'font-size'),
      'styles.css sets a bare `select` font-size outside any cascade layer, so it outranks every Tailwind utility whatever the specificity and no template class can cancel it — only page-size.component.css can. Proven by removing that line: the control renders 16px beside this 13.6px page count',
    ).toBe(await computedStyle(page, '#library-page-range', 'font-size'));
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

    expect(await computedStyle(page, '#library-header-cover', 'white-space')).toBe('nowrap');
  });

  test('the library table fits its card at the xl measure with every column at its widest', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(libraryWithALongAndAShortTitle());
    await store.seedHiddenLibraryGames(['g1']);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto('/library');
    await expect(page.locator('#library-header-percent_completed-link')).toBeVisible();
    await settleWebfonts(page, ['#library-header-title']);

    const fit = await page.evaluate(() => {
      const scroll = document.querySelector('.library-table-scroll');
      return scroll === null
        ? { clientWidth: -1, scrollWidth: -1 }
        : { clientWidth: scroll.clientWidth, scrollWidth: scroll.scrollWidth };
    });
    expect(fit.clientWidth).toBeGreaterThan(0);
    expect(
      fit.scrollWidth,
      `the table scrolls sideways inside its card and hides the Catalog column: ${JSON.stringify(fit)}`,
    ).toBeLessThanOrEqual(fit.clientWidth);
  });

  test('the collection detail controls are content-sized, not bars as wide as their column', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      { game_id: 'g1', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
    ]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [
      { definition_id: 'd1', name: 'Shelf', kind: 'filter_list', visibility: 'private', game_ids: ['g1'] },
    ]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto('/collections/d/d1');
    await expect(page.locator('#collection-detail-title')).toBeVisible();

    for (const id of ['#collections-back', '#collection-edit-meta', '#collection-run', '#collection-delete']) {
      const control = await boxOf(page, id);
      const parentWidth = await page
        .locator(id)
        .evaluate((element) => element.parentElement?.getBoundingClientRect().width ?? -1);
      expect(control.width, `${id} stretched to its column's width (${parentWidth}px)`).toBeLessThan(parentWidth / 2);
    }
  });

  test('the game page lays the cover beside its metadata above md instead of stacking them in a full-width card', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedCatalogGames([
      {
        game_id: 'g1',
        canonical_title: 'Bloodborne',
        franchise: 'Souls',
        genre: 'RPG',
        aaa_tier: 'AAA',
        critical_score: 92,
        oc_score: 91,
        psn_rating: 4.5,
        cover_image_url: SQUARE_COVER_DATA_URL,
      },
    ]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto('/catalog/g1');
    await expect(page.locator('#catalog-detail-cover')).toBeVisible();

    const cover = await boxOf(page, '#catalog-detail-cover');
    const ratings = await boxOf(page, '#catalog-detail-ratings');
    expect(ratings.left, 'the metadata column should sit beside the cover, not under it').toBeGreaterThan(cover.left + cover.width);
    expect(ratings.top).toBeLessThan(cover.top + cover.width / 2);
  });

  test('the Hide control sits under the title on its own line, whatever the title’s length', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(libraryWithALongAndAShortTitle());

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto('/library');
    await expect(page.locator('#library-hide-g1')).toBeVisible();
    await settleWebfonts(page, ['#library-title-0']);

    const shortTitle = await boxOf(page, '#library-title-0');
    const shortHide = await boxOf(page, '#library-hide-g0');
    const longTitle = await boxOf(page, '#library-title-1');
    const longHide = await boxOf(page, '#library-hide-g1');

    expect(
      shortHide.top,
      'a short title used to keep its Hide control beside the text while a long one pushed it under; the control takes its own line for both',
    ).toBeGreaterThan(shortTitle.top);
    expect(longHide.top).toBeGreaterThan(longTitle.top);
    expect(Math.round(shortHide.top - shortTitle.top)).toBe(Math.round(longHide.top - longTitle.top));
  });

  test('the hidden-games toggle is content-sized, not a bar as wide as the card', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(libraryWithALongAndAShortTitle());
    await store.seedHiddenLibraryGames(['g1']);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto('/library');
    await expect(page.locator('#library-show-hidden')).toBeVisible();

    const toggle = await boxOf(page, '#library-show-hidden');
    const card = await boxOf(page, '.library-table-card');
    expect(card.width).toBeGreaterThan(0);
    expect(
      toggle.width,
      'the table card is align-items: stretch, so a control inside it is a full-width bar unless it opts out with self-start',
    ).toBeLessThan(card.width / 2);
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
      await expect(page.locator('#collection-detail-title')).toBeVisible();
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
