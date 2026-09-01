import { hasPrefix, isVisible, pickFromPrefix, prefixLocator, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect } from '@playwright/test';

const LIBRARY_SEARCH_TERMS = ['the', 'star', 'war', 'legend', 'world', 'dark', 'final', 'quest'] as const;
const NAV_RAIL_SELECTOR = '[id^="nav-rail-"]:not([id^="nav-rail-icon-"]):not([id^="nav-rail-label-"]):not(#nav-rail-signout)';

export const librarianActions: readonly WalkerAction[] = [
  {
    name: 'go home',
    weight: 2,
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto('/');
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'navigate via the rail',
    weight: 4,
    available: async page => (await page.locator(NAV_RAIL_SELECTOR).count()) > 0,
    run: async (page, rng) => {
      const links = page.locator(NAV_RAIL_SELECTOR);
      const count = await links.count();
      await links.nth(rng.int(count)).click();
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'browse the catalog',
    weight: 3,
    available: () => Promise.resolve(true),
    run: async page => {
      await page.goto('/catalog');
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'open a catalog game',
    weight: 5,
    available: page => hasPrefix(page, 'catalog-title-'),
    run: async (page, rng) => {
      const title = await pickFromPrefix(page, rng, 'catalog-title-');
      await title.click();
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'search the library',
    weight: 3,
    available: page => isVisible(page, '#library-search'),
    run: async (page, rng) => {
      await page.fill('#library-search', rng.pick(LIBRARY_SEARCH_TERMS));
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'filter the library by genre',
    weight: 2,
    available: page => isVisible(page, '#library-genre-filter'),
    run: async (page, rng) => {
      const options = page.locator('#library-genre-filter option');
      const optionCount = await options.count();
      await page.selectOption('#library-genre-filter', { index: rng.int(optionCount) });
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'next library page',
    weight: 2,
    available: async page => (await isVisible(page, '#library-next')) && (await page.locator('#library-next').isEnabled()),
    run: async page => {
      await page.click('#library-next');
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'previous library page',
    weight: 1,
    available: async page => (await isVisible(page, '#library-prev')) && (await page.locator('#library-prev').isEnabled()),
    run: async page => {
      await page.click('#library-prev');
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
  {
    name: 'read the FAQ',
    weight: 2,
    available: () => Promise.resolve(true),
    run: async (page, rng) => {
      await page.goto('/faq');
      await expect(page.locator('#faq-content')).toBeVisible();
      const tocLinks = prefixLocator(page, 'toc-link-');
      const tocCount = await tocLinks.count();
      if (tocCount > 0) {
        await tocLinks.nth(rng.int(tocCount)).click();
      }
    },
  },
  {
    name: 'flip the color scheme',
    weight: 1,
    available: () => Promise.resolve(true),
    run: async (page, rng) => {
      await page.emulateMedia({ colorScheme: rng.pick(['light', 'dark'] as const) });
      await page.goto('/');
      await expect(page.locator('#page-title')).toBeVisible();
    },
  },
];
