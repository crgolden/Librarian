import type { Locator, Page } from '@playwright/test';
import {
  LARGEST_PERCENT,
  lowercaseToken,
  newId,
  newMemberOf,
  newMemberOtherThan,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import {
  test,
  expect,
  DEFAULT_E2E_SUB,
  newCatalogGame,
  newFutureInstant,
  newLibraryGame,
  newPsnRating,
  newScore,
  newStoreHit,
  type TestStore,
} from './fixtures.js';
import { admittedGameId, type StoreSearchHit } from './mocks/curator.js';
import { CssValues } from './css-constants';
import { tokenPx } from './layout.js';
import { PsnGenreTokens } from './psn-constants';
import { RawgConstants } from './rawg-constants';
import e2eSettings from './e2e-settings.json';
import { AppUrls, catalogGameUrl, userLibraryUrl } from '../src/app/app-paths';
import { JobStatuses, RefreshCadences, SchedulePausedReasons, TrophyMatches } from '../src/curator/curator.models';
import { SUMMARY_TITLE_DISPLAY_CAP } from '../src/library/library-summary';
import { LIBRARY_PLATFORM_ID_PREFIX, LIBRARY_ROW_ID_PREFIX, libraryRowId } from '../src/library/library-ids';
import { LIBRARY_PAGE_SIZE, LIBRARY_PAGE_SIZE_CEILING, LibraryQueryParams } from '../src/library/library.query';
import { pageSizeChoicesUpTo } from '../src/shared/page-size/page-size.preference';
import { BffPaths } from '../src/shared/bff-contract';

const LIBRARY_ROWS = `[id^="${LIBRARY_ROW_ID_PREFIX}"]`;
const LIBRARY_PLATFORM_TAGS = `[id^="${LIBRARY_PLATFORM_ID_PREFIX}"]`;

const SCHEDULE_NEXT_RUN_AT = newFutureInstant();
const SCHEDULE_LAST_RUN_AT = newUtcInstant();
const SCHEDULE_PAUSED_REASON = newMemberOf(Object.values(SchedulePausedReasons));

const LibraryLayoutTolerancesPx = e2eSettings.library.tolerancesPx;

function rowIds(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((elements) => elements.map((element) => element.id));
}

function titlesInSortedOrder(count: number): string[] {
  return Array.from({ length: count }, newText).sort((left, right) => left.localeCompare(right));
}

function newShortGenre(): string {
  return lowercaseToken(randomIntBetween(1, e2eSettings.library.ordinaryGenreLengthCeiling));
}

const LIBRARY_CHOSEN_PAGE_SIZE = newMemberOtherThan(
  pageSizeChoicesUpTo(LIBRARY_PAGE_SIZE_CEILING, LIBRARY_PAGE_SIZE),
  LIBRARY_PAGE_SIZE,
);
const PAGED_LIBRARY_TITLES = LIBRARY_CHOSEN_PAGE_SIZE + LIBRARY_PAGE_SIZE;

function pagedLibraryTitles() {
  return Array.from({ length: PAGED_LIBRARY_TITLES }, newLibraryGame);
}

async function seedStoreHitsMatching(store: TestStore, fragment: string): Promise<StoreSearchHit[]> {
  const hits = [newStoreHit(fragment), newStoreHit(fragment)];
  await store.seedStoreSearchHits(hits);
  return hits;
}

async function searchTheManualAddPanelFor(page: Page, term: string): Promise<void> {
  await page.locator('#library-add-manual-toggle').click();
  await page.locator('#library-manual-search').fill(term);
  await page.locator('#library-manual-search-submit').click();
}

const STORE_HITS_FOR_A_SHORT_PROPOSAL = e2eSettings.library.shortProposalStoreHitCount;

interface DialogBox {
  left: number;
  rightGap: number;
  top: number;
  bottomGap: number;
  width: number;
  scrollHeight: number;
  clientHeight: number;
}

async function openTheStoreMatchDialog(page: Page, store: TestStore, hitCount: number): Promise<DialogBox> {
  await store.reset();
  await store.seedPsnLink();
  const storeOnlyFragment = newText();
  await store.seedStoreSearchHits(Array.from({ length: hitCount }, () => newStoreHit(storeOnlyFragment)));

  await page.goto(AppUrls.library);
  await searchTheManualAddPanelFor(page, storeOnlyFragment);
  await expect(page.locator('#library-store-match')).toBeVisible();

  return page.evaluate(() => {
    const dialog = document.querySelector('#library-store-match');
    if (dialog === null) {
      throw new Error('The Store-match dialog is not rendered.');
    }
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left,
      rightGap: document.documentElement.clientWidth - rect.right,
      top: rect.top,
      bottomGap: document.documentElement.clientHeight - rect.bottom,
      width: rect.width,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight,
    };
  });
}

