import { LARGEST_PERCENT, newDisplayName, newId, newText, randomIntBetween } from '@crgolden/modules/testing';
import {
  test,
  expect,
  DEFAULT_E2E_SUB,
  newCatalogGame,
  newLibraryGame,
  newPsnRating,
  newScore,
  type LibraryGameFixture,
} from './fixtures.js';
import { boxOf, fontSizeOf, ownHeight, settleWebfonts, tokenPx, trackCount } from './layout.js';
import { CssValues } from './css-constants';
import { SvgMarkup } from './markup-constants';
import { PsnGenreTokens, PsnStarRatings } from './psn-constants';
import { CuratorCollectionKinds } from './mocks/curator-constants';
import e2eSettings from './e2e-settings.json';
import { AppUrls, catalogGameUrl, collectionDefinitionUrl } from '../src/app/app-paths';
import { CollectionKinds, CollectionVisibilities, ConsolePlatforms, LibrarySortFields } from '../src/curator/curator.models';
import { libraryHeaderId, librarySortArrowId, librarySortId } from '../src/library/library-ids';
import { LIBRARY_PAGE_SIZE } from '../src/library/library.query';

const LayoutSettings = e2eSettings.layout;
const LibraryTolerancesPx = e2eSettings.library.tolerancesPx;

const XL_VIEWPORT = e2eSettings.viewports.xl;
const WIDEST_GENRE_TOKEN = PsnGenreTokens.rolePlayingGames;
const EVERY_PLATFORM = [ConsolePlatforms.ps3, ConsolePlatforms.ps4, ConsolePlatforms.ps5];

function newLongTitle(): string {
  return Array.from({ length: LayoutSettings.longTitleWordPairs }, newDisplayName).join(' ');
}

const WIDEST_PSN_RATING = PsnStarRatings.largestTwoDecimalValue;

function libraryWithAShortAndALongTitle(): LibraryGameFixture[] {
  return [newText(), newLongTitle()].map((title) => ({
    ...newLibraryGame(),
    title,
    genre: WIDEST_GENRE_TOKEN,
    rawg_rating: LARGEST_PERCENT,
    opencritic_rating: LARGEST_PERCENT,
    psn_rating: WIDEST_PSN_RATING,
    platforms: EVERY_PLATFORM,
    rawg_enriched: true,
    opencritic_enriched: true,
  }));
}

function librarySpanningTwoPages(): LibraryGameFixture[] {
  return Array.from({ length: LIBRARY_PAGE_SIZE + randomIntBetween(1, LIBRARY_PAGE_SIZE) }, newLibraryGame);
}

function newSquareCoverDataUrl(): string {
  const side = randomIntBetween(LayoutSettings.coverSideMinimumPx, LayoutSettings.coverSideCeilingPx);
  return `${SvgMarkup.dataUrlPrefix}${encodeURIComponent(
    `<svg xmlns="${SvgMarkup.namespace}" width="${side}" height="${side}"><rect width="${side}" height="${side}"/></svg>`,
  )}`;
}

