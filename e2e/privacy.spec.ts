
import { test, expect } from './fixtures.js';
import { AngularSsrMarkers } from './angular-ssr-constants';
import { AppUrls } from '../src/app/app-paths';
import { SourceRepositories } from '../src/shared/source-repositories';

test.describe('SSR — raw HTML assertions', () => {
  test('privacy policy page is server-rendered with its source link in the HTML', async ({
    request,
    store,
  }) => {
    await store.reset();

    const res = await request.get(AppUrls.privacy);
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SourceRepositories.curator);
  });

  test.describe('with scripting off, so the DOM is exactly what the server sent', () => {
    test.use({ javaScriptEnabled: false });

    test('privacy policy page carries its authored anchors before any hydration', async ({ page, store }) => {
      await store.reset();

      await page.goto(AppUrls.privacy);

      await expect(page.locator('#privacy-not-collected')).toBeAttached();
      await expect(page.locator('#privacy-action-log')).toBeAttached();
    });
  });
});

test.describe('PrivacyPage', () => {
  test('anonymous visitor can read the privacy policy and follow the link to the FAQ', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.privacy);
    await expect(page.locator('#page-title')).toBeVisible();
    await expect(page.locator('#privacy-not-collected')).toBeVisible();

    await page.locator('#privacy-faq-link').click();
    await expect(page).toHaveURL(/\/faq$/);
  });
});
