import { expect, type Page } from '@playwright/test';
import { AppUrls } from '../../src/app/app-paths';
import { Given, Then, When } from './fixtures.js';

const FAQ_URL = new RegExp(`${AppUrls.faq}$`);
const PRIVACY_URL = new RegExp(`${AppUrls.privacy}$`);

async function jumpToAQuestion(page: Page): Promise<void> {
  const tocLink = page.locator('#toc-link-3');
  await expect(tocLink).toBeVisible();
  await tocLink.click();
}

Given('I have the FAQ open', async ({ page }) => {
  await page.goto(AppUrls.faq);
});

Given('I have jumped to a question in the FAQ', async ({ page }) => {
  await page.goto(AppUrls.faq);
  await jumpToAQuestion(page);
  await expect(page.locator('#faq-get-npsso')).toBeInViewport();
});

When('I read the FAQ', async ({ page }) => {
  await page.goto(AppUrls.faq);
  await expect(page.locator('#page-title')).toBeVisible();
  await expect(page.locator('#faq-npsso-token')).toBeVisible();
});

When('I read the privacy policy', async ({ page }) => {
  await page.goto(AppUrls.privacy);
  await expect(page.locator('#page-title')).toBeVisible();
  await expect(page.locator('#privacy-not-collected')).toBeVisible();
});

When('I follow its link to the privacy policy', async ({ page }) => {
  await page.locator('#faq-privacy-link').click();
});

When('I follow its link to the FAQ', async ({ page }) => {
  await page.locator('#privacy-faq-link').click();
});

When('I jump to a question from the contents', async ({ page }) => {
  await jumpToAQuestion(page);
});

When('I go back to the top', async ({ page }) => {
  await page.locator('#back-to-top').click();
});

Then('I am reading the privacy policy', async ({ page }) => {
  await expect(page).toHaveURL(PRIVACY_URL);
});

Then('I am reading the FAQ', async ({ page }) => {
  await expect(page).toHaveURL(FAQ_URL);
});

Then('that question is on screen', async ({ page }) => {
  await expect(page).toHaveURL(FAQ_URL);
  await expect(page.locator('#faq-get-npsso')).toBeInViewport();
});

Then('the page heading is on screen', async ({ page }) => {
  await expect(page).toHaveURL(FAQ_URL);
  await expect(page.locator('h1#page-title')).toBeInViewport();
});
