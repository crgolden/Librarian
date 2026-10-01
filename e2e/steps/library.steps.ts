import { expect, type Locator, type Page } from '@playwright/test';
import {
  LARGEST_PERCENT,
  newId,
  newMemberOf,
  newMemberOtherThan,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import {
  DEFAULT_E2E_SUB,
  newCatalogGame,
  newFutureInstant,
  newLibraryGame,
  newPsnRating,
  newScore,
  newStoreHit,
  type LibraryGameFixture,
} from '../fixtures.js';
import { admittedGameId } from '../mocks/curator.js';
import { AppUrls, catalogGameUrl } from '../../src/app/app-paths';
import { JobStatuses, RefreshCadences, SchedulePausedReasons, TrophyMatches } from '../../src/curator/curator.models';
import { SUMMARY_TITLE_DISPLAY_CAP } from '../../src/library/library-summary';
import { LIBRARY_PLATFORM_ID_PREFIX, LIBRARY_ROW_ID_PREFIX, libraryRowId } from '../../src/library/library-ids';
import { LIBRARY_PAGE_SIZE, LIBRARY_PAGE_SIZE_CEILING, LibraryQueryParams } from '../../src/library/library.query';
import { pageSizeChoicesUpTo } from '../../src/shared/page-size/page-size.preference';
import { Given, Then, When } from './fixtures.js';

const LIBRARY_ROWS = `[id^="${LIBRARY_ROW_ID_PREFIX}"]`;
const LIBRARY_PLATFORM_TAGS = `[id^="${LIBRARY_PLATFORM_ID_PREFIX}"]`;
const NO_ELEMENTS = 0;
const ONE_GAME = 1;
const UNTOUCHED = 0;
const NONE_MORE = 0;
const LIBRARY_CHOSEN_PAGE_SIZE = newMemberOtherThan(pageSizeChoicesUpTo(LIBRARY_PAGE_SIZE_CEILING, LIBRARY_PAGE_SIZE), LIBRARY_PAGE_SIZE);
const SCHEDULE_NEXT_RUN_AT = newFutureInstant();
const SCHEDULE_PAUSED_REASON = newMemberOf(Object.values(SchedulePausedReasons));

function rowIds(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((elements) => elements.map((element) => element.id));
}

function titlesInSortedOrder(count: number): string[] {
  return Array.from({ length: count }, newText).sort((left, right) => left.localeCompare(right));
}

function row(page: Page, gameId: string): Locator {
  return page.locator(`#${libraryRowId(gameId)}`);
}

async function searchTheManualAddPanelFor(page: Page, term: string): Promise<void> {
  await page.goto(AppUrls.library);
  await page.locator('#library-add-manual-toggle').click();
  await page.locator('#library-manual-search').fill(term);
  await page.locator('#library-manual-search-submit').click();
}

Given('the next library refresh will fail', async ({ store }) => {
  await store.setLibraryRefreshOutcome(JobStatuses.failed, newId());
});

Given('the next library refresh will enrich more titles than the summary lists', async ({ store, ctx }) => {
  ctx.overflowCount = randomIntBetween(1, SUMMARY_TITLE_DISPLAY_CAP);
  ctx.openCriticTitleCount = ONE_GAME;
  await store.setLibraryRefreshOutcome(JobStatuses.succeeded, undefined, {
    rawg_enriched_titles: Array.from({ length: SUMMARY_TITLE_DISPLAY_CAP + ctx.overflowCount }, newId),
    opencritic_enriched_titles: [newId()],
    opencritic_topup_incomplete: true,
  });
});

Given('my library holds a game RAWG enriched', async ({ store }) => {
  await store.seedLibraryGames([{ ...newLibraryGame(), genre: newText(), rawg_rating: newScore(), rawg_enriched: true }]);
});

Given('my library holds a game only OpenCritic enriched', async ({ store }) => {
  await store.seedLibraryGames([
    { ...newLibraryGame(), genre: newText(), opencritic_rating: newScore(), opencritic_enriched: true },
  ]);
});

Given('my library holds a fully rated game and one nothing matched', async ({ store, ctx }) => {
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
  ctx.libraryGames = [ratedGame, newLibraryGame()];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds a game owned on several platforms and one on none', async ({ store, ctx }) => {
  ctx.libraryGames = [{ ...newLibraryGame(), platforms: [newId(), newId(), newId()] }, newLibraryGame()];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds a partly completed game, an untouched one and one with no trophy match', async ({ store, ctx }) => {
  ctx.libraryGames = [
    { ...newLibraryGame(), percent_completed: randomIntBetween(1, LARGEST_PERCENT) },
    { ...newLibraryGame(), percent_completed: UNTOUCHED },
    newLibraryGame(),
  ];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds a game with a title I search for and one without', async ({ store, ctx }) => {
  ctx.searchTerm = newId();
  ctx.libraryGames = [{ ...newLibraryGame(), title: `${ctx.searchTerm} ${newId()}` }, newLibraryGame()];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds a game in a genre I choose and one outside it', async ({ store, ctx }) => {
  ctx.chosenGenre = newId();
  ctx.libraryGames = [{ ...newLibraryGame(), genre: ctx.chosenGenre }, { ...newLibraryGame(), genre: newId() }];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds two games whose titles sort in a known order', async ({ store, ctx }) => {
  ctx.libraryGames = [
    { game_id: newId(), title: `a${newId()}`, rawg_enriched: false, opencritic_enriched: false },
    { game_id: newId(), title: `b${newId()}`, rawg_enriched: false, opencritic_enriched: false },
  ];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my library holds more games than fit on one page', async ({ store, ctx }) => {
  ctx.overflowCount = randomIntBetween(1, LIBRARY_PAGE_SIZE);
  await store.seedLibraryGames(Array.from({ length: LIBRARY_PAGE_SIZE + ctx.overflowCount }, newLibraryGame));
});

Given('my library holds enough games to fill either page size', async ({ store }) => {
  await store.seedLibraryGames(Array.from({ length: LIBRARY_CHOSEN_PAGE_SIZE + LIBRARY_PAGE_SIZE }, newLibraryGame));
});

Given('I have moved to the next page of my library', async ({ page }) => {
  await page.goto(AppUrls.library);
  await page.locator('#library-next').click();
  await expect(page.locator('#library-prev')).toBeEnabled();
});

Given('my library holds more games sharing a word than fit on one page, and others', async ({ store, ctx }) => {
  ctx.searchTerm = newText();
  ctx.overflowCount = randomIntBetween(1, LIBRARY_PAGE_SIZE);
  const matchingGames = titlesInSortedOrder(LIBRARY_PAGE_SIZE + ctx.overflowCount).map((suffix) => ({
    ...newLibraryGame(),
    title: `${ctx.searchTerm} ${suffix}`,
  }));
  ctx.libraryGames = matchingGames;
  await store.seedLibraryGames([...matchingGames, newLibraryGame(), newLibraryGame()]);
});

Given('my library holds two games', async ({ store, ctx }) => {
  ctx.libraryGames = [newLibraryGame(), newLibraryGame()];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('I have hidden one of them', async ({ page, ctx }) => {
  const [hiddenGame] = ctx.libraryGames;
  await page.goto(AppUrls.library);
  await page.locator(`#library-hide-${hiddenGame.game_id}`).click();
  await expect(row(page, hiddenGame.game_id)).toHaveCount(NO_ELEMENTS);
});

Given('I have hidden one of them and opened my hidden games', async ({ page, ctx }) => {
  const [hiddenGame] = ctx.libraryGames;
  await page.goto(AppUrls.library);
  await page.locator(`#library-hide-${hiddenGame.game_id}`).click();
  await page.locator('#library-show-hidden').click();
  await expect(row(page, hiddenGame.game_id)).toBeVisible();
});

Given('my library holds a game I have hidden', async ({ store, ctx }) => {
  ctx.libraryGames = [newLibraryGame()];
  await store.seedLibraryGames(ctx.libraryGames);
  await store.seedHiddenLibraryGames(ctx.libraryGames.map((game) => game.game_id));
});

Given('my library is public and holds a game', async ({ page, store, ctx }) => {
  ctx.libraryGames = [newLibraryGame()];
  await store.seedUserProfileSettings(DEFAULT_E2E_SUB, { is_public: true, show_library: true });
  await store.seedUserLibraryGames(DEFAULT_E2E_SUB, ctx.libraryGames);
  await page.goto(AppUrls.profile);
});

Given('my library holds a game', async ({ store }) => {
  await store.seedLibraryGames([newLibraryGame()]);
});

Given('my PlayStation account is linked and harvests trophies', async ({ store }) => {
  await store.seedPsnLink();
  await store.seedPsnPreferences({ harvest_trophies: true });
});

Given('my library holds a game with a matched trophy list', async ({ store, ctx }) => {
  ctx.libraryGames = [
    { ...newLibraryGame(), percent_completed: randomIntBetween(1, LARGEST_PERCENT + 1), trophy_match: TrophyMatches.matched },
  ];
  await store.seedLibraryGames(ctx.libraryGames);
});

Given('my refresh schedule runs daily and has run before', async ({ store }) => {
  await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
    cadence: RefreshCadences.daily,
    next_run_at: SCHEDULE_NEXT_RUN_AT,
    last_run_at: newUtcInstant(),
  });
});

Given('my refresh schedule is paused', async ({ store }) => {
  await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, { next_run_at: SCHEDULE_NEXT_RUN_AT, paused_reason: SCHEDULE_PAUSED_REASON });
});

