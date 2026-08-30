import { test, expect } from './fixtures.js';

const LIBRARY_ROWS = '[id^="library-row-"]';
const LIBRARY_PLATFORM_TAGS = '[id^="library-platform-"]';

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

    const eldenRow = rows.filter({ hasText: 'Elden Ring' });
    await expect(eldenRow).toContainText('Action RPG');
    await expect(eldenRow).toContainText('96');
    await expect(eldenRow).toContainText('94');
    await expect(eldenRow).toContainText('4.8');
    await expect(eldenRow.locator('[id^="library-details-"]')).toHaveAttribute('href', '/catalog/g1');

    const unmatchedRow = rows.filter({ hasText: 'Unmatched Game' });
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

    const multi = rows.filter({ hasText: '99Vidas' }).locator('td[data-label="Platforms"]');
    await expect(multi.locator(LIBRARY_PLATFORM_TAGS)).toHaveText(['PS4', 'PS3', 'PSVITA']);

    const none = rows.filter({ hasText: 'Unplatformed Game' }).locator('td[data-label="Platforms"]');
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

    await expect(rows.filter({ hasText: 'Elden Ring' }).locator('td[data-label="% Completed"]')).toHaveText('42%');

    await expect(rows.filter({ hasText: 'Bloodborne' }).locator('td[data-label="% Completed"]')).toHaveText('0%');
    await expect(rows.filter({ hasText: 'Unmatched Game' }).locator('td[data-label="% Completed"]')).toHaveText('—');
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
