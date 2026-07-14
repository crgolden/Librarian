/**
 * Home page E2E — anonymous browsing + SSR assertions, and authenticated state.
 */

import { test, expect } from './fixtures.js';

test.describe('SSR — raw HTML assertions', () => {
  test('home page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get('/');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    // Proves SSR (Angular writes this attribute on the server-rendered root).
    expect(html).toContain('ng-server-context');
    expect(html).toContain('Librarian');
  });
});

test.describe('HomePage', () => {
  test('anonymous visitor sees a sign-in call to action', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome to Librarian');
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });

  test('authenticated visitor sees a link to PSN settings', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Manage PSN Link' })).toBeVisible();
  });
});