Given('the Store holds games the catalog does not', async ({ store, ctx }) => {
  ctx.searchTerm = newText();
  const hits = [newStoreHit(ctx.searchTerm), newStoreHit(ctx.searchTerm)];
  await store.seedStoreSearchHits(hits);
  ctx.firstStoreHitId = hits[0].id;
});

Given('the catalog holds two games sharing a word, one of which I own', async ({ store, ctx }) => {
  ctx.searchTerm = newId();
  const owned = { ...newCatalogGame(), canonical_title: `${ctx.searchTerm} ${newId()}` };
  const missing = { ...newCatalogGame(), canonical_title: `${ctx.searchTerm} ${newId()}` };
  await store.seedCatalogGames([owned, missing]);
  await store.seedLibraryGames([{ ...newLibraryGame(), game_id: owned.game_id, title: owned.canonical_title }]);
  ctx.catalogGameId = missing.game_id;
});

Given('the catalog holds a game I already own', async ({ store, ctx }) => {
  const owned = newCatalogGame();
  await store.seedCatalogGames([owned]);
  await store.seedLibraryGames([{ ...newLibraryGame(), game_id: owned.game_id, title: owned.canonical_title }]);
  ctx.searchTerm = owned.canonical_title;
});

When('I open my library', async ({ page }) => {
  await page.goto(AppUrls.library);
});

