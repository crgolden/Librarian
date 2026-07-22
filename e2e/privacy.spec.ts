/**
 * Privacy Policy page E2E — SSR assertion (public trust/SEO content) + anonymous browsing.
 */

import { test, expect } from './fixtures.js';

test.describe('SSR — raw HTML assertions', () => {
  test('privacy policy page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get('/privacy');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain('ng-server-context');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('What we never collect');
    expect(html).toContain('Your action history');
    expect(html).toContain('github.com/crgolden/Curator');
  });
});

test.describe('PrivacyPage', () => {
  test('anonymous visitor can read the privacy policy and follow the link to the FAQ', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/privacy');
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    // The page-toc's own anchor link now shares this same text, so scope to the heading itself.
    await expect(page.getByRole('heading', { name: 'What we never collect' })).toBeVisible();

    await page.getByRole('main').getByRole('link', { name: 'FAQ' }).click();
    await expect(page).toHaveURL(/\/faq$/);
  });
});