test.describe('Library — manual add, Store cross-check', () => {
  test('a catalog miss proposes a Store match, and accepting it adds the game', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    const storeOnlyFragment = newText();
    const [firstCandidate] = await seedStoreHitsMatching(store, storeOnlyFragment);

    await page.goto(AppUrls.library);
    await searchTheManualAddPanelFor(page, storeOnlyFragment);

    const dialog = page.locator('#library-store-match');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#library-store-candidate-0')).toHaveAttribute('data-store-id', firstCandidate.id);

    await page.locator('#library-store-accept-0').click();

    await expect(dialog).toBeHidden();
    const admittedRow = page.locator(`#${libraryRowId(admittedGameId(firstCandidate.id))}`);
    await expect(admittedRow).toBeVisible();
    await expect(admittedRow.locator('[id^="library-manual-badge-"]')).toBeVisible();
  });

  test('offers only what is missing, proving the BFF forwards the exclusion upstream', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const sharedTerm = newId();
    const ownedGameId = newId();
    const missingGameId = newId();
    const ownedTitle = `${sharedTerm} ${newId()}`;
    await store.seedCatalogGames([
      { ...newCatalogGame(), game_id: ownedGameId, canonical_title: ownedTitle },
      { ...newCatalogGame(), game_id: missingGameId, canonical_title: `${sharedTerm} ${newId()}` },
    ]);
    await store.seedLibraryGames([{ ...newLibraryGame(), game_id: ownedGameId, title: ownedTitle }]);

    await page.goto(AppUrls.library);
    await searchTheManualAddPanelFor(page, sharedTerm);

    await expect(page.locator('[id^="library-manual-add-"]')).toHaveCount(1);
    await expect(page.locator('#library-manual-add-0')).toHaveAttribute('data-game-id', missingGameId);
  });

  test('says every match is owned instead of spending a Store search, when the owner has them all', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    const ownedGame = newCatalogGame();
    await store.seedCatalogGames([ownedGame]);
    await store.seedLibraryGames([{ ...newLibraryGame(), game_id: ownedGame.game_id, title: ownedGame.canonical_title }]);

    await page.goto(AppUrls.library);
    await searchTheManualAddPanelFor(page, ownedGame.canonical_title);

    await expect(page.locator('#library-manual-all-owned')).toBeVisible();
    await expect(page.locator('[id^="library-manual-add-"]')).toHaveCount(0);
    await expect(page.locator('#library-store-match')).toBeHidden();
    await expect(page.locator('#library-manual-check-store')).toBeVisible();
  });

  test('the search field and its button share a row with a real gap between them', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.library);
    await page.locator('#library-add-manual-toggle').click();

    const input = await page.locator('#library-manual-search').boundingBox();
    const button = await page.locator('#library-manual-search-submit').boundingBox();
    if (input === null || button === null) {
      throw new Error('The manual-add search controls are not laid out.');
    }

    const inputCentre = input.y + input.height * e2eSettings.layout.midlineFraction;
    const buttonCentre = button.y + button.height * e2eSettings.layout.midlineFraction;
    expect(Math.abs(inputCentre - buttonCentre)).toBeLessThan(LibraryLayoutTolerancesPx.searchRowCentre);
    expect(button.x - (input.x + input.width)).toBeGreaterThanOrEqual(LibraryLayoutTolerancesPx.searchButtonMinimumGap);
  });

  test('the proposal dialog takes the page’s ink, not the browser’s dialog default', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.library);
    await expect(page.locator('#library-store-match')).toBeAttached();
    await expect(page.locator('#library-add-manual-toggle')).toBeVisible();

    const inks = await page.evaluate(() => {
      const dialog = document.querySelector('#library-store-match');
      return { dialog: dialog === null ? null : getComputedStyle(dialog).color, page: getComputedStyle(document.body).color };
    });

    expect(inks.dialog, 'the UA stylesheet colours a <dialog> CanvasText, which breaks inheritance from body').toBe(inks.page);
  });

  test('the proposal dialog is centred and holds the narrow measure on a wide screen', async ({
    authedPage: page,
    store,
  }) => {
    await page.setViewportSize(e2eSettings.viewports.desktop);
    const box = await openTheStoreMatchDialog(page, store, STORE_HITS_FOR_A_SHORT_PROPOSAL);
    const narrowMeasure = await tokenPx(page, '--container-narrow');

    expect(Math.abs(box.left - box.rightGap), 'a modal dialog is centred by margin: auto, which Preflight zeroes').toBeLessThanOrEqual(
      LibraryLayoutTolerancesPx.dialogCentring,
    );
    expect(box.top).toBeGreaterThan(0);
    expect(narrowMeasure).toBeGreaterThan(0);
    expect(
      Math.abs(box.width - narrowMeasure),
      'a dialog is width: fit-content, so without its own measure it sizes to its candidates instead',
    ).toBeLessThanOrEqual(LibraryLayoutTolerancesPx.dialogMeasure);
  });

  test('the proposal dialog keeps a gutter on both sides of a phone screen', async ({ authedPage: page, store }) => {
    await page.setViewportSize(e2eSettings.viewports.mobile);
    const box = await openTheStoreMatchDialog(page, store, STORE_HITS_FOR_A_SHORT_PROPOSAL);

    expect(box.left, 'at the narrow measure alone the dialog would be wider than a phone and overflow it').toBeGreaterThan(0);
    expect(box.rightGap).toBeGreaterThan(0);
    expect(Math.abs(box.left - box.rightGap)).toBeLessThanOrEqual(LibraryLayoutTolerancesPx.dialogCentring);
  });

  test('a proposal longer than the screen scrolls inside the dialog instead of running off it', async ({
    authedPage: page,
    store,
  }) => {
    await page.setViewportSize(e2eSettings.viewports.shortDialog);
    const box = await openTheStoreMatchDialog(page, store, e2eSettings.library.overflowingStoreHitCount);

    expect(
      box.scrollHeight,
      'the proposal must be longer than the dialog can show, or the bounds below could not fail',
    ).toBeGreaterThan(box.clientHeight);
    expect(box.top).toBeGreaterThan(0);
    expect(box.bottomGap, 'a long Store proposal runs past the bottom edge unless the dialog bounds its own height').toBeGreaterThan(0);
  });

  test('declining the proposal adds nothing', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedPsnLink();
    const storeOnlyFragment = newText();
    await seedStoreHitsMatching(store, storeOnlyFragment);

    await page.goto(AppUrls.library);
    await searchTheManualAddPanelFor(page, storeOnlyFragment);

    const dialog = page.locator('#library-store-match');
    await expect(dialog).toBeVisible();
    await page.locator('#library-store-match-cancel').click();

    await expect(dialog).toBeHidden();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(0);
  });

  test('says the Store cannot be checked without a linked account', async ({ authedPage: page, store }) => {
    await store.reset();
    const storeOnlyFragment = newText();
    await seedStoreHitsMatching(store, storeOnlyFragment);

    await page.goto(AppUrls.library);
    await searchTheManualAddPanelFor(page, storeOnlyFragment);

    await expect(page.locator('#library-store-unlinked')).toBeVisible();
    await expect(page.locator('#library-store-match')).toBeHidden();
  });
});