test.describe('Layout invariants DESIGN.md states and markup cannot prove', () => {
  test('the pager count sits on the buttons’ centre line rather than stretching to their height', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(librarySpanningTwoPages());

    await page.goto(AppUrls.library);
    await expect(page.locator('#library-pager')).toBeVisible();
    await settleWebfonts(page, ['#library-page-range']);

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
    await store.seedLibraryGames([newLibraryGame()]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(AppUrls.library);
    await expect(page.locator('#library-genre-filter')).toBeVisible();

    const search = await boxOf(page, '#library-search');
    const filter = await boxOf(page, '#library-genre-filter');
    expect(
      Math.abs(search.top - filter.top),
      'a control whose flex-basis resolves to the global `select`/`input` width: 100% claims the whole line and pushes its neighbour onto the next one',
    ).toBeLessThan(LayoutSettings.sharedRowTopTolerancePx);
    expect(filter.width).toBeLessThan(search.width);
  });

  test('the per-page control renders at the pager’s meta size, not the body size', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(librarySpanningTwoPages());

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(AppUrls.library);
    await expect(page.locator('#library-page-size')).toBeVisible();

    expect(
      await fontSizeOf(page, '#library-page-size'),
      'styles.css sets a bare `select` font-size outside any cascade layer, so it outranks every Tailwind utility whatever the specificity and no template class can cancel it — only page-size.component.css can. Proven by removing that line: the control renders 16px beside this 13.6px page count',
    ).toBe(await fontSizeOf(page, '#library-page-range'));
  });

  test('a sorted column keeps its sort arrow on its label’s line, which it would not without nowrap', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(libraryWithAShortAndALongTitle());

    await page.setViewportSize(e2eSettings.viewports.tableBetweenMdAndData);
    await page.goto(AppUrls.library);
    await page.locator(`#${librarySortId(LibrarySortFields.psnRating)}`).click();
    await expect(page.locator(`#${librarySortArrowId(LibrarySortFields.psnRating)}`)).toBeVisible();

    const measureHeader = (whiteSpaceOverride: string | null) =>
      page.evaluate(
        ({ headerId, labelId, arrowId, override }) => {
          const header = document.getElementById(headerId);
          const label = document.getElementById(labelId);
          const arrow = document.getElementById(arrowId);
          if (header === null || label === null || arrow === null) {
            throw new Error('The sorted header, its label or its arrow is not rendered.');
          }
          if (override !== null) {
            header.style.whiteSpace = override;
          }
          const labelRange = document.createRange();
          labelRange.selectNodeContents(label);
          const labelRects = [...labelRange.getClientRects()];
          return {
            labelRectCount: labelRects.length,
            labelLineCount: new Set(labelRects.map((rect) => Math.round(rect.top))).size,
            arrowDrop: arrow.getBoundingClientRect().top - label.getBoundingClientRect().top,
          };
        },
        {
          headerId: libraryHeaderId(LibrarySortFields.psnRating),
          labelId: librarySortId(LibrarySortFields.psnRating),
          arrowId: librarySortArrowId(LibrarySortFields.psnRating),
          override: whiteSpaceOverride,
        },
      );

    const asRendered = await measureHeader(null);
    expect(asRendered.labelRectCount, 'a Range that selects nothing measures no lines and would satisfy any bound').toBeGreaterThan(0);
    expect(asRendered.labelLineCount).toBe(1);
    expect(Math.abs(asRendered.arrowDrop)).toBeLessThanOrEqual(LibraryTolerancesPx.sameLineTop);

    const withoutNowrap = await measureHeader(CssValues.normal);
    expect(
      withoutNowrap.labelLineCount > 1 || withoutNowrap.arrowDrop > LibraryTolerancesPx.sameLineTop,
      'with white-space cleared this column must break, or the assertions above could not fail',
    ).toBe(true);
  });

  test('the library table fits its card at the xl measure with every column at its widest', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const libraryGames = libraryWithAShortAndALongTitle();
    const [, longTitledGame] = libraryGames;
    await store.seedLibraryGames(libraryGames);
    await store.seedHiddenLibraryGames([longTitledGame.game_id]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(AppUrls.library);
    await expect(page.locator('#library-header-percent_completed-link')).toBeVisible();
    await settleWebfonts(page, ['#library-header-title']);

    const fit = await page.evaluate(() => {
      const scroll = document.querySelector('#library-table-scroll');
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
    const game = newCatalogGame();
    const definitionId = newId();
    await store.seedCatalogGames([game]);
    await store.seedUserCollections(DEFAULT_E2E_SUB, [
      { definition_id: definitionId, name: newText(), kind: CollectionKinds.filterList, visibility: CollectionVisibilities.private, game_ids: [game.game_id] },
    ]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(collectionDefinitionUrl(definitionId));
    await expect(page.locator('#collection-detail-title')).toBeVisible();

    for (const id of ['#collections-back', '#collection-edit-meta', '#collection-run', '#collection-delete']) {
      const control = await boxOf(page, id);
      const parentWidth = await page
        .locator(id)
        .evaluate((element) => element.parentElement?.getBoundingClientRect().width ?? -1);
      expect(control.width, `${id} stretched to its column's width (${parentWidth}px)`).toBeLessThan(
        parentWidth * LayoutSettings.contentSizedWidthFraction,
      );
    }
  });

  test('the game page lays the cover beside its metadata above md instead of stacking them in a full-width card', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    const game = {
      ...newCatalogGame(),
      franchise: newText(),
      critical_score: newScore(),
      oc_score: newScore(),
      psn_rating: newPsnRating(),
      cover_image_url: newSquareCoverDataUrl(),
    };
    await store.seedCatalogGames([game]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(catalogGameUrl(game.game_id));
    await expect(page.locator('#catalog-detail-cover')).toBeVisible();

    const cover = await boxOf(page, '#catalog-detail-cover');
    const ratings = await boxOf(page, '#catalog-detail-ratings');
    expect(ratings.left, 'the metadata column should sit beside the cover, not under it').toBeGreaterThan(cover.left + cover.width);
    expect(ratings.top).toBeLessThan(cover.top + cover.width * LayoutSettings.midlineFraction);
  });

  test('the Hide control sits under the title on its own line, whatever the title’s length', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const [shortTitledGame, longTitledGame] = libraryWithAShortAndALongTitle();
    await store.seedLibraryGames([shortTitledGame, longTitledGame]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(AppUrls.library);
    await expect(page.locator(`#library-hide-${longTitledGame.game_id}`)).toBeVisible();
    const shortTitleSelector = `#library-row-${shortTitledGame.game_id} [id^="library-title-"]`;
    const longTitleSelector = `#library-row-${longTitledGame.game_id} [id^="library-title-"]`;
    await settleWebfonts(page, [shortTitleSelector]);

    const shortTitle = await boxOf(page, shortTitleSelector);
    const shortTitleHeight = await ownHeight(page, shortTitleSelector);
    const shortHide = await boxOf(page, `#library-hide-${shortTitledGame.game_id}`);
    const longTitle = await boxOf(page, longTitleSelector);
    const longTitleHeight = await ownHeight(page, longTitleSelector);
    const longHide = await boxOf(page, `#library-hide-${longTitledGame.game_id}`);

    expect(
      shortHide.top,
      'a short title’s Hide control should sit on its own line under the title, as a long title’s does',
    ).toBeGreaterThanOrEqual(shortTitle.top + shortTitleHeight);
    expect(longHide.top).toBeGreaterThanOrEqual(longTitle.top + longTitleHeight);
    expect(
      Math.round(shortHide.top - (shortTitle.top + shortTitleHeight)),
      'the gap between a title and its Hide control is the same whatever the title’s length',
    ).toBe(Math.round(longHide.top - (longTitle.top + longTitleHeight)));
  });

  test('the hidden-games toggle is content-sized, not a bar as wide as the card', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const libraryGames = libraryWithAShortAndALongTitle();
    const [, longTitledGame] = libraryGames;
    await store.seedLibraryGames(libraryGames);
    await store.seedHiddenLibraryGames([longTitledGame.game_id]);

    await page.setViewportSize(XL_VIEWPORT);
    await page.goto(AppUrls.library);
    await expect(page.locator('#library-show-hidden')).toBeVisible();

    const toggle = await boxOf(page, '#library-show-hidden');
    const card = await boxOf(page, '#library-table-card');
    expect(card.width).toBeGreaterThan(0);
    expect(
      toggle.width,
      'the table card is align-items: stretch, so a control inside it is a full-width bar unless it opts out with self-start',
    ).toBeLessThan(card.width * LayoutSettings.contentSizedWidthFraction);
  });

  test('the profile page holds the same measure as the library', async ({ authedPage: page, store }) => {
    await store.reset();
    await page.setViewportSize(e2eSettings.viewports.desktop);

    await page.goto(AppUrls.library);
    await expect(page.locator('#library-page')).toBeVisible();
    const library = await boxOf(page, '#library-page');
    const dataMeasure = await tokenPx(page, '--container-data');

    await page.goto(AppUrls.profile);
    await expect(page.locator('#profile-stat-grid')).toBeVisible();
    const profile = await boxOf(page, '#profile-view');

    expect(dataMeasure).toBeGreaterThan(0);
    expect(
      library.width,
      'at this viewport the data measure binds, so a page at any other width is not holding it',
    ).toBeCloseTo(dataMeasure, 0);
    expect(profile.width, 'the two data pages must render at one measure').toBeCloseTo(library.width, 0);
  });

  for (const { width, expectedTracks } of LayoutSettings.profileStatGridTracks) {
    test(`the profile stat grid resolves to ${expectedTracks} track(s) at ${width}px with no media query`, async ({
      authedPage: page,
      store,
    }) => {
      await store.reset();
      await page.setViewportSize({ width, height: XL_VIEWPORT.height });
      await page.goto(AppUrls.profile);
      await expect(page.locator('#profile-stat-grid')).toBeVisible();

      await expect.poll(() => trackCount(page, '#profile-stat-grid')).toBe(expectedTracks);
    });
  }

  test('the home actions are equal-width and leave no orphan on its own row', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto(AppUrls.home);
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

    expect(actions.length, 'the home card should offer four actions').toBe(LayoutSettings.homeActions.count);

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
    ).toHaveLength(LayoutSettings.homeActions.rows);
  });

  for (const width of LayoutSettings.sweptWidths) {
    test(`the collection detail view fits a ${width}px viewport when deep-linked`, async ({
      authedPage: page,
      store,
    }) => {
      await store.reset();
      const game = newCatalogGame();
      const definitionId = newId();
      await store.seedCatalogGames([game]);
      await store.seedUserCollections(DEFAULT_E2E_SUB, [
        {
          definition_id: definitionId,
          name: newLongTitle(),
          kind: CuratorCollectionKinds.manualList,
          visibility: CollectionVisibilities.unlisted,
          game_ids: [game.game_id],
        },
      ]);

      await page.setViewportSize({ width, height: XL_VIEWPORT.height });
      await page.goto(collectionDefinitionUrl(definitionId));
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
      ).toContain(`${AppUrls.sharedCollections}/`);
      expect(shareUrl.right, `the share URL escapes a ${width}px viewport`).toBeLessThanOrEqual(width);
    });
  }
});
