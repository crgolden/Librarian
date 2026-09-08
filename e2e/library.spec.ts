import { test, expect, DEFAULT_E2E_SUB } from './fixtures.js';

const LIBRARY_ROWS = '[id^="library-row-"]';
const LIBRARY_PLATFORM_TAGS = '[id^="library-platform-"]';

const SCHEDULE_NEXT_RUN_AT_MIDDAY_UTC = '2031-06-15T12:00:00+00:00';
const SCHEDULE_NEXT_RUN_RENDERED = 'Jun 15, 2031';
const SCHEDULE_LAST_RUN_AT_MIDDAY_UTC = '2029-06-15T12:00:00+00:00';
const SCHEDULE_LAST_RUN_RENDERED = 'Jun 15, 2029';
const SCHEDULE_PAUSED_REASON = 'psn_token_expired';

const RAWG_HOME = 'https://rawg.io';

const LIBRARY_DEFAULT_PAGE_SIZE = 20;
const LIBRARY_CHOSEN_PAGE_SIZE = 50;
const PAGED_LIBRARY_TITLES = LIBRARY_CHOSEN_PAGE_SIZE + LIBRARY_DEFAULT_PAGE_SIZE;

function pagedLibraryTitles() {
  return Array.from({ length: PAGED_LIBRARY_TITLES }, (_, index) => ({
    game_id: `g${index}`,
    title: `Game ${String(index).padStart(2, '0')}`,
    rawg_enriched: false,
    opencritic_enriched: false,
  }));
}

test.describe('Library — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await page.waitForURL('**/bff/login**', { timeout: 10_000 });
  });
});

