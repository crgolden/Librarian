
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
    await expect(page.locator('#page-title')).toContainText('Privacy Policy');
    await expect(page.locator('#privacy-not-collected')).toBeVisible();

    await page.locator('#privacy-faq-link').click();
    await expect(page).toHaveURL(/\/faq$/);
  });
});
