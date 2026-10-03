import { hasPrefix, isVisible, pickFromPrefix, prefixLocator, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect, type Locator, type Page } from '@playwright/test';
import walkerSettings from './walker-settings.json';
import { PlaywrightConstants } from '../playwright-constants';
import { AppUrls } from '../../src/app/app-paths';
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
      await page.fill('#library-search', rng.pick(walkerSettings.librarySearchTerms));
      await expectRendered(page.locator('#page-title'));
    },
  },
  {
    name: 'filter the library by genre',
    available: page => isVisible(page, '#library-genre-filter'),
    run: async (page, rng) => {
      const options = page.locator('#library-genre-filter option');
      await options.first().waitFor();
      const optionCount = await options.count();
      await page.selectOption('#library-genre-filter', { index: rng.int(optionCount) });
      await expectRendered(page.locator('#page-title'));
    },
  },
  {
    name: 'next library page',
    available: async page => (await isVisible(page, '#library-next')) && (await page.locator('#library-next').isEnabled()),
    run: async page => {
      await page.click('#library-next');
      await expectRendered(page.locator('#page-title'));
    },
  },
  {
    name: 'previous library page',
    available: async page => (await isVisible(page, '#library-prev')) && (await page.locator('#library-prev').isEnabled()),
    run: async page => {
      await page.click('#library-prev');
      await expectRendered(page.locator('#page-title'));
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