test.describe('Library — authenticated', () => {
  test('refreshing resolves to a success message', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.locator('#page-title')).toContainText('My Library');
    await page.locator('#library-refresh').click();

    await expect(page.locator('text=Library catalogued.')).toBeVisible({ timeout: 10_000 });
  });

  test('a RAWG-enriched entry brings the backlink their terms require', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: 'Elden Ring',
        genre: 'Action RPG',
        rawg_rating: 96,
        rawg_enriched: true,
        opencritic_enriched: false,
      },
    ]);

    await page.goto('/library');

    await expect(page.locator('#rawg-attribution a')).toHaveAttribute('href', RAWG_HOME);
  });

  test('a library nothing RAWG enriched claims no RAWG data', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: 'Elden Ring',
        genre: 'Action RPG',
        opencritic_rating: 94,
        rawg_enriched: false,
        opencritic_enriched: true,
      },
    ]);

    await page.goto('/library');

    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator('#rawg-attribution')).toHaveCount(0);
  });

  test('refreshing surfaces the job error on a failed run', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.setLibraryRefreshOutcome('failed', 'PSN entitlement fetch failed.');

    await page.goto('/library');
    await page.locator('#library-refresh').click();

    await expect(page.locator('text=PSN entitlement fetch failed.')).toBeVisible({ timeout: 10_000 });
  });

  test('shows a message when the library is empty', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');
    await expect(page.locator('#library-empty')).toHaveText('No games yet — run a refresh to build your library.');
  });

  test('renders ratings, genre, and a catalog link, with a dash for unresolved values', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: 'Elden Ring',
        genre: 'Action RPG',
        rawg_rating: 96,
        opencritic_rating: 94,
        psn_rating: 4.8,
        psn_product_id: 'UP0700-CUSA23100_00-ELDENRING0000000',
        rawg_enriched: true,
        opencritic_enriched: true,
      },
      { game_id: 'g2', title: 'Unmatched Game', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(2);

    const eldenRow = page.locator('#library-row-g1');
    await expect(eldenRow).toContainText('Action RPG');
    await expect(eldenRow).toContainText('96');
    await expect(eldenRow).toContainText('94');
    await expect(eldenRow).toContainText('4.8');
    await expect(eldenRow.locator('[id^="library-details-"]')).toHaveAttribute('href', '/catalog/g1');

    const unmatchedRow = page.locator('#library-row-g2');
    await expect(unmatchedRow).toContainText('—');
    await expect(unmatchedRow.locator('[id^="library-details-"]')).toHaveAttribute('href', '/catalog/g2');
  });

  test('renders every platform an entry is owned on, and a dash for none', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: '99Vidas',
        rawg_enriched: false,
        opencritic_enriched: false,
        platforms: ['PS4', 'PS3', 'PSVITA'],
      },
      { game_id: 'g2', title: 'Unplatformed Game', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(2);

    const multi = page.locator('#library-row-g1').locator('td[data-label="Platforms"]');
    await expect(multi.locator(LIBRARY_PLATFORM_TAGS)).toHaveText(['PS4', 'PS3', 'PSVITA']);

    const none = page.locator('#library-row-g2').locator('td[data-label="Platforms"]');
    await expect(none.locator(LIBRARY_PLATFORM_TAGS)).toHaveCount(0);
    await expect(none).toHaveText('—');
  });

  test('renders trophy completion percentage, with a dash when no match was found', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', rawg_enriched: false, opencritic_enriched: false, percent_completed: 42 },
      { game_id: 'g2', title: 'Bloodborne', rawg_enriched: false, opencritic_enriched: false, percent_completed: 0 },
      { game_id: 'g3', title: 'Unmatched Game', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const rows = page.locator(LIBRARY_ROWS);
    await expect(rows).toHaveCount(3);

    await expect(page.locator('#library-row-g1').locator('td[data-label="% Completed"]')).toHaveText('42%');

    await expect(page.locator('#library-row-g2').locator('td[data-label="% Completed"]')).toHaveText('0%');
    await expect(page.locator('#library-row-g3').locator('td[data-label="% Completed"]')).toHaveText('—');
  });

  test('searches by title', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Bloodborne', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(2);

    await page.locator('#library-search').fill('elden');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(LIBRARY_ROWS)).toContainText('Elden Ring');
  });

  test('filters by genre', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Elden Ring', genre: 'Action RPG', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Tetris Effect', genre: 'Puzzle', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(2);

    await page.locator('#library-genre-filter').selectOption('Puzzle');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1);
    await expect(page.locator(LIBRARY_ROWS)).toContainText('Tetris Effect');
  });

  test('a raw genre token is ellipsised in the Genre column while the cell keeps the whole token', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedLibraryGames([
      {
        game_id: 'g1',
        title: 'A Raw Token Entry',
        genre: 'ROLE_PLAYING_GAMES',
        rawg_enriched: false,
        opencritic_enriched: false,
      },
      {
        game_id: 'g2',
        title: 'B Ordinary Genre Entry',
        genre: 'Action RPG',
        rawg_enriched: false,
        opencritic_enriched: false,
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/library');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(2);

    const rawToken = page.locator('#library-genre-0');
    const ordinaryGenre = page.locator('#library-genre-1');

    await expect(rawToken).toHaveText('ROLE_PLAYING_GAMES');
    await expect(rawToken).toHaveAttribute('title', 'ROLE_PLAYING_GAMES');

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

    await page.evaluate(() => {
      for (const cell of document.querySelectorAll<HTMLElement>('[id^="library-genre-"]')) {
        cell.style.maxWidth = 'none';
      }
    });
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
    await store.seedLibraryGames([
      { game_id: 'g1', title: 'Bloodborne', rawg_enriched: false, opencritic_enriched: false },
      { game_id: 'g2', title: 'Elden Ring', rawg_enriched: false, opencritic_enriched: false },
    ]);

    await page.goto('/library');
    const titles = page.locator('[id^="library-title-"]');
    await expect(titles).toHaveText(['Bloodborne', 'Elden Ring']);

    const titleHeader = page.locator('#library-header-title');
    await titleHeader.click();
    await expect(titles).toHaveText(['Elden Ring', 'Bloodborne']);

    await titleHeader.click();
    await expect(titles).toHaveText(['Bloodborne', 'Elden Ring']);
  });

  test('pages through results', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames(
      Array.from({ length: 25 }, (_, i) => ({
        game_id: `g${i}`,
        title: `Game ${String(i).padStart(2, '0')}`,
        rawg_enriched: false,
        opencritic_enriched: false,
      })),
    );

    await page.goto('/library');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(20);
    await expect(page.locator('#library-prev')).toBeDisabled();
    await expect(page.locator('#library-next')).toBeEnabled();

    await page.locator('#library-next').click();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(5);
    await expect(page.locator('#library-prev')).toBeEnabled();
    await expect(page.locator('#library-next')).toBeDisabled();

    await page.locator('#library-prev').click();
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(20);
  });

  test('the per-page choice resizes the page and outlives a reload', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedLibraryGames(pagedLibraryTitles());

    await page.goto('/library');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(LIBRARY_DEFAULT_PAGE_SIZE);

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

    await page.goto('/library');
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
    await store.seedLibraryGames(
      Array.from({ length: 25 }, (_, i) => ({
        game_id: `g${i}`,
        title: `Ring Game ${String(i).padStart(2, '0')}`,
        rawg_enriched: false,
        opencritic_enriched: false,
      })).concat([
        { game_id: 'other-1', title: 'Something Else', rawg_enriched: false, opencritic_enriched: false },
        { game_id: 'other-2', title: 'Another Unrelated Game', rawg_enriched: false, opencritic_enriched: false },
      ]),
    );

    await page.goto('/library');

    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(20);

    await page.locator('#library-search').fill('ring');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(20, { timeout: 5_000 });

    const titleHeader = page.locator('#library-header-title');
    await titleHeader.click();
    const titles = page.locator('[id^="library-title-"]');
    await expect(titles).toHaveText(Array.from({ length: 20 }, (_, i) => `Ring Game ${String(24 - i).padStart(2, '0')}`));

    await page.locator('#library-next').click();
    await expect(titles).toHaveText(Array.from({ length: 5 }, (_, i) => `Ring Game ${String(4 - i).padStart(2, '0')}`));
    await expect(page.locator('#library-next')).toBeDisabled();

    await page.locator('#library-search').fill('ring game 01');
    await expect(page.locator(LIBRARY_ROWS)).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(LIBRARY_ROWS)).toContainText('Ring Game 01');
    await expect(page.locator('#library-prev')).toBeDisabled();
  });

  test('shows the post-refresh summary, capping the inline title list, and the OpenCritic top-up message', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const manyTitles = Array.from({ length: 12 }, (_, i) => `Game ${i + 1}`);
    await store.setLibraryRefreshOutcome('succeeded', undefined, {
      rawg_enriched_titles: manyTitles,
      opencritic_enriched_titles: ['Elden Ring'],
      opencritic_topup_incomplete: true,
    });

    await page.goto('/library');
    await page.locator('#library-refresh').click();

    await expect(page.locator('#library-refresh-succeeded')).toHaveText('Library catalogued.', { timeout: 10_000 });
    await expect(page.locator('#library-summary-rawg')).toContainText('+2 more');
    await expect(page.locator('#library-summary-opencritic')).toContainText('Elden Ring');
    await expect(page.locator('#library-summary-opencritic-topup')).toContainText(
      'OpenCritic still has more of your library to check',
    );
  });
});

