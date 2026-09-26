
import { test, expect } from './fixtures.js';
import { AngularSsrMarkers } from './angular-ssr-constants';
import { AppUrls } from '../src/app/app-paths';
import { SourceRepositories } from '../src/shared/source-repositories';

test.describe('SSR — raw HTML assertions', () => {
  test('FAQ page is server-rendered with its source links in the HTML', async ({ request, store }) => {
    await store.reset();

    const res = await request.get(AppUrls.faq);
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SourceRepositories.librarian);
    expect(html).toContain(SourceRepositories.curator);
  });

  test.describe('with scripting off, so the DOM is exactly what the server sent', () => {
    test.use({ javaScriptEnabled: false });

    test('FAQ page carries its authored anchors before any hydration', async ({ page, store }) => {
      await store.reset();

      await page.goto(AppUrls.faq);

      await expect(page.locator('#faq-npsso-token')).toBeAttached();
    });
  });
});

test.describe('FaqPage', () => {
  test('anonymous visitor can read the FAQ and follow the link to the privacy policy', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.faq);
    await expect(page.locator('#page-title')).toBeVisible();

    await expect(page.locator('#faq-npsso-token')).toBeVisible();

    await page.locator('#faq-privacy-link').click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('table of contents jumps to a question, and back-to-top returns to the heading', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.faq);

    const tocLink = page.locator('#toc-link-3');
    await expect(tocLink).toBeVisible();
    await tocLink.click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.locator('#faq-get-npsso')).toBeInViewport();

    await page.locator('#back-to-top').click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.locator('h1#page-title')).toBeInViewport();
  });
});
