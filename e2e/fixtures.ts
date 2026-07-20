/**
 * Custom Playwright fixtures for the Librarian E2E suite.
 *
 * Provides:
 *  - `store`             HTTP control client for seeding/clearing mock server state.
 *  - `anonymousPage`     Page with /bff/user mocked as 401 and /bff/login as a mock page.
 *  - `authedPage`        Page with /bff/user mocked with standard user claims (sub: DEFAULT_E2E_SUB).
 *  - `secondAuthedPage`  Page authenticated as a second, distinct identity (sub: SECOND_E2E_SUB) --
 *    needed for follow/unfollow and cross-viewer profile tests, which genuinely require two
 *    simultaneous signed-in identities in one test (e.g. one page follows the other's profile).
 *
 * Multi-user identity mechanism: the mock Curator server (`e2e/mocks/curator.ts`) has no real
 * bearer-token validation, so "who is calling" can't come from a real access token. Instead, each
 * authenticated fixture also intercepts `**\/curator/api/**` browser requests and injects an
 * `X-E2E-Sub` header naming that page's identity. The real BFF proxy (`src/bff/proxy.ts`) forwards
 * arbitrary request headers untouched (it only strips host/connection/transfer-encoding/x-csrf), so
 * the header reaches the mock server unmodified. `authedPage`'s header always equals
 * `DEFAULT_E2E_SUB`, which is also the mock's own no-header fallback -- so every pre-existing single-
 * user test and seed method keeps working byte-for-byte unchanged.
 */

import { test as base, type Page } from '@playwright/test';

// ── Mock server control client ────────────────────────────────────────────────

const MOCK_BASE = 'http://localhost:4101';

export const DEFAULT_E2E_SUB = 'e2e-user-id';
export const SECOND_E2E_SUB = 'e2e-user-2-id';

export interface CatalogGameFixture {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
}

export interface PsnPreferencesFixture {
  harvest_trophies?: boolean;
  harvest_identity?: boolean;
  harvest_presence?: boolean;
  harvest_devices?: boolean;
}

export interface EnrichmentKeyStatusFixture {
  rawg_configured?: boolean;
  opencritic_configured?: boolean;
  rawg_added_at?: string | null;
  opencritic_added_at?: string | null;
}

export interface LibraryGameFixture {
  game_id: string;
  title: string;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
}

export interface LibraryRefreshResultSummaryFixture {
  rawg_enriched_titles: string[];
  opencritic_enriched_titles: string[];
  opencritic_topup_incomplete: boolean;
}

export interface ProfileSettingsFixture {
  is_public?: boolean;
  show_library?: boolean;
  show_collections?: boolean;
  show_trophies?: boolean;
  show_identity?: boolean;
}

export interface DefinitionFixture {
  definition_id: string;
  name: string;
  kind: string;
  console_id?: string | null;
}

export interface TestStore {
  reset(): Promise<void>;
  seedPsnLink(link?: {
    access_token_expires_at?: string | null;
    refresh_token_expires_at?: string | null;
  }): Promise<void>;
  seedPsnPreferences(prefs: PsnPreferencesFixture): Promise<void>;
  seedEnrichmentKeys(status: EnrichmentKeyStatusFixture): Promise<void>;
  seedCatalogGames(games: CatalogGameFixture[]): Promise<void>;
  seedConsoles(consoleIds: string[]): Promise<void>;
  seedLibraryGames(games: LibraryGameFixture[]): Promise<void>;
  setLibraryRefreshOutcome(
    outcome: 'succeeded' | 'failed',
    error?: string,
    resultSummary?: LibraryRefreshResultSummaryFixture,
  ): Promise<void>;