test.describe('Library — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.library);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('Library — authenticated', () => {
  test('refreshing resolves to a success message', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.library);
    await page.locator('#library-refresh').click();

    await expect(page.locator('#library-refresh-status')).toHaveAttribute('data-status', JobStatuses.succeeded);
    await expect(page.locator('#library-refresh-succeeded')).toBeVisible();
  });

  test('a RAWG-enriched entry brings the backlink their terms require', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      { ...newLibraryGame(), genre: newText(), rawg_rating: newScore(), rawg_enriched: true },
    ]);

    await page.goto(AppUrls.library);

    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RawgConstants.home);
  });

  test('a library nothing RAWG enriched claims no RAWG data', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { ...newLibraryGame(), genre: newText(), opencritic_rating: newScore(), opencritic_enriched: true },
    ]);

    await page.goto(AppUrls.library);

    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);
  });

  test('refreshing surfaces the job error on a failed run', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.setLibraryRefreshOutcome(JobStatuses.failed, newId());

    await page.goto(AppUrls.library);
    await page.locator('#library-refresh').click();

    await expect(page.locator('#library-refresh-status')).toHaveAttribute('data-status', JobStatuses.failed);
    await expect(page.locator('#library-refresh-failed')).toBeVisible();
  });

  test('shows a message when the library is empty', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.library);
    await expect(page.locator('#library-empty')).toBeVisible();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(0);
  });

  test('renders ratings, genre, and a catalog link, with a dash for unresolved values', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const ratedGame = {
      ...newLibraryGame(),
      genre: newId(),
      rawg_rating: newScore(),
      opencritic_rating: newScore(),
      psn_rating: newPsnRating(),
      psn_product_id: newId(),
      rawg_enriched: true,
      opencritic_enriched: true,
    };
    const unmatchedGame = newLibraryGame();
    const seededGames = [ratedGame, unmatchedGame];
    await store.seedLibraryGames(seededGames);

    await page.goto(AppUrls.library);
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(seededGames.length);

    const ratedRow = page.locator(`#${libraryRowId(ratedGame.game_id)}`);
    await expect(ratedRow.locator('[id^="library-genre-"]')).toHaveAttribute('title', ratedGame.genre);
    await expect(ratedRow.locator('[id^="library-rawg-"]')).toHaveAttribute('data-score', String(ratedGame.rawg_rating));
    await expect(ratedRow.locator('[id^="library-opencritic-"]')).toHaveAttribute(
      'data-score',
      String(ratedGame.opencritic_rating),
    );
    await expect(ratedRow.locator('[id^="library-psn-rating-"]')).toHaveAttribute('data-score', String(ratedGame.psn_rating));
    await expect(ratedRow.locator('[id^="library-details-"]')).toHaveAttribute('href', catalogGameUrl(ratedGame.game_id));

    const unmatchedRow = page.locator(`#${libraryRowId(unmatchedGame.game_id)}`);
    await expect(unmatchedRow.locator('[id^="library-rawg-"]')).not.toHaveAttribute('data-score');
    await expect(unmatchedRow.locator('[id^="library-opencritic-"]')).not.toHaveAttribute('data-score');
    await expect(unmatchedRow.locator('[id^="library-psn-rating-"]')).not.toHaveAttribute('data-score');
    await expect(unmatchedRow.locator('[id^="library-details-"]')).toHaveAttribute('href', catalogGameUrl(unmatchedGame.game_id));
  });

  test('renders every platform an entry is owned on, and a dash for none', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const platforms = [newId(), newId(), newId()];
    const multiPlatformGame = { ...newLibraryGame(), platforms };
    const unplatformedGame = newLibraryGame();
    const seededGames = [multiPlatformGame, unplatformedGame];
    await store.seedLibraryGames(seededGames);

    await page.goto(AppUrls.library);
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(seededGames.length);

    const multiTags = page.locator(`#${libraryRowId(multiPlatformGame.game_id)}`).locator(LIBRARY_PLATFORM_TAGS);
    await expect(multiTags).toHaveCount(platforms.length);
    for (const [index, platform] of platforms.entries()) {
      await expect(multiTags.nth(index)).toHaveAttribute('data-platform', platform);
    }

    const none = page.locator(`#${libraryRowId(unplatformedGame.game_id)}`);
    await expect(none.locator(LIBRARY_PLATFORM_TAGS)).toHaveCount(0);
  });

  test('renders trophy completion percentage, with a dash when no match was found', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const partlyCompleted = randomIntBetween(1, LARGEST_PERCENT);
    const untouched = 0;
    const partlyCompletedGame = { ...newLibraryGame(), percent_completed: partlyCompleted };
    const untouchedGame = { ...newLibraryGame(), percent_completed: untouched };
    const unmatchedGame = newLibraryGame();
    const seededGames = [partlyCompletedGame, untouchedGame, unmatchedGame];
    await store.seedLibraryGames(seededGames);

    await page.goto(AppUrls.library);
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(seededGames.length);

    const completion = (gameId: string) =>
      page.locator(`#${libraryRowId(gameId)}`).locator('[id^="library-percent-completed-"]');
    await expect(completion(partlyCompletedGame.game_id)).toHaveAttribute('data-percent-completed', String(partlyCompleted));
    await expect(completion(untouchedGame.game_id)).toHaveAttribute('data-percent-completed', String(untouched));
    await expect(completion(unmatchedGame.game_id)).not.toHaveAttribute('data-percent-completed');
  });

  test('searches by title', async ({ authedPage: page, store }) => {
    await store.reset();
    const searchTerm = newId();
    const matchingGame = { ...newLibraryGame(), title: `${searchTerm} ${newId()}` };
    const seededGames = [matchingGame, newLibraryGame()];
    await store.seedLibraryGames(seededGames);

    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(seededGames.length);

    await page.locator('#library-search').fill(searchTerm);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator(`#${libraryRowId(matchingGame.game_id)}`)).toBeVisible();
  });

  test('filters by genre', async ({ authedPage: page, store }) => {
    await store.reset();
    const chosenGenre = newId();
    const chosenGame = { ...newLibraryGame(), genre: chosenGenre };
    const seededGames = [{ ...newLibraryGame(), genre: newId() }, chosenGame];
    await store.seedLibraryGames(seededGames);

    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(seededGames.length);

    await page.locator('#library-genre-filter').selectOption(chosenGenre);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator(`#${libraryRowId(chosenGame.game_id)}`)).toBeVisible();
  });

  test('a raw genre token is ellipsised in the Genre column while the cell keeps the whole token', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const rawGenreToken = PsnGenreTokens.rolePlayingGames;
    const genresInRowOrder = [rawGenreToken, newShortGenre()];
    const titlesInRowOrder = titlesInSortedOrder(genresInRowOrder.length);
    const seededGames = genresInRowOrder.map((genre, index) => ({
      ...newLibraryGame(),
      title: titlesInRowOrder[index],
      genre,
    }));
    await store.seedLibraryGames(seededGames);

    await page.setViewportSize(e2eSettings.viewports.xl);
    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(seededGames.length);

    const rawToken = page.locator('#library-genre-0');
    const ordinaryGenre = page.locator('#library-genre-1');

    await expect(rawToken).toHaveAttribute('title', rawGenreToken);

    expect(
      await rawToken.evaluate((cell) => cell.scrollWidth - cell.clientWidth),
      'the raw token is not clipped, so the Genre column is sized by the widest vocabulary token again',
    ).toBeGreaterThan(0);
    expect(
      await ordinaryGenre.evaluate((cell) => cell.scrollWidth - cell.clientWidth),
      'the cap also clips an ordinary genre, which is a regression in the common case rather than a fix for the long one',
    ).toBe(0);

    const columnWidth = async (): Promise<number> =>
      (await page.locator('#library-header-genre').boundingBox())?.width ?? Number.NaN;
    const capped = await columnWidth();

    await page.evaluate((uncappedWidth) => {
      for (const cell of document.querySelectorAll<HTMLElement>('[id^="library-genre-"]')) {
        cell.style.maxWidth = uncappedWidth;
      }
    }, CssValues.none);
    const uncapped = await columnWidth();

    expect(
      capped,
      'clearing max-width at runtime left the column the same width, so the cap is measuring nothing',
    ).toBeLessThan(uncapped);
  });

  test('sorts by clicking a column header, toggling direction on a second click', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const firstByTitleId = newId();
    const secondByTitleId = newId();
    await store.seedLibraryGames([
      { game_id: firstByTitleId, title: `a${newId()}`, rawg_enriched: false, opencritic_enriched: false },
      { game_id: secondByTitleId, title: `b${newId()}`, rawg_enriched: false, opencritic_enriched: false },
    ]);
    const ascending = [libraryRowId(firstByTitleId), libraryRowId(secondByTitleId)];
    const descending = [libraryRowId(secondByTitleId), libraryRowId(firstByTitleId)];

    await page.goto(AppUrls.library);
    const rows = page.locator(LIBRARY_ROWS);
    await expect.poll(() => rowIds(rows)).toEqual(ascending);

    const titleSort = page.locator('#library-sort-title');
    await titleSort.click();
    await expect.poll(() => rowIds(rows)).toEqual(descending);

    await titleSort.click();
    await expect.poll(() => rowIds(rows)).toEqual(ascending);
  });

  test('pages through results', async ({ authedPage: page, store }) => {
    await store.reset();
    const overflowTitles = randomIntBetween(1, LIBRARY_PAGE_SIZE);
    await store.seedLibraryGames(Array.from({ length: LIBRARY_PAGE_SIZE + overflowTitles }, newLibraryGame));

    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
    await expect(page.locator('#library-prev')).toBeDisabled();
    await expect(page.locator('#library-next')).toBeEnabled();

    await page.locator('#library-next').click();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(overflowTitles);
    await expect(page.locator('#library-prev')).toBeEnabled();
    await expect(page.locator('#library-next')).toBeDisabled();

    await page.locator('#library-prev').click();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  });

  test('the per-page choice resizes the page and outlives a reload', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames(pagedLibraryTitles());

    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);

    await page.locator('#library-page-size').selectOption(String(LIBRARY_CHOSEN_PAGE_SIZE));
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);

    await page.reload();

    await expect(
      page.locator(LIBRARY_ROWS),
      'the choice is stored per browser, so falling back to the default here means the control is wired to the request but not to writePageSize/readPageSize — which the mocked unit test cannot see, because it never reloads',
    ).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
    await expect(page.locator('#library-page-size')).toHaveValue(String(LIBRARY_CHOSEN_PAGE_SIZE));
  });

  test('resizing the page returns to the first one rather than holding a stale offset', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames(pagedLibraryTitles());

    await page.goto(AppUrls.library);
    await page.locator('#library-next').click();
    await expect(page.locator('#library-prev')).toBeEnabled();

    await page.locator('#library-page-size').selectOption(String(LIBRARY_CHOSEN_PAGE_SIZE));

    await expect(
      page.locator('#library-prev'),
      'keeping the old offset after a resize can land past the end of the result set, which renders an empty page the pager still reports as valid',
    ).toBeDisabled();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
  });

  test('combined search, sort, and page interaction stays internally consistent', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const sharedTerm = newText();
    const overflowTitles = randomIntBetween(1, LIBRARY_PAGE_SIZE);
    const matchingTitles = titlesInSortedOrder(LIBRARY_PAGE_SIZE + overflowTitles).map((suffix) => `${sharedTerm} ${suffix}`);
    const matchingGames = matchingTitles.map((title) => ({ ...newLibraryGame(), title }));
    const unrelatedGames = [newLibraryGame(), newLibraryGame()];
    await store.seedLibraryGames([...matchingGames, ...unrelatedGames]);
    const descendingMatchIds = [...matchingGames].reverse().map((game) => libraryRowId(game.game_id));

    await page.goto(AppUrls.library);

    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);

    await page.locator('#library-search').fill(sharedTerm);
    await expect.poll(() => new URL(page.url()).searchParams.get(LibraryQueryParams.q)).toBe(sharedTerm);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);

    const titleSort = page.locator('#library-sort-title');
    await titleSort.click();
    const rows = page.locator(LIBRARY_ROWS);
    await expect.poll(() => rowIds(rows)).toEqual(descendingMatchIds.slice(0, LIBRARY_PAGE_SIZE));

    await page.locator('#library-next').click();
    await expect.poll(() => rowIds(rows)).toEqual(descendingMatchIds.slice(LIBRARY_PAGE_SIZE));
    await expect(page.locator('#library-next')).toBeDisabled();

    const [singledOut] = matchingGames;
    await page.locator('#library-search').fill(singledOut.title);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator(`#${libraryRowId(singledOut.game_id)}`)).toBeVisible();
    await expect(page.locator('#library-prev')).toBeDisabled();
  });

  test('shows the post-refresh summary, capping the inline title list, and the OpenCritic top-up message', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const overflowTitles = randomIntBetween(1, SUMMARY_TITLE_DISPLAY_CAP);
    const manyTitles = Array.from({ length: SUMMARY_TITLE_DISPLAY_CAP + overflowTitles }, newId);
    const openCriticTitles = [newId()];
    await store.setLibraryRefreshOutcome(JobStatuses.succeeded, undefined, {
      rawg_enriched_titles: manyTitles,
      opencritic_enriched_titles: openCriticTitles,
      opencritic_topup_incomplete: true,
    });

    await page.goto(AppUrls.library);
    await page.locator('#library-refresh').click();

    await expect(page.locator('#library-refresh-succeeded')).toBeVisible();
    const rawgSummary = page.locator('#library-summary-rawg');
    await expect(rawgSummary).toHaveAttribute('data-shown-count', String(SUMMARY_TITLE_DISPLAY_CAP));
    await expect(rawgSummary).toHaveAttribute('data-more-count', String(overflowTitles));
    const openCriticSummary = page.locator('#library-summary-opencritic');
    await expect(openCriticSummary).toHaveAttribute('data-shown-count', String(openCriticTitles.length));
    await expect(openCriticSummary).toHaveAttribute('data-more-count', String(0));
    await expect(page.locator('#library-summary-opencritic-topup')).toBeVisible();
  });
});

