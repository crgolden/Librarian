import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

const GAMES_FILLING_ONE_PAGE = 50;
const SHORT_VIEWPORT = { width: 1280, height: 400 };
const SCROLL_DISTANCE_PX = 200;
const RESTORATION_TOLERANCE_PX = 5;

const FULL_PAGE_OF_GAMES = Array.from({ length: GAMES_FILLING_ONE_PAGE }, (_, i) => ({
  game_id: `g${i}`,
  canonical_title: `Game ${String(i).padStart(2, '0')}`,
  franchise: null,
  genre: 'RPG',
  aaa_tier: 'AAA',
}));

async function clickTheFirstFullyVisibleCatalogTitleInPage(page: Page): Promise<{ scrollY: number; title: string }> {
  return page.evaluate(() => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>('[id^="catalog-title-"]')].find((anchor) => {
      const box = anchor.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    if (link === undefined) {
      throw new Error('no catalog title is fully inside the viewport, so nothing can be clicked without moving it');
    }
    const title = link.textContent?.trim() ?? '';
    link.click();
    return { scrollY: Math.round(window.scrollY), title };
  });
}

test.describe('Catalog scroll restoration', () => {
  test('Back from a game page lands where the reader was, not at the top', async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(FULL_PAGE_OF_GAMES);
    await page.setViewportSize(SHORT_VIEWPORT);
    await page.goto('/catalog');
    await expect(page.locator('#catalog-title-0')).toBeVisible();

    const readerPosition = await page.evaluate((distance) => {
      window.scrollBy(0, distance);
      return Math.round(window.scrollY);
    }, SCROLL_DISTANCE_PX);
    expect(
      readerPosition,
      'the catalog did not overflow the shortened viewport, so a restored position is indistinguishable from a reset one',
    ).toBeGreaterThan(0);

    const leaving = await clickTheFirstFullyVisibleCatalogTitleInPage(page);
    expect(leaving.scrollY, 'the in-page click must not move the viewport, or the test measures the driver').toBe(readerPosition);
    await expect(page.locator('#page-title')).toHaveText(leaving.title);

    await page.goBack();

    await expect(page.locator('#catalog-title-0')).toBeVisible();
    await page.waitForFunction(
      ({ expected, tolerance }) => Math.abs(window.scrollY - expected) <= tolerance,
      { expected: readerPosition, tolerance: RESTORATION_TOLERANCE_PX },
    );
  });
});
