/**
 * Mock Curator API — stands in for the real FastAPI Curator backend during E2E tests.
 *
 * Serves real HTTP routes matching the real Curator API's actual shape (no path prefix — the
 * Node SSR server's curatorProxy strips the '/curator/api' mount prefix before forwarding) so
 * the server can proxy to it server-side (Playwright page.route() only intercepts browser
 * requests, not outbound Node fetch calls). Tests manipulate state via the control API at /_test/*.
 *
 * Multi-user identity: this mock has no real bearer-token validation (it never inspects the
 * Authorization header for claims). "Who is calling" is instead read from a `X-E2E-Sub` request
 * header — `e2e/fixtures.ts`'s `secondAuthedPage` fixture injects it via a browser-side
 * `page.route()` on `**\/curator/api/**`, forwarded untouched by the real BFF proxy (it only
 * strips `host`/`connection`/`transfer-encoding`/`x-csrf`). When the header is absent, every route
 * falls back to `DEFAULT_SUB` — the original single-user behavior this mock had before the social
 * profile feature, preserved exactly for every pre-existing seed method and spec (`psn.spec.ts`,
 * `home.spec.ts`, etc.).
 */

import express, { type Express, type Request, type Response } from 'express';

// ── Data model ────────────────────────────────────────────────────────────────

export interface PsnLink {
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

export interface PsnPreferences {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
}

export interface EnrichmentKeyStatus {
  rawg_configured: boolean;
  opencritic_configured: boolean;
  rawg_added_at: string | null;
  opencritic_added_at: string | null;
}

const DEFAULT_ENRICHMENT_KEY_STATUS: EnrichmentKeyStatus = {
  rawg_configured: false,
  opencritic_configured: false,
  rawg_added_at: null,
  opencritic_added_at: null,
};

export interface UserRecord {
  sub: string;
  email: string | null;
  psn: PsnLink | null;
  psnAccountId: string | null;
  psnPreferences: PsnPreferences;
  enrichmentKeys: EnrichmentKeyStatus;
}

const DEFAULT_PSN_PREFERENCES: PsnPreferences = {
  harvest_trophies: false,
  harvest_identity: false,
  harvest_presence: false,
  harvest_devices: false,
};

export interface ProfileSettings {
  is_public: boolean;
  show_library: boolean;
  show_collections: boolean;
  show_trophies: boolean;
  show_identity: boolean;
}

const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  is_public: false,
  show_library: false,
  show_collections: false,
  show_trophies: false,
  show_identity: false,
};

interface FollowEdge {
  follower: string;
  followed: string;
  followedAt: string;
}

export interface GameSummary {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
}

interface CollectionGame {
  game_id: string;
  title: string;
  genre: string;
  aaa_tier: string;
  franchise: string;
  composite_score: number | null;
  rank_score: number;
  size_gb: number;
}

interface DefinitionRecord {
  definition_id: string;
  name: string;
  kind: string;
  console_id: string | null;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
}

export interface LibraryGame {
  game_id: string;
  title: string;
  category: string | null;
  rawg_rating: number | null;
  opencritic_rating: number | null;
  psn_rating: number | null;
  psn_product_id: string | null;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
}

const LIBRARY_SORT_FIELDS = ['title', 'category', 'rawg_rating', 'opencritic_rating', 'psn_rating'] as const;
type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

/** Mirrors Curator's real `GET /library`/`GET /users/{sub}/library` server-side
 * search/filter/sort/paging so E2E tests exercise real request/response round trips, not a
 * client-side array. */
function queryLibraryGames(games: LibraryGame[], req: Request): { games: LibraryGame[]; total: number } {
  const q = (req.query['q'] as string | undefined)?.toLowerCase();
  const category = req.query['category'] as string | undefined;
  const sortParam = req.query['sort'] as string | undefined;
  const sort: LibrarySortField = LIBRARY_SORT_FIELDS.includes(sortParam as LibrarySortField)
    ? (sortParam as LibrarySortField)
    : 'title';
  const desc = req.query['sortDir'] === 'desc';
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;
  const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;

  let filtered = games;
  if (q) {
    filtered = filtered.filter((g) => g.title.toLowerCase().includes(q));
  }
  if (category) {
    filtered = filtered.filter((g) => g.category === category);
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    if (av === null && bv === null) return a.title.localeCompare(b.title);
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
    return desc ? -cmp : cmp;
  });

  return { games: sorted.slice(offset, offset + limit), total: sorted.length };
}

function libraryCategories(games: LibraryGame[]): string[] {
  return Array.from(new Set(games.map((g) => g.category).filter((c): c is string => c !== null))).sort();
}

type SeededLibraryGame = Pick<LibraryGame, 'game_id' | 'title' | 'rawg_enriched' | 'opencritic_enriched'> &
  Partial<LibraryGame>;

