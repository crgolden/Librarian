import { hasPrefix, isVisible, pickFromPrefix, prefixLocator, type Rng, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect, type Locator, type Page } from '@playwright/test';
import walkerSettings from './walker-settings.json';
import { PlaywrightConstants } from '../playwright-constants';
import { AppUrls } from '../../src/app/app-paths';
import { CuratorApi } from '../../src/curator/curator-api';
import { HttpMethods } from '../../src/bff/http-headers';
import { NAV_RAIL_SIGNOUT_ID, SiteNavIdPrefixes } from '../../src/app/nav/site-nav-ids';
import { CATALOG_TITLE_ID_PREFIX } from '../../src/catalog/catalog-ids';

const ACTION_WEIGHTS: Readonly<Record<string, number | undefined>> = walkerSettings.actionWeights;

function weightOf(actionName: string): number {
  const weight = ACTION_WEIGHTS[actionName];
  if (weight === undefined) {
    throw new Error(`walker-settings.json names no weight for the '${actionName}' action.`);
  }
  return weight;
}

async function expectRendered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

async function followLink(page: Page, link: Locator): Promise<void> {
  const destination = await link.getAttribute('href');
  await link.click();
  await expect(page).toHaveURL((url) => url.pathname === destination);
  await expectRendered(page.locator('#page-title'));
}

async function expectLibraryReloaded(page: Page, act: () => Promise<void>): Promise<void> {
  const reloaded = page.waitForResponse(
    response => response.request().method() === HttpMethods.get && new URL(response.url()).pathname.endsWith(CuratorApi.library),
  );
  await act();
  await reloaded;
  await expect(page.locator('#loading-overlay')).toHaveCount(0);
  await expectRendered(page.locator('#page-title'));
}

function indexOtherThan(rng: Rng, count: number, current: number): number {
  const drawn = rng.int(count - 1);
  return drawn >= current ? drawn + 1 : drawn;
}

const NAV_RAIL_SELECTOR = `[id^="${SiteNavIdPrefixes.railLink}"]:not([id^="${SiteNavIdPrefixes.railIcon}"]):not([id^="${SiteNavIdPrefixes.railLabel}"]):not(#${NAV_RAIL_SIGNOUT_ID})`;

const unweightedActions: readonly Omit<WalkerAction, 'weight'>[] = [
  {
    name: 'go home',
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto(AppUrls.home);
      await expectRendered(page.locator('#page-title'));
    },
  },
  {
    name: 'navigate via the rail',
    available: async page => (await page.locator(NAV_RAIL_SELECTOR).count()) > 0,
    run: async (page, rng) => {
      const links = page.locator(NAV_RAIL_SELECTOR);
      await links.first().waitFor();
      const count = await links.count();
      await followLink(page, links.nth(rng.int(count)));
    },
  },
  {
    name: 'browse the catalog',
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto(AppUrls.catalog);
      await expectRendered(page.locator('#page-title'));
    },
  },
  {
    name: 'open a catalog game',
    available: page => hasPrefix(page, CATALOG_TITLE_ID_PREFIX),
    run: async (page, rng) => {
      await followLink(page, await pickFromPrefix(page, rng, CATALOG_TITLE_ID_PREFIX));
    },
  },
  {
    name: 'search the library',
    available: page => isVisible(page, '#library-search'),
    run: async (page, rng) => {
      const current = await page.inputValue('#library-search');
      const term = rng.pick(walkerSettings.librarySearchTerms.filter(candidate => candidate !== current));
      await expectLibraryReloaded(page, () => page.fill('#library-search', term));
    },
  },
  {
    name: 'filter the library by genre',
    available: async page => (await isVisible(page, '#library-genre-filter')) && (await page.locator('#library-genre-filter option').count()) > 1,
    run: async (page, rng) => {
      const filter = page.locator('#library-genre-filter');
      const optionCount = await filter.locator('option').count();
      const current = await filter.evaluate(select => (select as HTMLSelectElement).selectedIndex);
      await expectLibraryReloaded(page, async () => {
        await filter.selectOption({ index: indexOtherThan(rng, optionCount, current) });
      });
    },
  },
  {
    name: 'next library page',
    available: async page => (await isVisible(page, '#library-next')) && (await page.locator('#library-next').isEnabled()),
    run: async page => {
      await expectLibraryReloaded(page, () => page.click('#library-next'));
    },
  },
  {
    name: 'previous library page',
    available: async page => (await isVisible(page, '#library-prev')) && (await page.locator('#library-prev').isEnabled()),
    run: async page => {
      await expectLibraryReloaded(page, () => page.click('#library-prev'));
    },
  },
  {
    name: 'read the FAQ',
    available: () => Promise.resolve(true),
    run: async (page, rng) => {
      await page.goto(AppUrls.faq);
      await expectRendered(page.locator('#faq-content'));
      const tocLinks = prefixLocator(page, 'toc-link-');
      await tocLinks.first().waitFor();
      const tocCount = await tocLinks.count();
      await tocLinks.nth(rng.int(tocCount)).click();
    },
  },
  {
    name: 'flip the color scheme',
    available: () => Promise.resolve(true),
    run: async (page, rng) => {
      await page.emulateMedia({ colorScheme: rng.pick(Object.values(PlaywrightConstants.colorSchemes)) });
      await page.goto(AppUrls.home);
      await expectRendered(page.locator('#page-title'));
    },
  },
];

export const librarianActions: readonly WalkerAction[] = unweightedActions.map(action => ({
  ...action,
  weight: weightOf(action.name),
}));