  // ── Multi-user-aware profile/follow seeding (explicit `sub`) ──────────────
  seedUser(sub: string): Promise<void>;
  seedUserPsnLink(
    sub: string,
    link?: {
      access_token_expires_at?: string | null;
      refresh_token_expires_at?: string | null;
      psn_account_id?: string;
    },
  ): Promise<void>;
  seedUserPsnPreferences(sub: string, prefs: PsnPreferencesFixture): Promise<void>;
  seedUserProfileSettings(sub: string, settings: ProfileSettingsFixture): Promise<void>;
  seedUserLibraryGames(sub: string, games: LibraryGameFixture[]): Promise<void>;
  seedUserCollections(sub: string, definitions: DefinitionFixture[]): Promise<void>;
  seedFollow(followerSub: string, followedSub: string): Promise<void>;
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

// ── Identity / claim payloads ───────────────────────────────────────────────

interface Claim {
  type: string;
  value: string;
}

interface IdentityConfig {
  sub: string;
  email?: string;
  name?: string;
}

function claimsFor(identity: IdentityConfig): Claim[] {
  const email = identity.email ?? `${identity.sub}@test.invalid`;
  return [
    { type: 'sub', value: identity.sub },
    { type: 'email', value: email },
    { type: 'name', value: email },
    { type: 'bff:logout_url', value: `/bff/logout?sid=${identity.sub}` },
  ];
}

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

async function applyAuthRoutes(page: Page, identity: IdentityConfig): Promise<void> {
  await page.route('**/bff/user**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(claimsFor(identity)),
    }),
  );
  await page.route('**/bff/logout**', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><p>Logged out (mock)</p></body></html>',
    }),
  );
  // Identifies this page's calling identity to the mock Curator server -- see the module docstring.
  await page.route('**/curator/api/**', route =>
    route.continue({ headers: { ...route.request().headers(), 'x-e2e-sub': identity.sub } }),
  );
}

// ── Fixture type ──────────────────────────────────────────────────────────────

type LibrarianFixtures = {
  store: TestStore;
  anonymousPage: Page;
  authedPage: Page;
  secondAuthedPage: Page;
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
      async seedPsnPreferences(prefs) {
        await fetchControl('/_test/psn-preferences', prefs);
      },
      async seedEnrichmentKeys(status) {
        await fetchControl('/_test/enrichment-keys', status);
      },
      async seedCatalogGames(games) {
        await fetchControl('/_test/catalog-games', { games });
      },
      async seedConsoles(consoleIds) {
        await fetchControl('/_test/consoles', { consoleIds });
      },
      async seedLibraryGames(games) {
        await fetchControl('/_test/library-games', { games });
      },
      async setLibraryRefreshOutcome(outcome, error, resultSummary) {
        await fetchControl('/_test/library-refresh-outcome', {
          status: outcome,
          error,
          result_summary: resultSummary,
        });
      },

      async seedUser(sub) {
        await fetchControl('/_test/seed-user', { sub });
      },
      async seedUserPsnLink(sub, link) {
        await fetchControl('/_test/user/psn-link', { sub, ...(link ?? {}) });
      },
      async seedUserPsnPreferences(sub, prefs) {
        await fetchControl('/_test/user/psn-preferences', { sub, ...prefs });
      },
      async seedUserProfileSettings(sub, settings) {
        await fetchControl('/_test/user/profile-settings', { sub, ...settings });
      },
      async seedUserLibraryGames(sub, games) {
        await fetchControl('/_test/user/library-games', { sub, games });
      },
      async seedUserCollections(sub, definitions) {
        await fetchControl('/_test/user/collections', { sub, definitions });
      },
      async seedFollow(followerSub, followedSub) {
        await fetchControl('/_test/follow', { follower_sub: followerSub, followed_sub: followedSub });
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
    await applyAuthRoutes(page, { sub: DEFAULT_E2E_SUB });
    page.setDefaultTimeout(60_000);
    await use(page);
  },

  // `authedPage` and `secondAuthedPage` must be two genuinely independent pages when a test
  // requests both simultaneously (follow/unfollow, viewer-mode profile tests, etc.) -- depending
  // on the shared `page` fixture here (like `authedPage` does) would apply both fixtures'
  // page.route() interceptors to the SAME underlying page, and Playwright evaluates routes
  // most-recently-registered-first, so the second fixture's identity would silently win for
  // every request on both "pages". Depending on `browser` instead and opening a fresh
  // BrowserContext gives this identity its own page, isolated from `authedPage`'s.
  secondAuthedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await applyAuthRoutes(page, { sub: SECOND_E2E_SUB });
    page.setDefaultTimeout(60_000);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