When('I refresh my library', async ({ page }) => {
  await page.goto(AppUrls.library);
  await page.locator('#library-refresh').click();
});

When('I search my library for that title', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  await page.locator('#library-search').fill(ctx.searchTerm);
});

When('I filter my library by that genre', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  await page.locator('#library-genre-filter').selectOption(ctx.chosenGenre);
});

When('I sort by title', async ({ page }) => {
  await page.locator('#library-sort-title').click();
});

When('I sort by title again', async ({ page }) => {
  await page.locator('#library-sort-title').click();
});

When('I go to the next library page', async ({ page }) => {
  await page.locator('#library-next').click();
});

When('I go to the previous library page', async ({ page }) => {
  await page.locator('#library-prev').click();
});

When('I open my library and choose another page size', async ({ page }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await page.locator('#library-page-size').selectOption(String(LIBRARY_CHOSEN_PAGE_SIZE));
});

When('I choose another library page size', async ({ page }) => {
  await page.locator('#library-page-size').selectOption(String(LIBRARY_CHOSEN_PAGE_SIZE));
});

When('I reload my library', async ({ page }) => {
  await page.reload();
});

async function expectRowOrder(page: Page, games: readonly { game_id: string }[]): Promise<void> {
  await expect.poll(() => rowIds(page.locator(LIBRARY_ROWS))).toEqual(games.map((game) => libraryRowId(game.game_id)));
}

