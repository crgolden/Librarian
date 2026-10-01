
import { test as base, type Page } from '@playwright/test';
import { newId, newText } from '@crgolden/modules/testing';
import type {
  CatalogPrice,
  ConsoleDeviceLinkState,
  ContentKind,
  FriendRequest,
  PsPlusRotation,
  SizeSource,
  StoreSearchHit,
  TrophyMatch,
  TrophySummary,
} from './mocks/curator.js';
import { ControlRoutes } from './mocks/control-routes';
import { e2eContract } from './mocks/e2e-identity-contract';
import { BffPaths } from '../src/shared/bff-contract';
import { CURATOR_API_PREFIX } from '../src/curator/curator-api';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../src/bff/http-headers';
import { ContentTypes } from '../src/shared/content-types';
import { type CollectionVisibility, JobStatuses, type RefreshCadence } from '../src/curator/curator.models';
import { MOCK_CURATOR_ORIGIN, MOCK_OIDC_COOKIE_URL } from './mocks/mock-endpoints';

export {
  newAaaTier,
  newCatalogGame,
  newFutureInstant,
  newLibraryGame,
  newPsnRating,
  newScore,
  newStoreHit,
  newTrophySummary,
} from './mocks/curator-records';

const MOCK_BASE = MOCK_CURATOR_ORIGIN;
const MOCK_OIDC_BASE = MOCK_OIDC_COOKIE_URL;

const E2E_CONTRACT = e2eContract();
const E2eIdentityCookies = E2E_CONTRACT.identityCookies;

export const DEFAULT_E2E_SUB = E2E_CONTRACT.defaultSub;
export const SECOND_E2E_SUB = newId();

export interface CatalogGameFixture {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
  critical_score?: number | null;
  oc_score?: number | null;
  psn_rating?: number | null;
  cover_image_url?: string | null;
  size_source?: SizeSource;
  content_kind?: ContentKind | null;
  price?: CatalogPrice | null;
}

export interface RefreshScheduleFixture {
  cadence?: RefreshCadence;
  ps_plus_watch?: boolean;
  next_run_at?: string;
  last_run_at?: string | null;
  consecutive_failures?: number;
  paused_reason?: string | null;
}

export interface PsnPreferencesFixture {
  harvest_trophies?: boolean;
  harvest_identity?: boolean;
  harvest_presence?: boolean;
  harvest_devices?: boolean;
  allow_friend_writes?: boolean;
  allow_chat_writes?: boolean;
}

export interface EnrichmentKeyStatusFixture {
  rawg_configured?: boolean;
  opencritic_configured?: boolean;
  rawg_added_at?: string | null;
  opencritic_added_at?: string | null;
  rawg_key_rejected_at?: string | null;
  opencritic_key_rejected_at?: string | null;
}

export interface LibraryGameFixture {
  game_id: string;
  title: string;
  genre?: string | null;
  rawg_rating?: number | null;
  opencritic_rating?: number | null;
  psn_rating?: number | null;
  psn_product_id?: string | null;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
  percent_completed?: number | null;
  platforms?: string[];
  trophy_match?: TrophyMatch;
}

export interface LibraryRefreshResultSummaryFixture {
  rawg_enriched_titles: string[];
  opencritic_enriched_titles: string[];
  opencritic_topup_incomplete: boolean;
}

export interface EnrichmentRunFixture {
  run_id?: string;
  status: string;
  error?: string | null;
  result_summary?: Record<string, unknown> | null;
}