/** Fills in defaults for the rating/category/product-id fields a test didn't bother seeding. */
function normalizeLibraryGames(games: SeededLibraryGame[]): LibraryGame[] {
  return games.map((g) => ({
    game_id: g.game_id,
    title: g.title,
    category: g.category ?? null,
    rawg_rating: g.rawg_rating ?? null,
    opencritic_rating: g.opencritic_rating ?? null,
    psn_rating: g.psn_rating ?? null,
    psn_product_id: g.psn_product_id ?? null,
    rawg_enriched: g.rawg_enriched,
    opencritic_enriched: g.opencritic_enriched,
  }));
}

export interface LibraryRefreshResultSummary {
  rawg_enriched_titles: string[];
  opencritic_enriched_titles: string[];
  opencritic_topup_incomplete: boolean;
}

interface LibraryRun {
  sub: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  result_summary: LibraryRefreshResultSummary | null;
}

interface LibraryRefreshOutcome {
  status: 'succeeded' | 'failed';
  error?: string;
  result_summary?: LibraryRefreshResultSummary;
}

// ── In-memory store ───────────────────────────────────────────────────────────

interface ActionLogEntry {
  action: string;
  detail: string | null;
  occurred_at: string;
}

const users = new Map<string, UserRecord>();
const consoles = new Map<string, Set<string>>();
const definitions = new Map<string, DefinitionRecord[]>();
const libraryRuns = new Map<string, LibraryRun>();
const nextLibraryOutcome = new Map<string, LibraryRefreshOutcome>();
const actionLog = new Map<string, ActionLogEntry[]>();
const libraryGames = new Map<string, LibraryGame[]>();
const profileSettings = new Map<string, ProfileSettings>();
const followEdges: FollowEdge[] = [];

const DEFAULT_SUB = 'e2e-user-id';

function logAction(sub: string, action: string, detail: string | null = null): void {
  const entries = actionLog.get(sub) ?? [];
  entries.push({ action, detail, occurred_at: new Date().toISOString() });
  actionLog.set(sub, entries);
}