async function openTheFirstLibraryPage(page: Page): Promise<void> {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await expect(page.locator('#library-next')).toBeEnabled();
}

Given('I am looking at my library in title order', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expectRowOrder(page, ctx.libraryGames);
});

Given('I have sorted my library by title', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expectRowOrder(page, ctx.libraryGames);
  await page.locator('#library-sort-title').click();
  await expectRowOrder(page, [...ctx.libraryGames].reverse());
});

Given('I am on the first library page', async ({ page }) => {
  await openTheFirstLibraryPage(page);
});

Given('I am on the second library page', async ({ page, ctx }) => {
  await openTheFirstLibraryPage(page);
  await page.locator('#library-next').click();
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.overflowCount);
});

Given('I have chosen another library page size', async ({ page }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await page.locator('#library-page-size').selectOption(String(LIBRARY_CHOSEN_PAGE_SIZE));
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
});

Given('I have searched for that word, sorted by title in reverse', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await page.locator('#library-search').fill(ctx.searchTerm);
  await expect.poll(() => new URL(page.url()).searchParams.get(LibraryQueryParams.q)).toBe(ctx.searchTerm);
  await page.locator('#library-sort-title').click();
  await expectRowOrder(page, [...ctx.libraryGames].reverse().slice(0, LIBRARY_PAGE_SIZE));
});

Given('I have gone on to the next page of those matches', async ({ page, ctx }) => {
  await page.locator('#library-next').click();
  await expectRowOrder(page, [...ctx.libraryGames].reverse().slice(LIBRARY_PAGE_SIZE));
});

When('I search for that word and sort by title in reverse', async ({ page, ctx }) => {
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await page.locator('#library-search').fill(ctx.searchTerm);
  await expect.poll(() => new URL(page.url()).searchParams.get(LibraryQueryParams.q)).toBe(ctx.searchTerm);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await page.locator('#library-sort-title').click();
});

When('I search for one of the matches by its whole title', async ({ page, ctx }) => {
  const [singledOut] = ctx.libraryGames;
  await page.locator('#library-search').fill(singledOut.title);
});

When('I hide one of them', async ({ page, ctx }) => {
  const [hiddenGame] = ctx.libraryGames;
  await page.goto(AppUrls.library);
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  await expect(page.locator('#library-show-hidden')).toHaveCount(NO_ELEMENTS);
  await page.locator(`#library-hide-${hiddenGame.game_id}`).click();
});

When('I show my hidden games', async ({ page }) => {
  await page.locator('#library-show-hidden').click();
});

When('I show that game again', async ({ page, ctx }) => {
  const [hiddenGame] = ctx.libraryGames;
  await page.locator(`#library-unhide-${hiddenGame.game_id}`).click();
});

When("I search to add one of those games and accept the Store's first proposal", async ({ page, ctx }) => {
  await searchTheManualAddPanelFor(page, ctx.searchTerm);
  await expect(page.locator('#library-store-match')).toBeVisible();
  await expect(page.locator('#library-store-candidate-0')).toHaveAttribute('data-store-id', ctx.firstStoreHitId);
  await page.locator('#library-store-accept-0').click();
  await expect(page.locator('#library-store-match')).toBeHidden();
});

When('I search to add a game by that word', async ({ page, ctx }) => {
  await searchTheManualAddPanelFor(page, ctx.searchTerm);
});

When('I search to add a game by its title', async ({ page, ctx }) => {
  await searchTheManualAddPanelFor(page, ctx.searchTerm);
});

When("I search to add one of those games and decline the Store's proposal", async ({ page, ctx }) => {
  await searchTheManualAddPanelFor(page, ctx.searchTerm);
  await expect(page.locator('#library-store-match')).toBeVisible();
  await page.locator('#library-store-match-cancel').click();
  await expect(page.locator('#library-store-match')).toBeHidden();
});

When('I search to add one of those games', async ({ page, ctx }) => {
  await searchTheManualAddPanelFor(page, ctx.searchTerm);
});

Then('I am told my library is empty', async ({ page }) => {
  await expect(page.locator('#library-empty')).toBeVisible();
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(NO_ELEMENTS);
});