export type EnrichmentRunTerminalStatusFixture = typeof JobStatuses.succeeded | typeof JobStatuses.failed | typeof JobStatuses.cancelled;

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
  visibility?: CollectionVisibility;
  install_target_console_id?: string | null;
  game_ids?: string[];
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
  seedStoreSearchHits(hits: StoreSearchHit[]): Promise<void>;
  seedAdmin(isAdmin?: boolean): Promise<void>;
  seedConsoles(consoleIds: string[]): Promise<void>;
  seedLibraryGames(games: LibraryGameFixture[]): Promise<void>;
  setLibraryRefreshOutcome(
    outcome: typeof JobStatuses.succeeded | typeof JobStatuses.failed,
    error?: string,
    resultSummary?: LibraryRefreshResultSummaryFixture,
  ): Promise<void>;
  seedEnrichmentRun(run: EnrichmentRunFixture): Promise<void>;
  setEnrichmentRunOutcome(
    outcome: EnrichmentRunTerminalStatusFixture,
    error?: string | null,
    resultSummary?: Record<string, unknown> | null,
  ): Promise<void>;

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
  seedUserPsnProfile(sub: string, profile: { online_id?: string; trophy_summary?: TrophySummary }): Promise<void>;
  seedUserRefreshSchedule(sub: string, schedule?: RefreshScheduleFixture): Promise<void>;
  seedUserProfileSettings(sub: string, settings: ProfileSettingsFixture): Promise<void>;
  seedUserLibraryGames(sub: string, games: LibraryGameFixture[]): Promise<void>;
  seedUserCollections(sub: string, definitions: DefinitionFixture[]): Promise<void>;
  seedFollow(followerSub: string, followedSub: string): Promise<void>;
  seedUserPsPlusRotation(sub: string, rotation: Partial<PsPlusRotation>): Promise<void>;
  seedUserFriendRequests(sub: string, requests: FriendRequest[]): Promise<void>;
  seedConsoleDeviceLink(consoleId: string, link?: { device_id?: string; state?: ConsoleDeviceLinkState }): Promise<void>;
  seedHiddenLibraryGames(gameIds: string[]): Promise<void>;
}

async function fetchControl(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${MOCK_BASE}${path}`, {
    method: HttpMethods.post,
    headers: { [CONTENT_TYPE_HEADER]: ContentTypes.json },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Control API ${path} returned ${res.status}`);
  }
}

export interface IdentityConfig {
  sub: string;
  email?: string;
  name?: string;
}

export async function applyAnonymousRoutes(page: Page): Promise<void> {
  await page.route(`**${BffPaths.user}**`, route => route.fulfill({ json: null }));
  await page.route(`**${BffPaths.login}**`, route => route.fulfill({ body: newText() }));
}

export function identityCookies(identity: IdentityConfig): { name: string; value: string; url: string }[] {
  const email = identity.email ?? `${identity.sub}@test.invalid`;
  const name = identity.name ?? email;
  return [
    { name: E2eIdentityCookies.sub, value: identity.sub, url: MOCK_OIDC_BASE },
    { name: E2eIdentityCookies.email, value: email, url: MOCK_OIDC_BASE },
    { name: E2eIdentityCookies.name, value: name, url: MOCK_OIDC_BASE },
  ];
}

export async function applyAuthRoutes(page: Page, identity: IdentityConfig): Promise<void> {
  await page.context().addCookies(identityCookies(identity));

  await page.route(`**${CURATOR_API_PREFIX}/**`, route =>
    route.continue({ headers: { ...route.request().headers(), [E2E_CONTRACT.subHeader]: identity.sub } }),
  );

  await page.goto(BffPaths.login);
}

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.context().addCookies([{ name: E2eIdentityCookies.admin, value: String(true), url: MOCK_OIDC_BASE }]);
  await page.goto(BffPaths.login);
}

type LibrarianFixtures = {
  store: TestStore;
  anonymousPage: Page;
  authedPage: Page;
  secondAuthedPage: Page;
  secondAnonymousPage: Page;
};

