/**
 * Sitewide navigation E2E — the persistent nav (SiteNavComponent) must surface every primary
 * destination on every authenticated page, not just as CTAs on the Home page, and Profile must be
 * reachable without a deep link. Covers the regression this replaces: previously the header nav
 * only ever showed PSN Settings + Sign out, and Profile had no entry point anywhere.
 */

import { test, expect } from './fixtures.js';

const PRIMARY_LINKS = ['Home', 'Catalog', 'Collections', 'Library', 'Profile'];

test.describe('SiteNavComponent — desktop', () => {
  for (const startPath of ['/', '/catalog', '/collections', '/library', '/profile']) {
    test(`all primary destinations are reachable from the header nav on ${startPath}`, async ({ authedPage: page, store }) => {
      await store.reset();

      await page.goto(startPath);
      for (const label of PRIMARY_LINKS) {
        await expect(page.locator('.site-nav-desktop').getByRole('link', { name: label, exact: true })).toBeVisible();
      }
    });
  }

  test('clicking Profile in the header nav navigates to /profile without a deep link', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    await page.locator('.site-nav-desktop').getByRole('link', { name: 'Profile', exact: true }).click();
    await page.waitForURL('**/profile', { timeout: 10_000 });
  });

  test('the active route is visually marked in the header nav', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    const catalogLink = page.locator('.site-nav-desktop').getByRole('link', { name: 'Catalog', exact: true });
    await expect(catalogLink).toHaveClass(/nav-active/);

    const homeLink = page.locator('.site-nav-desktop').getByRole('link', { name: 'Home', exact: true });
    await expect(homeLink).not.toHaveClass(/nav-active/);
  });
});

test.describe('SiteNavComponent — mobile bottom tab bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders a 5-item bottom tab bar instead of the desktop nav', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('.site-nav-tabbar')).toBeVisible();
    await expect(page.locator('.site-nav-desktop')).toBeHidden();
    await expect(page.locator('.site-nav-tabbar a.tab-link')).toHaveCount(5);
  });

  test('tapping a tab navigates correctly', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('.site-nav-tabbar').getByRole('link', { name: 'Library', exact: true }).click();
    await page.waitForURL('**/library', { timeout: 10_000 });
  });
});

test.describe('SiteNavComponent — anonymous', () => {
  test('shows only Sign in, no primary destinations', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    for (const label of ['Catalog', 'Collections', 'Library']) {
      await expect(page.locator('.site-nav-desktop').getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
  });
});