Then('I am told the library was catalogued', async ({ page }) => {
  await expect(page.locator('#library-refresh-status')).toHaveAttribute('data-status', JobStatuses.succeeded);
  await expect(page.locator('#library-refresh-succeeded')).toBeVisible();
});

Then('I am told the refresh failed', async ({ page }) => {
  await expect(page.locator('#library-refresh-status')).toHaveAttribute('data-status', JobStatuses.failed);
  await expect(page.locator('#library-refresh-failed')).toBeVisible();
});

Then('the summary lists as many titles as it shows and counts the rest', async ({ page, ctx }) => {
  await expect(page.locator('#library-refresh-succeeded')).toBeVisible();
  const rawgSummary = page.locator('#library-summary-rawg');
  await expect(rawgSummary).toHaveAttribute('data-shown-count', String(SUMMARY_TITLE_DISPLAY_CAP));
  await expect(rawgSummary).toHaveAttribute('data-more-count', String(ctx.overflowCount));
  const openCriticSummary = page.locator('#library-summary-opencritic');
  await expect(openCriticSummary).toHaveAttribute('data-shown-count', String(ctx.openCriticTitleCount));
  await expect(openCriticSummary).toHaveAttribute('data-more-count', String(NONE_MORE));
});

Then('I am told the OpenCritic top-up is incomplete', async ({ page }) => {
  await expect(page.locator('#library-summary-opencritic-topup')).toBeVisible();
});

Then('I see that game in my library', async ({ page }) => {
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ONE_GAME);
});

Then('the rated game shows its genre, each rating and its catalog link', async ({ page, ctx }) => {
  const [ratedGame] = ctx.libraryGames;
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  const ratedRow = row(page, ratedGame.game_id);
  await expect(ratedRow.locator('[id^="library-genre-"]')).toHaveAttribute('title', String(ratedGame.genre));
  await expect(ratedRow.locator('[id^="library-rawg-"]')).toHaveAttribute('data-score', String(ratedGame.rawg_rating));
  await expect(ratedRow.locator('[id^="library-opencritic-"]')).toHaveAttribute('data-score', String(ratedGame.opencritic_rating));
  await expect(ratedRow.locator('[id^="library-psn-rating-"]')).toHaveAttribute('data-score', String(ratedGame.psn_rating));
  await expect(ratedRow.locator('[id^="library-details-"]')).toHaveAttribute('href', catalogGameUrl(ratedGame.game_id));
});

Then('the unmatched game shows a dash for each rating and still links to the catalog', async ({ page, ctx }) => {
  const [, unmatchedGame] = ctx.libraryGames;
  const unmatchedRow = row(page, unmatchedGame.game_id);
  await expect(unmatchedRow.locator('[id^="library-rawg-"]')).not.toHaveAttribute('data-score');
  await expect(unmatchedRow.locator('[id^="library-opencritic-"]')).not.toHaveAttribute('data-score');
  await expect(unmatchedRow.locator('[id^="library-psn-rating-"]')).not.toHaveAttribute('data-score');
  await expect(unmatchedRow.locator('[id^="library-details-"]')).toHaveAttribute('href', catalogGameUrl(unmatchedGame.game_id));
});

Then('the first game shows each of its platforms', async ({ page, ctx }) => {
  const [multiPlatformGame] = ctx.libraryGames;
  const platforms = multiPlatformGame.platforms ?? [];
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  const tags = row(page, multiPlatformGame.game_id).locator(LIBRARY_PLATFORM_TAGS);
  await expect(tags).toHaveCount(platforms.length);
  await expect.poll(() => tags.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-platform')))).toEqual(
    platforms,
  );
});

Then('the other shows no platform', async ({ page, ctx }) => {
  const [, unplatformedGame] = ctx.libraryGames;
  await expect(row(page, unplatformedGame.game_id).locator(LIBRARY_PLATFORM_TAGS)).toHaveCount(NO_ELEMENTS);
});