test.describe('Library — the refresh schedule summary', () => {
  test('reads the next run, not the last one, and offers the account page to change it', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
      cadence: 'daily',
      next_run_at: SCHEDULE_NEXT_RUN_AT_MIDDAY_UTC,
      last_run_at: SCHEDULE_LAST_RUN_AT_MIDDAY_UTC,
    });

    await page.goto('/library');

    const summary = page.locator('#library-schedule-next');
    await expect(summary).toContainText(SCHEDULE_NEXT_RUN_RENDERED);
    await expect(summary).not.toContainText(SCHEDULE_LAST_RUN_RENDERED);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', '/account');
    await expect(page.locator('#library-schedule-none')).toHaveCount(0);
  });

  test('reports a paused schedule as paused rather than as a due date', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await store.seedUserRefreshSchedule(DEFAULT_E2E_SUB, {
      next_run_at: SCHEDULE_NEXT_RUN_AT_MIDDAY_UTC,
      paused_reason: SCHEDULE_PAUSED_REASON,
    });

    await page.goto('/library');

    await expect(page.locator('#library-schedule-paused')).toContainText('paused');
    await expect(page.locator('#library-schedule-next')).toHaveCount(0);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', '/account');
    await expect(page.locator('body')).not.toContainText(SCHEDULE_PAUSED_REASON);
  });

  test('invites a user with no schedule to set one up', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/library');

    await expect(page.locator('#library-schedule-none')).toBeVisible();
    await expect(page.locator('#library-schedule-next')).toHaveCount(0);
    await expect(page.locator('#library-schedule-paused')).toHaveCount(0);
    await expect(page.locator('#library-schedule-link')).toHaveAttribute('href', '/account');
  });
});
