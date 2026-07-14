/**
 * Custom Playwright fixtures for the Librarian E2E suite.
 *
 * Provides:
 *  - `store`          HTTP control client for seeding/clearing mock server state.
 *  - `anonymousPage`  Page with /bff/user mocked as 401 and /bff/login as a mock page.
 *  - `authedPage`     Page with /bff/user mocked with standard user claims.
 */

import { test as base, type Page } from '@playwright/test';

// ── Mock server control client ────────────────────────────────────────────────

const MOCK_BASE = 'http://localhost:4101';

export interface TestStore {
  reset(): Promise<void>;
  seedPsnLink(link?: { access_token_expires_at?: string; refresh_token_expires_at?: string }): Promise<void>;
}

async function fetchControl(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${MOCK_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Control API ${path} returned ${res.status}`);
  }
}

// ── Anonymous and authenticated claim payloads ────────────────────────────────

const USER_CLAIMS = [
  { type: 'sub', value: 'e2e-user-id' },
  { type: 'email', value: 'e2e@test.invalid' },
  { type: 'name', value: 'e2e@test.invalid' },
  { type: 'bff:logout_url', value: '/bff/logout?sid=e2e' },
];

// ── Route mock helpers ────────────────────────────────────────────────────────

async function applyAnonymousRoutes(page: Page): Promise<void> {
  await page.route('**/bff/user**', route =>
    route.fulfill({ status: 401 }),
  );
  await page.route('**/bff/login**', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><p>Login page (mock)</p></body></html>',
    }),
  );
}

async function applyAuthRoutes(page: Page): Promise<void> {
  await page.route('**/bff/user**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(USER_CLAIMS),
    }),
  );
  await page.route('**/bff/logout**', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><p>Logged out (mock)</p></body></html>',
    }),
  );
}

// ── Fixture type ──────────────────────────────────────────────────────────────

type LibrarianFixtures = {
  store: TestStore;
  anonymousPage: Page;
  authedPage: Page;
};

// ── Extended test instance ────────────────────────────────────────────────────

export const test = base.extend<LibrarianFixtures>({
  store: async ({}, use) => {
    const s: TestStore = {
      async reset() {
        await fetchControl('/_test/reset');
      },
      async seedPsnLink(link) {
        await fetchControl('/_test/psn-link', link ?? {});
      },
    };
    await use(s);
  },

  anonymousPage: async ({ page }, use) => {
    await applyAnonymousRoutes(page);
    page.setDefaultTimeout(60_000);
    await use(page);
  },

  authedPage: async ({ page }, use) => {
    await applyAuthRoutes(page);
    page.setDefaultTimeout(60_000);
    await use(page);
  },
});

export { expect } from '@playwright/test';
