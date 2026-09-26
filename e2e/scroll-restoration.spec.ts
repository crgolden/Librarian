import type { Page } from '@playwright/test';
import { test, expect, newCatalogGame } from './fixtures.js';
import { dehydratedMarkersLeft } from './hydration.js';
import e2eSettings from './e2e-settings.json';
import { AppUrls } from '../src/app/app-paths';
import { CATALOG_PAGE_SIZE } from '../src/catalog/catalog.query';
import { CATALOG_TITLE_ID_PREFIX } from '../src/catalog/catalog-ids';
import { ScrollRestorationModes } from '@crgolden/modules/scroll-restoration';

const SHORT_VIEWPORT = e2eSettings.viewports.shortCatalog;
const SCROLL_DISTANCE_PX = e2eSettings.scrollRestoration.scrollDistancePx;
const WITHIN_FIVE_PIXELS = -1;

const FULL_PAGE_OF_GAMES = Array.from({ length: CATALOG_PAGE_SIZE }, newCatalogGame);

const ROUTER_OWNED_SCROLL_RESTORATION = ScrollRestorationModes.manual;

type CatalogTitle = { id: string; href: string };

async function theFirstFullyVisibleCatalogTitle(page: Page): Promise<CatalogTitle> {
  return page.evaluate((idPrefix) => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`[id^="${idPrefix}"]`)].find((anchor) => {
      const box = anchor.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    if (link === undefined) {
      throw new Error('no catalog title is fully inside the viewport, so nothing can be clicked without moving it');
    }
    return { id: link.id, href: link.href };
  }, CATALOG_TITLE_ID_PREFIX);
}

async function expectTheGamePageFor(page: Page, leaving: CatalogTitle): Promise<void> {
  await expect(page).toHaveURL(leaving.href);
  await expect(page.locator('#catalog-detail-ratings')).toBeVisible();
}

async function clickInPage(page: Page, id: string): Promise<number> {
  return page.evaluate((linkId) => {
    const link = document.getElementById(linkId);
    if (link === null) {
      throw new Error(`#${linkId} left the page between being found and being clicked`);
    }
    link.click();
    return Math.round(window.scrollY);
  }, id);
}

async function scrollTheReaderDownTheCatalog(page: Page): Promise<number> {
  const readerPosition = await page.evaluate((distance) => {
    window.scrollBy(0, distance);
    return Math.round(window.scrollY);
  }, SCROLL_DISTANCE_PX);
  expect(
    readerPosition,
    'the catalog did not overflow the shortened viewport, so a restored position is indistinguishable from a reset one',
  ).toBeGreaterThan(0);
  return readerPosition;
}

async function expectBackToLandAt(page: Page, readerPosition: number, markersAtTheLeave: number): Promise<void> {
  await page.goBack();

  await expect(page.locator('#catalog-title-0')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.history.scrollRestoration), {
      message: `after Back the router, not the browser, must own restoration: history.scrollRestoration must become '${ROUTER_OWNED_SCROLL_RESTORATION}'`,
    })
    .toBe(ROUTER_OWNED_SCROLL_RESTORATION);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), {
      message: `Back did not land within five pixels of the reader's ${readerPosition}px (${markersAtTheLeave} dehydrated markers were in the DOM when the reader left)`,
    })
    .toBeCloseTo(readerPosition, WITHIN_FIVE_PIXELS);
}

test.describe('Catalog scroll restoration', () => {
  test.beforeEach(async ({ anonymousPage: page, store }) => {
    await store.reset();
    await store.seedCatalogGames(FULL_PAGE_OF_GAMES);
    await page.setViewportSize(SHORT_VIEWPORT);
    await page.goto(AppUrls.catalog);
    await expect(page.locator('#catalog-title-0')).toBeVisible();
  });

  test('Back from a game page lands where the reader was, not at the top', async ({ anonymousPage: page }) => {
    const readerPosition = await scrollTheReaderDownTheCatalog(page);

    const leaving = await theFirstFullyVisibleCatalogTitle(page);
    const markersAtTheClick = await dehydratedMarkersLeft(page);
    const positionAtTheClick = await clickInPage(page, leaving.id);
    expect(positionAtTheClick, 'the in-page click must not move the viewport, or the test measures the driver').toBe(
      readerPosition,
    );
    await expectTheGamePageFor(page, leaving);

    await expectBackToLandAt(page, readerPosition, markersAtTheClick);
  });

  test('Back after leaving the document lands where the reader was, although the router had taken restoration over', async ({
    anonymousPage: page,
  }) => {
    await page.waitForFunction(
      (routerOwned) => window.history.scrollRestoration === routerOwned,
      ROUTER_OWNED_SCROLL_RESTORATION,
    );
    const readerPosition = await scrollTheReaderDownTheCatalog(page);

    const leaving = await theFirstFullyVisibleCatalogTitle(page);
    const markersAtTheLeave = await dehydratedMarkersLeft(page);
    await page.goto(leaving.href);
    await expectTheGamePageFor(page, leaving);

    await expectBackToLandAt(page, readerPosition, markersAtTheLeave);
  });
});
