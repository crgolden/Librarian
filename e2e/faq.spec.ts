/**
 * FAQ page E2E — SSR assertion (public trust/SEO content) + anonymous browsing.
 */

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
    await expect(page.locator('h1')).toContainText('Frequently Asked Questions');
    // The page-toc's own anchor link now shares this same text, so scope to the heading itself.
    await expect(page.getByRole('heading', { name: 'What is an NPSSO token?' })).toBeVisible();

    await page.getByRole('main').getByRole('link', { name: 'privacy policy' }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('table of contents jumps to a question, and back-to-top returns to the heading', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/faq');
    // Scrolling is handled on click (not via href navigation — a plain href="#id" anchor would
    // resolve against Angular's <base href="/"> and silently redirect to "/", not stay on /faq),
    // so assert the target scrolled into view rather than checking the URL.
    const tocLink = page.locator('.page-toc').getByRole('link', { name: 'How do I get mine?' });
    await expect(tocLink).toBeVisible();
    await tocLink.click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole('heading', { name: 'How do I get mine?' })).toBeInViewport();

    await page.getByRole('link', { name: 'Back to top' }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.locator('h1#top')).toBeInViewport();
  });
});