Then('each game shows its completion, and the unmatched one a dash', async ({ page, ctx }) => {
  const [partlyCompleted, untouched, unmatched] = ctx.libraryGames;
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.libraryGames.length);
  const completion = (game: LibraryGameFixture) => row(page, game.game_id).locator('[id^="library-percent-completed-"]');
  await expect(completion(partlyCompleted)).toHaveAttribute('data-percent-completed', String(partlyCompleted.percent_completed));
  await expect(completion(untouched)).toHaveAttribute('data-percent-completed', String(UNTOUCHED));
  await expect(completion(unmatched)).not.toHaveAttribute('data-percent-completed');
});

Then('only that game is listed', async ({ page, ctx }) => {
  const [chosenGame] = ctx.libraryGames;
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ONE_GAME);
  await expect(row(page, chosenGame.game_id)).toBeVisible();
});

Then('they are listed in title order', async ({ page, ctx }) => {
  await expect.poll(() => rowIds(page.locator(LIBRARY_ROWS))).toEqual(ctx.libraryGames.map((game) => libraryRowId(game.game_id)));
});

Then('they are listed in reverse title order', async ({ page, ctx }) => {
  await expect
    .poll(() => rowIds(page.locator(LIBRARY_ROWS)))
    .toEqual([...ctx.libraryGames].reverse().map((game) => libraryRowId(game.game_id)));
});

Then('I see a full first page and can only go forward', async ({ page }) => {
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_PAGE_SIZE);
  await expect(page.locator('#library-prev')).toBeDisabled();
  await expect(page.locator('#library-next')).toBeEnabled();
});

Then('I see the rest and can only go back', async ({ page, ctx }) => {
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ctx.overflowCount);
  await expect(page.locator('#library-prev')).toBeEnabled();
  await expect(page.locator('#library-next')).toBeDisabled();
});

Then('the library shows that many games', async ({ page }) => {
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
});

Then('the library still shows that many games', async ({ page }) => {
  await expect(
    page.locator(LIBRARY_ROWS),
    'the choice is stored per browser, so falling back to the default means the control is wired to the request but not to the stored preference',
  ).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
  await expect(page.locator('#library-page-size')).toHaveValue(String(LIBRARY_CHOSEN_PAGE_SIZE));
});

Then('I am back on the first library page, showing that many games', async ({ page }) => {
  await expect(
    page.locator('#library-prev'),
    'keeping the old offset after a resize can land past the end of the result set, which renders an empty page the pager still reports as valid',
  ).toBeDisabled();
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_CHOSEN_PAGE_SIZE);
});

Then('the first page holds the matches from the end of the title order', async ({ page, ctx }) => {
  const descending = [...ctx.libraryGames].reverse().map((game) => libraryRowId(game.game_id));
  await expect.poll(() => rowIds(page.locator(LIBRARY_ROWS))).toEqual(descending.slice(0, LIBRARY_PAGE_SIZE));
});

Then('the next page holds the rest of the matches and I cannot go further', async ({ page, ctx }) => {
  const descending = [...ctx.libraryGames].reverse().map((game) => libraryRowId(game.game_id));
  await expect.poll(() => rowIds(page.locator(LIBRARY_ROWS))).toEqual(descending.slice(LIBRARY_PAGE_SIZE));
  await expect(page.locator('#library-next')).toBeDisabled();
});

Then('only that game is listed, on the first page', async ({ page, ctx }) => {
  const [singledOut] = ctx.libraryGames;
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(ONE_GAME);
  await expect(row(page, singledOut.game_id)).toBeVisible();
  await expect(page.locator('#library-prev')).toBeDisabled();
});

Then('only the other is listed', async ({ page, ctx }) => {
  const [hiddenGame, keptGame] = ctx.libraryGames;
  await expect(row(page, hiddenGame.game_id)).toHaveCount(NO_ELEMENTS);
  await expect(row(page, keptGame.game_id)).toBeVisible();
});

Then('I am offered the one hidden game', async ({ page }) => {
  await expect(page.locator('#library-show-hidden')).toHaveAttribute('data-hidden-count', String(ONE_GAME));
});

Then('only the hidden game is listed, and it offers no hide control', async ({ page, ctx }) => {
  const [hiddenGame, keptGame] = ctx.libraryGames;
  await expect(row(page, hiddenGame.game_id)).toBeVisible();
  await expect(row(page, keptGame.game_id)).toHaveCount(NO_ELEMENTS);
  await expect(page.locator(`#library-hide-${hiddenGame.game_id}`)).toHaveCount(NO_ELEMENTS);
});

