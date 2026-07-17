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
    await expect(page.getByText('What is an NPSSO token?')).toBeVisible();

    await page.getByRole('main').getByRole('link', { name: 'privacy policy' }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
  });
});