export const test = base.extend<LibrarianFixtures>({
  store: async ({}, use) => {
    const s: TestStore = {
      async reset() {
        await fetchControl(ControlRoutes.reset);
      },
      async seedPsnLink(link) {
        await fetchControl(ControlRoutes.psnLink, link ?? {});
      },
      async seedPsnPreferences(prefs) {
        await fetchControl(ControlRoutes.psnPreferences, prefs);
      },
      async seedEnrichmentKeys(status) {
        await fetchControl(ControlRoutes.enrichmentKeys, status);
      },
      async seedCatalogGames(games) {
        await fetchControl(ControlRoutes.catalogGames, { games });
      },
      async seedStoreSearchHits(hits) {
        await fetchControl(ControlRoutes.storeSearchHits, { hits });
      },
      async seedAdmin(isAdmin = true) {
        await fetchControl(ControlRoutes.admin, { isAdmin });
      },
      async seedConsoles(consoleIds) {
        await fetchControl(ControlRoutes.consoles, { consoleIds });
      },
      async seedLibraryGames(games) {
        await fetchControl(ControlRoutes.libraryGames, { games });
      },
      async setLibraryRefreshOutcome(outcome, error, resultSummary) {
        await fetchControl(ControlRoutes.libraryRefreshOutcome, {
          status: outcome,
          error,
          result_summary: resultSummary,
        });
      },
      async seedEnrichmentRun(run) {
        await fetchControl(ControlRoutes.enrichmentRun, run);
      },
      async setEnrichmentRunOutcome(outcome, error, resultSummary) {
        await fetchControl(ControlRoutes.enrichmentRunOutcome, {
          status: outcome,
          error,
          result_summary: resultSummary,
        });
      },

      async seedUser(sub) {
        await fetchControl(ControlRoutes.seedUser, { sub });
      },
      async seedUserPsnLink(sub, link) {
        await fetchControl(ControlRoutes.userPsnLink, { sub, ...(link ?? {}) });
      },
      async seedUserPsnPreferences(sub, prefs) {
        await fetchControl(ControlRoutes.userPsnPreferences, { sub, ...prefs });
      },
      async seedUserPsnProfile(sub, profile) {
        await fetchControl(ControlRoutes.userPsnProfile, { sub, ...profile });
      },
      async seedUserRefreshSchedule(sub, schedule) {
        await fetchControl(ControlRoutes.userRefreshSchedule, { sub, ...(schedule ?? {}) });
      },
      async seedUserProfileSettings(sub, settings) {
        await fetchControl(ControlRoutes.userProfileSettings, { sub, ...settings });
      },
      async seedUserLibraryGames(sub, games) {
        await fetchControl(ControlRoutes.userLibraryGames, { sub, games });
      },
      async seedUserCollections(sub, definitions) {
        await fetchControl(ControlRoutes.userCollections, { sub, definitions });
      },
      async seedFollow(followerSub, followedSub) {
        await fetchControl(ControlRoutes.follow, { follower_sub: followerSub, followed_sub: followedSub });
      },
      async seedUserPsPlusRotation(sub, rotation) {
        await fetchControl(ControlRoutes.userPsPlusRotation, { sub, ...rotation });
      },
      async seedUserFriendRequests(sub, requests) {
        await fetchControl(ControlRoutes.userFriendRequests, { sub, requests });
      },
      async seedConsoleDeviceLink(consoleId, link) {
        await fetchControl(ControlRoutes.consoleDeviceLink, { console_id: consoleId, ...(link ?? {}) });
      },
      async seedHiddenLibraryGames(gameIds) {
        await fetchControl(ControlRoutes.hiddenLibraryGames, { game_ids: gameIds });
      },
    };
    await use(s);
  },

  anonymousPage: async ({ page }, use) => {
    await applyAnonymousRoutes(page);
    await use(page);
  },

  authedPage: async ({ page }, use) => {
    await applyAuthRoutes(page, { sub: DEFAULT_E2E_SUB });
    await use(page);
  },

  secondAuthedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await applyAuthRoutes(page, { sub: SECOND_E2E_SUB });
    await use(page);
    await context.close();
  },

  secondAnonymousPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await applyAnonymousRoutes(page);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
