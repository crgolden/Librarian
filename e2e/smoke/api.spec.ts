/**
 * Post-deploy smoke tests — exercises the deployed Librarian app.
 *
 * All tests in this file are skipped unless SmokeBaseUrl is set.
 * Run via: npm run e2e:smoke (sets SmokeBaseUrl from environment).
 */

import { test, expect } from '@playwright/test';

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

function skipIfNotSmoke(): void {
  if (!smokeBaseUrl) {
    test.skip();
  }
}

test.describe('Smoke — deployed stack', () => {
  test('GET /health returns 200 Healthy', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.get(`${smokeBaseUrl}/health`);
    expect(res.status()).toBe(200);
    expect((await res.text()).trim()).toBe('Healthy');
  });

  test('SPA root bootstraps Angular app', async ({ page }) => {
    skipIfNotSmoke();
    await page.goto(`${smokeBaseUrl}/`);
    const content = page.locator('app-root > *');
    await content.first().waitFor({ state: 'attached' });
    expect(await content.count()).toBeGreaterThan(0);
  });

  test('BFF proxy GET without CSRF header still succeeds (CSRF only guards mutating methods)', async ({ request }) => {
    skipIfNotSmoke();
    // csrfForMutating only rejects POST/PUT/PATCH/DELETE without X-CSRF — GET/HEAD are
    // read-only and pass through unchecked (standard CSRF practice: safe methods don't
    // need the defence since they must not have side effects).
    const res = await request.get(`${smokeBaseUrl}/curator/api/me`);
    expect([200, 401]).toContain(res.status());
  });

  test('BFF proxy with CSRF header reaches Curator', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.get(`${smokeBaseUrl}/curator/api/me`, {
      headers: { 'X-CSRF': '1' },
    });
    expect([200, 401]).toContain(res.status());
  });

  test('BFF protected endpoint unauthenticated returns 401', async ({ request }) => {
    skipIfNotSmoke();
    const res = await request.post(`${smokeBaseUrl}/curator/api/psn/link`, {
      headers: { 'X-CSRF': '1', 'Content-Type': 'application/json' },
      data: JSON.stringify({ npsso: 'fake' }),
    });
    expect(res.status()).toBe(401);
  });
});
