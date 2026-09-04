
import { test, expect } from './fixtures.js';

test.describe('SSR — raw HTML assertions', () => {
  test('FAQ page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get('/faq');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain('ng-server-context');
    expect(html).toContain('Frequently Asked Questions');
    expect(html).toContain('github.com/crgolden/Librarian');
    expect(html).toContain('github.com/crgolden/Curator');
  });
});

test.describe('FaqPage', () => {
  test('anonymous visitor can read the FAQ and follow the link to the privacy policy', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/faq');
    await expect(page.locator('#page-title')).toContainText('Frequently Asked Questions');

    await expect(page.locator('#faq-npsso-token')).toBeVisible();

    await page.locator('#faq-privacy-link').click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('table of contents jumps to a question, and back-to-top returns to the heading', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/faq');

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