test.describe('Library — hiding a game', () => {
  test('hiding a title takes it out of the list and offers it back under the hidden view', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const hiddenGame = newLibraryGame();
    const keptGame = newLibraryGame();
    const seededGames = [hiddenGame, keptGame];
    await store.seedLibraryGames(seededGames);

    const hiddenByThisTest = [hiddenGame.game_id];

    await page.goto(AppUrls.library);
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(seededGames.length);
    await expect(page.locator('#library-show-hidden')).toHaveCount(0);

    await page.locator(`#library-hide-${hiddenGame.game_id}`).click();

    await expect(page.locator(`#${libraryRowId(hiddenGame.game_id)}`)).toHaveCount(0);
    await expect(page.locator(`#${libraryRowId(keptGame.game_id)}`)).toBeVisible();
    await expect(page.locator('#library-show-hidden')).toHaveAttribute('data-hidden-count', String(hiddenByThisTest.length));

    await page.locator('#library-show-hidden').click();

    await expect(page.locator(`#${libraryRowId(hiddenGame.game_id)}`)).toBeVisible();
    await expect(page.locator(`#${libraryRowId(keptGame.game_id)}`)).toHaveCount(0);
    await expect(page.locator(`#library-hide-${hiddenGame.game_id}`)).toHaveCount(0);

    await page.locator(`#library-unhide-${hiddenGame.game_id}`).click();

    await expect(page.locator('#library-hidden-empty')).toBeVisible();

    await page.locator('#library-show-hidden').click();
    await expect(page.locator(`#${libraryRowId(hiddenGame.game_id)}`)).toBeVisible();
  });

  test('a hidden title survives a reload, because the exclusion is stored rather than held in the page', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const hiddenGame = newLibraryGame();
    await store.seedLibraryGames([hiddenGame]);
    const hiddenGameIds = [hiddenGame.game_id];
    await store.seedHiddenLibraryGames(hiddenGameIds);

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-show-hidden')).toHaveAttribute('data-hidden-count', String(hiddenGameIds.length));
    await expect(page.locator(`#${libraryRowId(hiddenGame.game_id)}`)).toHaveCount(0);
  });

  test('offers no hide control on another user\'s library', async ({
    authedPage: page,
    secondAuthedPage: viewerPage,
    store,
  }) => {
    await store.reset();
    const ownedGame = newLibraryGame();
    await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_library: true });
    await store.seedUserLibraryGames(DEFAULT_E2E_SUB, [ownedGame]);

    await page.goto(AppUrls.profile);
    await viewerPage.goto(userLibraryUrl(DEFAULT_E2E_SUB));

    await expect(viewerPage.locator(`#${libraryRowId(ownedGame.game_id)}`)).toBeVisible();
    await expect(viewerPage.locator(`#library-hide-${ownedGame.game_id}`)).toHaveCount(0);
    await expect(viewerPage.locator('#library-show-hidden')).toHaveCount(0);
  });
});