Then('I am told nothing is hidden', async ({ page }) => {
  await expect(page.locator('#library-hidden-empty')).toBeVisible();
});

Then('that game is not listed', async ({ page, ctx }) => {
  const [hiddenGame] = ctx.libraryGames;
  await expect(row(page, hiddenGame.game_id)).toHaveCount(NO_ELEMENTS);
});

Then('they see that game', async ({ secondAuthedPage, ctx }) => {
  const [ownedGame] = ctx.libraryGames;
  await expect(secondAuthedPage.locator(`#${libraryRowId(ownedGame.game_id)}`)).toBeVisible();
});

Then('they are offered no way to hide it or see what I hid', async ({ secondAuthedPage, ctx }) => {
  const [ownedGame] = ctx.libraryGames;
  await expect(secondAuthedPage.locator(`#library-hide-${ownedGame.game_id}`)).toHaveCount(NO_ELEMENTS);
  await expect(secondAuthedPage.locator('#library-show-hidden')).toHaveCount(NO_ELEMENTS);
});

Then("the completion column offers the account's trophy setting", async ({ page }) => {
  await expect(page.locator('#library-header-percent_completed-link')).toHaveAttribute('href', `${AppUrls.account}#pref-trophies`);
});

Then('the game shows its completion', async ({ page, ctx }) => {
  const [game] = ctx.libraryGames;
  await expect(page.locator('#library-percent-completed-0')).toHaveAttribute('data-percent-completed', String(game.percent_completed));
});

Then('the completion column offers no trophy setting', async ({ page }) => {
  await expect(page.locator('#library-header-percent_completed-link')).toHaveCount(NO_ELEMENTS);
});

Then('I see when the next refresh runs', async ({ page }) => {
  await expect(page.locator('#library-schedule-next')).toHaveAttribute('data-next-run-at', SCHEDULE_NEXT_RUN_AT);
  await expect(page.locator('#library-schedule-none')).toHaveCount(NO_ELEMENTS);
});

Then('I am offered my account page to change the schedule', async ({ page }) => {
  await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', AppUrls.account);
});

Then('I am told the schedule is paused, and why', async ({ page }) => {
  await expect(page.locator('#library-schedule-paused')).toHaveAttribute('data-paused-reason', SCHEDULE_PAUSED_REASON);
  await expect(page.locator('#library-schedule-next')).toHaveCount(NO_ELEMENTS);
});

Then('I am invited to set up a refresh schedule', async ({ page }) => {
  await expect(page.locator('#library-schedule-none')).toBeVisible();
  await expect(page.locator('#library-schedule-next')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#library-schedule-paused')).toHaveCount(NO_ELEMENTS);
});

Then('that game is in my library, marked as added by hand', async ({ page, ctx }) => {
  const admittedRow = row(page, admittedGameId(ctx.firstStoreHitId));
  await expect(admittedRow).toBeVisible();
  await expect(admittedRow.locator('[id^="library-manual-badge-"]')).toBeVisible();
});

Then('I am offered only the one I do not own', async ({ page, ctx }) => {
  await expect(page.locator('[id^="library-manual-add-"]')).toHaveCount(ONE_GAME);
  await expect(page.locator('#library-manual-add-0')).toHaveAttribute('data-game-id', ctx.catalogGameId);
});

Then('I am told I already own every match', async ({ page }) => {
  await expect(page.locator('#library-manual-all-owned')).toBeVisible();
  await expect(page.locator('[id^="library-manual-add-"]')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#library-store-match')).toBeHidden();
});

Then('I am offered to check the Store instead', async ({ page }) => {
  await expect(page.locator('#library-manual-check-store')).toBeVisible();
});

Then('my library is still empty', async ({ page }) => {
  await expect(page.locator(LIBRARY_ROWS)).toHaveCount(NO_ELEMENTS);
});

Then('I am told the Store cannot be checked without a linked account', async ({ page }) => {
  await expect(page.locator('#library-store-unlinked')).toBeVisible();
  await expect(page.locator('#library-store-match')).toBeHidden();
});
