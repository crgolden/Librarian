import { expect } from '@playwright/test';
import e2eSettings from '../e2e-settings.json';
import { AppUrls } from '../../src/app/app-paths';
import { ANONYMOUS_NAV_LINKS, PRIMARY_NAV_LINKS, type NavLink } from '../../src/app/nav/nav-links';
import { Given, Then, When } from './fixtures.js';

const TAB_LINKS = PRIMARY_NAV_LINKS.filter((link) => link.tab === true);
const SHEET_LINKS = PRIMARY_NAV_LINKS.filter((link) => link.tab !== true && link.adminOnly !== true);

function positionOf(links: readonly NavLink[], path: string): number {
  const index = links.findIndex((link) => link.path === path);
  if (index < 0) {
    throw new Error(`${path} is not among the links this navigation offers.`);
  }
  return index;
}

Given('I am on a wide screen', async ({ page }) => {
  await page.setViewportSize(e2eSettings.viewports.desktop);
});

Given('I am on a phone', async ({ page }) => {
  await page.setViewportSize(e2eSettings.viewports.mobile);
});

When('I choose consoles and storage from the side rail', async ({ page }) => {
  await page.goto(AppUrls.home);
  await page.locator(`#nav-rail-${positionOf(PRIMARY_NAV_LINKS, AppUrls.consoles)}`).click();
});

When('I choose my profile from the side rail', async ({ page }) => {
  await page.goto(AppUrls.catalog);
  await page.locator(`#nav-rail-${positionOf(PRIMARY_NAV_LINKS, AppUrls.profile)}`).click();
});

When('I choose the catalog from the tab bar', async ({ page }) => {
  await page.goto(AppUrls.home);
  await page.locator(`#nav-tab-${positionOf(TAB_LINKS, AppUrls.catalog)}`).click();
});

When('I choose my profile from the More sheet', async ({ page }) => {
  await page.goto(AppUrls.home);
  await page.locator('#nav-tab-more').click();
  await expect(page.locator('#nav-sheet')).toBeVisible();
  await page.locator(`#nav-sheet-link-${positionOf(SHEET_LINKS, AppUrls.profile)}`).click();
});

When('I choose the catalog from the side rail', async ({ page }) => {
  await page.goto(AppUrls.home);
  await page.locator(`#nav-rail-${positionOf(ANONYMOUS_NAV_LINKS, AppUrls.catalog)}`).click();
});

Then('I am on my consoles and storage', async ({ page }) => {
  await page.waitForURL(`**${AppUrls.consoles}`);
});

Then('I am on the catalog', async ({ page }) => {
  await page.waitForURL(`**${AppUrls.catalog}`);
});

Then('the More sheet is closed', async ({ page }) => {
  await expect(page.locator('#nav-sheet'), 'the sheet survived navigation').toBeHidden();
});

Then('I am invited to sign in from the navigation', async ({ page }) => {
  await expect(page.locator('#nav-link-signin')).toBeVisible();
});