test.describe('Library — trophy completion', () => {
  test('offers the trophy setting from the column header when nothing is harvesting trophies', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([newLibraryGame()]);

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-header-percent_completed-link')).toHaveAttribute(
      'href',
      `${AppUrls.account}#pref-trophies`,
    );
  });

  test('drops the header link once trophies are harvested and a refresh has matched a title', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedPsnLink();
    await store.seedPsnPreferences({ harvest_trophies: true });
    const percentCompleted = randomIntBetween(1, LARGEST_PERCENT + 1);
    await store.seedLibraryGames([
      {
        ...newLibraryGame(),
        percent_completed: percentCompleted,
        trophy_match: TrophyMatches.matched,
      },
    ]);

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-percent-completed-0')).toHaveAttribute(
      'data-percent-completed',
      String(percentCompleted),
    );
    await expect(page.locator('#library-header-percent_completed-link')).toHaveCount(0);
  });
});

test.describe('Library — the refresh schedule summary', () => {
  test('reads the next run, not the last one, and offers the account page to change it', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
      cadence: RefreshCadences.daily,
      next_run_at: SCHEDULE_NEXT_RUN_AT,
      last_run_at: SCHEDULE_LAST_RUN_AT,
    });

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-schedule-next')).toHaveAttribute('data-next-run-at', SCHEDULE_NEXT_RUN_AT);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', AppUrls.account);
    await expect(page.locator('#library-schedule-none')).toHaveCount(0);
  });

  test('reports a paused schedule as paused rather than as a due date', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
      next_run_at: SCHEDULE_NEXT_RUN_AT,
      paused_reason: SCHEDULE_PAUSED_REASON,
    });

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-schedule-paused')).toHaveAttribute('data-paused-reason', SCHEDULE_PAUSED_REASON);
    await expect(page.locator('#library-schedule-next')).toHaveCount(0);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', AppUrls.account);
  });

  test('invites a user with no schedule to set one up', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.library);

    await expect(page.locator('#library-schedule-none')).toBeVisible();
    await expect(page.locator('#library-schedule-next')).toHaveCount(0);
    await expect(page.locator('#library-schedule-paused')).toHaveCount(0);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', AppUrls.account);
  });
});