let CATALOG_GAMES: GameSummary[] = [
  { game_id: 'g-uncharted-4', canonical_title: 'Uncharted 4: A Thief’s End', franchise: 'Uncharted', genre: 'Action-Adventure', aaa_tier: 'AAA' },
  { game_id: 'g-tlou2', canonical_title: 'The Last of Us Part II', franchise: 'The Last of Us', genre: 'Action-Adventure', aaa_tier: 'AAA' },
  { game_id: 'g-bloodborne', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
  { game_id: 'g-hades', canonical_title: 'Hades', franchise: null, genre: 'Roguelike', aaa_tier: 'Indie' },
  { game_id: 'g-hollow-knight', canonical_title: 'Hollow Knight', franchise: null, genre: 'Metroidvania', aaa_tier: 'Indie' },
  { game_id: 'g-gt7', canonical_title: 'Gran Turismo 7', franchise: 'Gran Turismo', genre: 'Racing', aaa_tier: 'AAA' },
  { game_id: 'g-returnal', canonical_title: 'Returnal', franchise: null, genre: 'Roguelike', aaa_tier: 'AA' },
  { game_id: 'g-stray', canonical_title: 'Stray', franchise: null, genre: 'Adventure', aaa_tier: 'Indie' },
];

const TROPHY_SUMMARY = {
  level: 42,
  progress: 65,
  tier: 3,
  earned: { bronze: 120, silver: 45, gold: 12, platinum: 3 },
  account_id: 'psn-account-e2e',
};

const IDENTITY = {
  account_id: 'psn-account-e2e',
  online_id: 'e2e_gamer',
  region: 'US',
};

const PRESENCE = {
  online_status: 'online',
  platform: 'PS5',
  last_online_date: '2026-07-16T12:00:00Z',
  game_title: 'Bloodborne',
};

const DEVICES = {
  devices: [
    {
      device_id: 'dev-1',
      device_type: 'PS5',
      device_name: 'My PS5',
      activation_type: 'primary',
      activation_date: '2024-01-01T00:00:00Z',
      deactivation_date: null,
    },
  ],
};

/** Reads the calling identity from `X-E2E-Sub` (see the module docstring), defaulting to
 * `DEFAULT_SUB` — the pre-existing single-user behavior — when absent. */
function subFromRequest(req: Request): string {
  const header = req.headers['x-e2e-sub'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return DEFAULT_SUB;
}

/** Deterministic per-user PSN account id / online id fixtures, keyed off `sub` so a second user
 * doesn't collide with `DEFAULT_SUB`'s existing constants (`psn-account-e2e` / `e2e_gamer`, both
 * already asserted against in `psn.spec.ts`). */
function psnAccountIdFor(sub: string): string {
  return sub === DEFAULT_SUB ? IDENTITY.account_id : `psn-account-${sub}`;
}

function onlineIdFor(sub: string): string {
  return sub === DEFAULT_SUB ? IDENTITY.online_id : `${sub}_gamer`;
}

/** Get-or-create the user record for `sub` — this is how a sub becomes "known" to the mock
 * (mirrors the real `app_users` row being created once a user has authenticated at least once).
 * Only ever call this for (a) the calling identity of an authenticated request, or (b) a `/_test/*`
 * seed endpoint that explicitly names a target `sub` to register — never for a bare path parameter
 * a route is about to 404-check, or the 404 case becomes untestable. */
function getUser(sub: string): UserRecord {
  let user = users.get(sub);
  if (!user) {
    user = {
      sub,
      email: `${sub}@test.invalid`,
      psn: null,
      psnAccountId: null,
      psnPreferences: { ...DEFAULT_PSN_PREFERENCES },
      enrichmentKeys: { ...DEFAULT_ENRICHMENT_KEY_STATUS },
    };
    users.set(sub, user);
  }
  return user;
}

/** Non-mutating lookup — used for target-user existence checks (`/users/{sub}/...`), so an
 * unseeded/unknown sub correctly 404s instead of being silently auto-vivified. */
function findUser(sub: string): UserRecord | undefined {
  return users.get(sub);
}

function ownedConsoles(sub: string): Set<string> {
  let owned = consoles.get(sub);
  if (!owned) {
    owned = new Set();
    consoles.set(sub, owned);
  }
  return owned;
}

function userDefinitions(sub: string): DefinitionRecord[] {
  let list = definitions.get(sub);
  if (!list) {
    list = [];
    definitions.set(sub, list);
  }
  return list;
}

function settingsFor(sub: string): ProfileSettings {
  return profileSettings.get(sub) ?? DEFAULT_PROFILE_SETTINGS;
}

function isFollowing(follower: string, followed: string): boolean {
  return followEdges.some((e) => e.follower === follower && e.followed === followed);
}

function followerCount(sub: string): number {
  return followEdges.filter((e) => e.followed === sub).length;
}

function followingCount(sub: string): number {
  return followEdges.filter((e) => e.follower === sub).length;
}

function listFollowers(sub: string): FollowEdge[] {
  return followEdges
    .filter((e) => e.followed === sub)
    .sort((a, b) => b.followedAt.localeCompare(a.followedAt));
}

function listFollowing(sub: string): FollowEdge[] {
  return followEdges
    .filter((e) => e.follower === sub)
    .sort((a, b) => b.followedAt.localeCompare(a.followedAt));
}

/** Deterministic mock size/score fixtures, matched to CATALOG_GAMES's fixed rows. */
function toCollectionGame(game: GameSummary): CollectionGame {
  return {
    game_id: game.game_id,
    title: game.canonical_title,
    genre: game.genre ?? 'Unclassified',
    aaa_tier: game.aaa_tier ?? 'Indie',
    franchise: game.franchise ?? game.canonical_title,
    composite_score: 8,
    rank_score: 1,
    size_gb: 40,
  };
}

function generateCollection(
  sub: string,
  spec: {
    kind: string;
    genre_filter: string[];
    min_score: number | null;
    aaa_tier_filter: string | null;
  },
): { included: CollectionGame[]; excluded: CollectionGame[]; used_gb: number | null } {
  const matches = (game: GameSummary): boolean => {
    if (spec.genre_filter.length > 0 && !spec.genre_filter.includes(game.genre ?? '')) {
      return false;
    }
    if (spec.aaa_tier_filter && game.aaa_tier !== spec.aaa_tier_filter) {
      return false;
    }
    return true;
  };
  void sub; // generateCollection operates on the shared CATALOG_GAMES fixture, not per-user state.

  const included: CollectionGame[] = [];
  const excluded: CollectionGame[] = [];
  for (const game of CATALOG_GAMES) {
    (matches(game) ? included : excluded).push(toCollectionGame(game));
  }

  const usedGb = included.length > 0 ? included.reduce((sum, game) => sum + game.size_gb, 0) : null;
  return { included, excluded, used_gb: usedGb };
}

function toProfileDefinition(d: DefinitionRecord): { definition_id: string; name: string; kind: string; console_id: string | null } {
  return { definition_id: d.definition_id, name: d.name, kind: d.kind, console_id: d.console_id };
}

// ── Express app factory ───────────────────────────────────────────────────────

export function createCuratorApp(): Express {
  const app = express();
  app.use(express.json());

  // A real bearer token always implies an existing `app_users` row (Identity account creation
  // + Curator's own upsert-on-first-authenticated-request precede any Curator call reaching this
  // point). Mirror that here: auto-register the CALLING identity on every non-control route, so a
  // freshly-signed-in user's own `/me`/`/library`/`/users/{ownSub}/profile` call never spuriously
  // 404s just because no other seed/control call happened to touch their sub first. This only
  // registers the caller (from `X-E2E-Sub`, via `getUser`) -- a *target* sub named in a path
  // parameter (`/users/{sub}/...`) is still resolved through the non-mutating `findUser`, so an
  // unseeded/unknown target sub still correctly 404s.
  app.use((req: Request, _res: Response, next: () => void) => {
    if (!req.path.startsWith('/_test') && req.path !== '/health') {
      getUser(subFromRequest(req));
    }
    next();
  });

  // ── Control API (/_test/*) — test state management ──────────────────────

  /** Clear all state (called at the start of each test). */
  app.post('/_test/reset', (_req: Request, res: Response) => {
    users.clear();
    consoles.clear();
    definitions.clear();
    libraryRuns.clear();
    nextLibraryOutcome.clear();
    actionLog.clear();
    libraryGames.clear();
    profileSettings.clear();
    followEdges.length = 0;
    res.status(204).end();
  });

  /** Override the fixed catalog fixture (defaults back to the built-in list on reset). */
  app.post('/_test/catalog-games', (req: Request, res: Response) => {
    const body = req.body as { games?: GameSummary[] };
    CATALOG_GAMES = body.games ?? CATALOG_GAMES;
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's owned console ids (empty by default — capacity_fill/
   * install-toggle 404s are the default path, matching the real "no console CRUD" situation). */
  app.post('/_test/consoles', (req: Request, res: Response) => {
    const body = req.body as { consoleIds?: string[] };
    consoles.set(DEFAULT_SUB, new Set(body.consoleIds ?? []));
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's library entries (empty by default — GET /library). */
  app.post('/_test/library-games', (req: Request, res: Response) => {
    const body = req.body as { games?: SeededLibraryGame[] };
    libraryGames.set(DEFAULT_SUB, normalizeLibraryGames(body.games ?? []));
    res.status(204).end();
  });

  /** Configure the outcome the next `/library/refresh` job resolves to (default: succeeded), for
   * the current (DEFAULT_SUB) user. */
  app.post('/_test/library-refresh-outcome', (req: Request, res: Response) => {
    const body = req.body as LibraryRefreshOutcome;
    nextLibraryOutcome.set(DEFAULT_SUB, body);
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's PSN link state. */
  app.post('/_test/psn-link', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnLink>;
    const user = getUser(DEFAULT_SUB);
    const accessTokenExpiresAt: string | null =
      'access_token_expires_at' in body ? (body.access_token_expires_at ?? null) : '2026-08-01T00:00:00Z';
    const refreshTokenExpiresAt: string | null =
      'refresh_token_expires_at' in body ? (body.refresh_token_expires_at ?? null) : '2027-01-01T00:00:00Z';
    user.psn = { access_token_expires_at: accessTokenExpiresAt, refresh_token_expires_at: refreshTokenExpiresAt };
    user.psnAccountId ??= psnAccountIdFor(DEFAULT_SUB);
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's PSN harvest preferences (defaults back to all-false on
   * reset). */
  app.post('/_test/psn-preferences', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences>;
    const user = getUser(DEFAULT_SUB);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's enrichment-key status directly (defaults back to
   * unconfigured on reset) -- lets a test start from an already-configured state without going
   * through the UI first. */
  app.post('/_test/enrichment-keys', (req: Request, res: Response) => {
    const body = req.body as Partial<EnrichmentKeyStatus>;
    const user = getUser(DEFAULT_SUB);
    user.enrichmentKeys = { ...DEFAULT_ENRICHMENT_KEY_STATUS, ...body };
    res.status(204).end();
  });

  // ── Multi-user-aware profile/follow control API (explicit `sub`) ────────

  /** Register a sub as "known" (an `app_users` row exists) without seeding any other state --
   * covers the "viewing another user's default, unlinked, private profile" case. */
  app.post('/_test/seed-user', (req: Request, res: Response) => {
    const body = req.body as { sub: string };
    getUser(body.sub);
    res.status(204).end();
  });

  /** Seed an explicit user's PSN link state (see `/_test/psn-link` for the DEFAULT_SUB-only
   * equivalent this generalizes). */
  app.post('/_test/user/psn-link', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnLink> & { sub: string; psn_account_id?: string };
    const user = getUser(body.sub);
    const accessTokenExpiresAt: string | null =
      'access_token_expires_at' in body ? (body.access_token_expires_at ?? null) : '2026-08-01T00:00:00Z';
    const refreshTokenExpiresAt: string | null =
      'refresh_token_expires_at' in body ? (body.refresh_token_expires_at ?? null) : '2027-01-01T00:00:00Z';
    user.psn = { access_token_expires_at: accessTokenExpiresAt, refresh_token_expires_at: refreshTokenExpiresAt };
    user.psnAccountId = body.psn_account_id ?? user.psnAccountId ?? psnAccountIdFor(body.sub);
    res.status(204).end();
  });

  /** Seed an explicit user's PSN harvest preferences. */
  app.post('/_test/user/psn-preferences', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences> & { sub: string };
    const user = getUser(body.sub);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

  /** Seed an explicit user's profile display-visibility settings (`user_profiles`). */
  app.post('/_test/user/profile-settings', (req: Request, res: Response) => {
    const body = req.body as Partial<ProfileSettings> & { sub: string };
    getUser(body.sub);
    profileSettings.set(body.sub, { ...DEFAULT_PROFILE_SETTINGS, ...settingsFor(body.sub), ...body });
    res.status(204).end();
  });

  /** Seed an explicit user's library entries. */
  app.post('/_test/user/library-games', (req: Request, res: Response) => {
    const body = req.body as { sub: string; games?: SeededLibraryGame[] };
    getUser(body.sub);
    libraryGames.set(body.sub, normalizeLibraryGames(body.games ?? []));
    res.status(204).end();
  });

  /** Seed an explicit user's saved collection definitions. */
  app.post('/_test/user/collections', (req: Request, res: Response) => {
    const body = req.body as {
      sub: string;
      definitions?: { definition_id: string; name: string; kind: string; console_id?: string | null }[];
    };
    getUser(body.sub);
    definitions.set(
      body.sub,
      (body.definitions ?? []).map((d) => ({
        definition_id: d.definition_id,
        name: d.name,
        kind: d.kind,
        console_id: d.console_id ?? null,
        genre_filter: [],
        min_score: null,
        aaa_tier_filter: null,
      })),
    );
    res.status(204).end();
  });

  /** Seed a follow edge directly (bypassing `POST /users/{sub}/follow`). */
  app.post('/_test/follow', (req: Request, res: Response) => {
    const body = req.body as { follower_sub: string; followed_sub: string };
    getUser(body.follower_sub);
    getUser(body.followed_sub);
    if (!isFollowing(body.follower_sub, body.followed_sub)) {
      followEdges.push({ follower: body.follower_sub, followed: body.followed_sub, followedAt: new Date().toISOString() });
    }
    res.status(204).end();
  });

  // ── Curator API routes (no path prefix, matches the real upstream API) ──────

  /** GET /health — anonymous liveness check. */
  app.get('/health', (_req: Request, res: Response) => {
    res.type('text/plain').send('Healthy');
  });

  /** GET /me — current user + PSN link status. */
  app.get('/me', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    res.json({
      sub: user.sub,
      email: user.email,
      linked: user.psn !== null,
      psn: user.psn,
    });
  });

  /** DELETE /me — permanently delete the caller's account and all associated data. */
  app.delete('/me', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    logAction(sub, 'account_deleted');
    users.delete(sub);
    consoles.delete(sub);
    definitions.delete(sub);
    libraryGames.delete(sub);
    profileSettings.delete(sub);
    res.status(204).end();
  });

  /** GET /me/actions — the caller's own action-history log. */
  app.get('/me/actions', (req: Request, res: Response) => {
    res.json({ actions: actionLog.get(subFromRequest(req)) ?? [] });
  });

  /** POST /psn/link — link a PSN account via NPSSO token. */
  app.post('/psn/link', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const npsso = body['npsso'] as string | undefined;
    if (!npsso) {
      res.status(400).json({ error: 'npsso is required' });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    user.psn = { access_token_expires_at: '2026-08-01T00:00:00Z', refresh_token_expires_at: '2027-01-01T00:00:00Z' };
    user.psnAccountId ??= psnAccountIdFor(sub);
    logAction(sub, 'link_succeeded');
    res.status(200).json({ linked: true, psn: user.psn });
  });

  /** DELETE /psn/link — unlink the PSN account. */
  app.delete('/psn/link', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const user = getUser(sub);
    user.psn = null;
    logAction(sub, 'unlinked');
    res.status(204).end();
  });

  /** GET /me/psn-preferences — the caller's PSN harvest preference flags. 404 if not linked. */
  app.get('/me/psn-preferences', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    res.json(user.psnPreferences);
  });

  /** PUT /me/psn-preferences — replace all 4 harvest preference flags. 404 if not linked. */
  app.put('/me/psn-preferences', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    const body = req.body as Partial<PsnPreferences>;
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

  /** GET /me/enrichment-keys — the caller's RAWG/OpenCritic key status. Never 404s. */
  app.get('/me/enrichment-keys', (req: Request, res: Response) => {
    res.json(getUser(subFromRequest(req)).enrichmentKeys);
  });

  /** PUT /me/enrichment-keys/{provider} — set (or replace) a key. 400 if empty. */
  app.put('/me/enrichment-keys/:provider', (req: Request, res: Response) => {
    const { provider } = req.params;
    if (provider !== 'rawg' && provider !== 'opencritic') {
      res.status(422).json({ detail: 'Unknown provider.' });
      return;
    }
    const body = req.body as { api_key?: string };
    if (!body.api_key || !body.api_key.trim()) {
      res.status(400).json({ detail: 'api_key must not be empty.' });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    const now = new Date().toISOString();
    if (provider === 'rawg') {
      user.enrichmentKeys.rawg_configured = true;
      user.enrichmentKeys.rawg_added_at = now;
    } else {
      user.enrichmentKeys.opencritic_configured = true;
      user.enrichmentKeys.opencritic_added_at = now;
    }
    logAction(sub, 'enrichment_key_added', provider);
    res.status(204).end();
  });

  /** DELETE /me/enrichment-keys/{provider} — clear a key. */
  app.delete('/me/enrichment-keys/:provider', (req: Request, res: Response) => {
    const { provider } = req.params;
    if (provider !== 'rawg' && provider !== 'opencritic') {
      res.status(422).json({ detail: 'Unknown provider.' });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    if (provider === 'rawg') {
      user.enrichmentKeys.rawg_configured = false;
      user.enrichmentKeys.rawg_added_at = null;
    } else {
      user.enrichmentKeys.opencritic_configured = false;
      user.enrichmentKeys.opencritic_added_at = null;
    }
    logAction(sub, 'enrichment_key_removed', provider);
    res.status(204).end();
  });

  /** GET /trophies/summary — 404 if unlinked, 403 if harvest_trophies is off. */
  app.get('/trophies/summary', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_trophies) {
      res.status(403).json({ detail: 'Trophy harvesting is disabled for this account.' });
      return;
    }
    res.json(TROPHY_SUMMARY);
  });

  /** GET /identity — 404 if unlinked, 403 if harvest_identity is off. */
  app.get('/identity', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_identity) {
      res.status(403).json({ detail: 'Identity harvesting is disabled for this account.' });
      return;
    }
    res.json(IDENTITY);
  });

  /** GET /presence — 404 if unlinked, 403 if harvest_presence is off. */
  app.get('/presence', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_presence) {
      res.status(403).json({ detail: 'Presence harvesting is disabled for this account.' });
      return;
    }
    res.json(PRESENCE);
  });

  /** GET /devices — 404 if unlinked, 403 if harvest_devices is off. */
  app.get('/devices', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_devices) {
      res.status(403).json({ detail: 'Device harvesting is disabled for this account.' });
      return;
    }
    res.json(DEVICES);
  });

  /** GET /catalog/games — filter + paginate the fixed catalog fixture. */
  app.get('/catalog/games', (req: Request, res: Response) => {
    const franchise = req.query['franchise'] as string | undefined;
    const genre = req.query['genre'] as string | undefined;
    const aaaTier = req.query['aaaTier'] as string | undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;

    const filtered = CATALOG_GAMES.filter(
      (game) =>
        (!franchise || game.franchise === franchise) &&
        (!genre || game.genre === genre) &&
        (!aaaTier || game.aaa_tier === aaaTier),
    );
    res.json({ games: filtered.slice(offset, offset + limit) });
  });

  /** POST /collections/preview — generate an unpersisted collection from an inline spec. */
  app.post('/collections/preview', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const spec = req.body as {
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
    };

    if (spec.kind !== 'capacity_fill' && spec.kind !== 'filter_list') {
      res.status(400).json({ detail: "kind must be 'capacity_fill' or 'filter_list'." });
      return;
    }
    if (spec.kind === 'capacity_fill' && (!spec.console_id || !ownedConsoles(sub).has(spec.console_id))) {
      res.status(400).json({ detail: 'console_id is missing or unknown.' });
      return;
    }

    res.json(
      generateCollection(sub, {
        kind: spec.kind,
        genre_filter: spec.genre_filter ?? [],
        min_score: spec.min_score ?? null,
        aaa_tier_filter: spec.aaa_tier_filter ?? null,
      }),
    );
  });

  /** POST /collections — save a named collection definition. */
  app.post('/collections', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as {
      name: string;
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
    };

    if (body.kind !== 'capacity_fill' && body.kind !== 'filter_list') {
      res.status(400).json({ detail: "kind must be 'capacity_fill' or 'filter_list'." });
      return;
    }

    const definition: DefinitionRecord = {
      definition_id: `def-${userDefinitions(sub).length + 1}`,
      name: body.name,
      kind: body.kind,
      console_id: body.console_id ?? null,
      genre_filter: body.genre_filter ?? [],
      min_score: body.min_score ?? null,
      aaa_tier_filter: body.aaa_tier_filter ?? null,
    };
    userDefinitions(sub).push(definition);
    res.status(201).json(definition);
  });

  /** GET /collections — list the caller's saved definitions. */
  app.get('/collections', (req: Request, res: Response) => {
    res.json(userDefinitions(subFromRequest(req)));
  });

  /** POST /collections/{id}/runs — generate + persist a run against a saved definition. */
  app.post('/collections/:id/runs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === req.params['id']);
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }

    const result = generateCollection(sub, definition);
    res.status(201).json({ run_id: `run-${Date.now()}`, ...result });
  });

  /** PUT /consoles/{consoleId}/installs/{gameId} — set install-checked state on an owned console. */
  app.put('/consoles/:consoleId/installs/:gameId', (req: Request, res: Response) => {
    const { consoleId, gameId } = req.params;
    if (!ownedConsoles(subFromRequest(req)).has(consoleId)) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }

    const body = req.body as { installed: boolean };
    res.json({ console_id: consoleId, game_id: gameId, installed: body.installed });
  });

  /** GET /library — the caller's own library: server-side search/filter/sort/paging. */
  app.get('/library', (req: Request, res: Response) => {
    res.json(queryLibraryGames(libraryGames.get(subFromRequest(req)) ?? [], req));
  });

  /** GET /library/categories — the distinct, sorted categories in the caller's own library. */
  app.get('/library/categories', (req: Request, res: Response) => {
    res.json({ categories: libraryCategories(libraryGames.get(subFromRequest(req)) ?? []) });
  });

  /** POST /library/refresh — queue a job that transitions queued -> running -> a terminal status
   * on short timers, so the real Angular poll loop observes a genuine state transition. */
  app.post('/library/refresh', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const runId = `lib-run-${Date.now()}`;
    libraryRuns.set(runId, { sub, status: 'queued', error: null, result_summary: null });

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        run.status = 'running';
      }
    }, 300);

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        const outcome = nextLibraryOutcome.get(sub) ?? { status: 'succeeded' };
        run.status = outcome.status;
        run.error = outcome.error ?? null;
        run.result_summary =
          outcome.status === 'succeeded'
            ? (outcome.result_summary ?? {
                rawg_enriched_titles: [],
                opencritic_enriched_titles: [],
                opencritic_topup_incomplete: false,
              })
            : null;
      }
    }, 900);

    res.status(202).json({ run_id: runId });
  });

  /** GET /library/refresh/{runId} — poll a queued library-refresh job's status. */
  app.get('/library/refresh/:runId', (req: Request, res: Response) => {
    const run = libraryRuns.get(req.params['runId']);
    if (!run || run.sub !== subFromRequest(req)) {
      res.status(404).json({ detail: 'Library refresh run not found.' });
      return;
    }
    res.json({ run_id: req.params['runId'], status: run.status, error: run.error, result_summary: run.result_summary });
  });

  // ── Social profile / follow routes ───────────────────────────────────────

  /** GET /me/profile-settings — the caller's own display-visibility toggles. Never 404s. */
  app.get('/me/profile-settings', (req: Request, res: Response) => {
    res.json(settingsFor(subFromRequest(req)));
  });

  /** PUT /me/profile-settings — replace the caller's own display-visibility toggles. */
  app.put('/me/profile-settings', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as Partial<ProfileSettings>;
    const next: ProfileSettings = { ...DEFAULT_PROFILE_SETTINGS, ...body };
    profileSettings.set(sub, next);
    res.json(next);
  });

  /** GET /users/{sub}/profile — `sub`'s public profile, as seen by the caller. 404 if `sub` is
   * unknown. Follow status/counts are never gated by `is_public`. A non-owner viewing a private
   * profile still gets 200, with the PSN-derived sections nulled out. */
  app.get('/users/:sub/profile', (req: Request, res: Response) => {
    const target = req.params['sub'];
    const viewer = subFromRequest(req);
    const targetUser = findUser(target);
    if (!targetUser) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }

    const settings = settingsFor(target);
    const viewerIsOwner = viewer === target;
    const viewerCanSeePublicSections = viewerIsOwner || settings.is_public;

    const psnAccountId =
      viewerCanSeePublicSections && targetUser.psn ? (targetUser.psnAccountId ?? psnAccountIdFor(target)) : null;
    const libraryVisible = viewerIsOwner || (settings.is_public && settings.show_library);
    const collectionsVisible = viewerIsOwner || (settings.is_public && settings.show_collections);

    let trophies: { level: number; tier: number; earned: typeof TROPHY_SUMMARY.earned } | null = null;
    let identity: { online_id: string } | null = null;

    const trophiesGateOpen =
      viewerCanSeePublicSections && settings.show_trophies && targetUser.psn !== null && targetUser.psnPreferences.harvest_trophies;
    const identityGateOpen =
      viewerCanSeePublicSections && settings.show_identity && targetUser.psn !== null && targetUser.psnPreferences.harvest_identity;

    if (trophiesGateOpen || identityGateOpen) {
      // Mirrors the real profile_routes.py's "viewer's own PSN client" mechanism: the sections
      // degrade silently (stay null) when the viewer has no PSN link of their own, rather than
      // erroring — a stale/missing viewer token must never break rendering another user's profile.
      const viewerUser = findUser(viewer);
      const viewerHasPsn = viewerUser?.psn != null;
      if (trophiesGateOpen && viewerHasPsn) {
        trophies = { level: TROPHY_SUMMARY.level, tier: TROPHY_SUMMARY.tier, earned: TROPHY_SUMMARY.earned };
      }
      if (identityGateOpen && viewerHasPsn) {
        identity = { online_id: onlineIdFor(target) };
      }
    }

    res.json({
      sub: target,
      psn_account_id: psnAccountId,
      is_public: settings.is_public,
      viewer_is_owner: viewerIsOwner,
      viewer_is_following: isFollowing(viewer, target),
      follower_count: followerCount(target),
      following_count: followingCount(target),
      library_visible: libraryVisible,
      collections_visible: collectionsVisible,
      trophies,
      identity,
    });
  });

  /** POST /users/{sub}/follow — follow `sub`. Idempotent. 404 unknown sub, 400 self-follow. */
  app.post('/users/:sub/follow', (req: Request, res: Response) => {
    const target = req.params['sub'];
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }
    if (target === viewer) {
      res.status(400).json({ detail: 'Cannot follow yourself.' });
      return;
    }
    if (!isFollowing(viewer, target)) {
      followEdges.push({ follower: viewer, followed: target, followedAt: new Date().toISOString() });
    }
    logAction(viewer, 'followed', target);
    res.status(204).end();
  });

  /** DELETE /users/{sub}/follow — unfollow `sub`. Always 204, idempotent. */
  app.delete('/users/:sub/follow', (req: Request, res: Response) => {
    const target = req.params['sub'];
    const viewer = subFromRequest(req);
    const idx = followEdges.findIndex((e) => e.follower === viewer && e.followed === target);
    if (idx >= 0) {
      followEdges.splice(idx, 1);
      logAction(viewer, 'unfollowed', target);
    }
    res.status(204).end();
  });

  /** GET /users/{sub}/followers — paginated, newest first. 404 unknown sub. Never gated by
   * `is_public`. Each entry's `psn_account_id` reflects only *that* user's own visibility, not
   * the caller's. */
  app.get('/users/:sub/followers', (req: Request, res: Response) => {
    const target = req.params['sub'];
    if (!findUser(target)) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;
    const all = listFollowers(target);
    const page = all.slice(offset, offset + limit);
    res.json({
      entries: page.map((e) => ({
        sub: e.follower,
        psn_account_id:
          settingsFor(e.follower).is_public && findUser(e.follower)?.psn
            ? (findUser(e.follower)?.psnAccountId ?? psnAccountIdFor(e.follower))
            : null,
        followed_at: e.followedAt,
      })),
      total: all.length,
    });
  });

  /** GET /users/{sub}/following — paginated, newest first. 404 unknown sub. Never gated by
   * `is_public`. */
  app.get('/users/:sub/following', (req: Request, res: Response) => {
    const target = req.params['sub'];
    if (!findUser(target)) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;
    const all = listFollowing(target);
    const page = all.slice(offset, offset + limit);
    res.json({
      entries: page.map((e) => ({
        sub: e.followed,
        psn_account_id:
          settingsFor(e.followed).is_public && findUser(e.followed)?.psn
            ? (findUser(e.followed)?.psnAccountId ?? psnAccountIdFor(e.followed))
            : null,
        followed_at: e.followedAt,
      })),
      total: all.length,
    });
  });

  /** Shared 404/403 gate for the library passthrough routes below. Returns `true` (and has already
   * written the response) if the request should stop here. */
  function libraryVisibilityGate(req: Request, res: Response): boolean {
    const target = req.params['sub'];
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(404).json({ detail: 'User not found.' });
      return true;
    }
    if (target !== viewer) {
      const settings = settingsFor(target);
      if (!(settings.is_public && settings.show_library)) {
        res.status(403).json({ detail: "This section of the user's profile is not public." });
        return true;
      }
    }
    return false;
  }

  /** GET /users/{sub}/library — read-only, same server-side search/filter/sort/paging as the
   * caller's-own GET /library. 404 unknown sub. 403 unless the caller is the owner or the target's
   * profile is both public and `show_library`. */
  app.get('/users/:sub/library', (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json(queryLibraryGames(libraryGames.get(req.params['sub']) ?? [], req));
  });

  /** GET /users/{sub}/library/categories — read-only. Same visibility gate as the library itself. */
  app.get('/users/:sub/library/categories', (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json({ categories: libraryCategories(libraryGames.get(req.params['sub']) ?? []) });
  });

  /** GET /users/{sub}/collections — read-only. 404 unknown sub. 403 unless caller is the owner or
   * the target's profile is both public and `show_collections`. */
  app.get('/users/:sub/collections', (req: Request, res: Response) => {
    const target = req.params['sub'];
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }
    if (target !== viewer) {
      const settings = settingsFor(target);
      if (!(settings.is_public && settings.show_collections)) {
        res.status(403).json({ detail: "This section of the user's profile is not public." });
        return;
      }
    }
    res.json(userDefinitions(target).map(toProfileDefinition));
  });

  return app;
}
