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



export interface PsnLink {
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

export interface PsnPreferences {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
  allow_friend_writes: boolean;
  allow_chat_writes: boolean;
}

export interface EnrichmentKeyStatus {
  rawg_configured: boolean;
  opencritic_configured: boolean;
  rawg_added_at: string | null;
  opencritic_added_at: string | null;
  rawg_key_rejected_at: string | null;
  opencritic_key_rejected_at: string | null;
}

const DEFAULT_ENRICHMENT_KEY_STATUS: EnrichmentKeyStatus = {
  rawg_configured: false,
  opencritic_configured: false,
  rawg_added_at: null,
  opencritic_added_at: null,
  rawg_key_rejected_at: null,
  opencritic_key_rejected_at: null,
};

export interface UserRecord {
  sub: string;
  email: string | null;
  psn: PsnLink | null;
  psnAccountId: string | null;
  psnPreferences: PsnPreferences;
  enrichmentKeys: EnrichmentKeyStatus;
  isAdmin: boolean;
}

const DEFAULT_PSN_PREFERENCES: PsnPreferences = {
  harvest_trophies: false,
  harvest_identity: false,
  harvest_presence: false,
  harvest_devices: false,
  allow_friend_writes: false,
  allow_chat_writes: false,
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
  critical_score?: number | null;
  oc_score?: number | null;
  psn_rating?: number | null;
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
  identity_sub: string;
  definition_id: string;
  name: string;
  description: string | null;
  kind: string;
  console_id: string | null;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
  include_inactive: boolean;
  min_percent_completed: number | null;
  visibility: 'private' | 'unlisted' | 'public';
  share_slug: string;
  game_ids: string[];
}

interface CollectionItem {
  game_id: string;
  rank: number;
  title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
  critical_score: number | null;
  oc_score: number | null;
  psn_rating: number | null;
  cover_image_url: string | null;
  owner_has_access: boolean;
}

interface ConsoleRecord {
  console_id: string;
  identity_sub: string;
  name: string;
  platform: string;
  raw_capacity_gb: number;
  model: string | null;
  update_buffer_gb: number;
  routing_genres: string[];
  fill_order: number;
}

interface StorageDeviceRecord {
  device_id: string;
  identity_sub: string;
  console_id: string | null;
  name: string;
  kind: string;
  capacity_gb: number;
  buffer_gb: number;
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
  percent_completed: number | null;
  platforms: string[];
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
    percent_completed: g.percent_completed ?? null,
    platforms: g.platforms ?? [],
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



interface ActionLogEntry {
  action: string;
  detail: string | null;
  occurred_at: string;
}

interface CollectionFollowEdge {
  follower: string;
  definitionId: string;
  followedAt: string;
}

const users = new Map<string, UserRecord>();
const consoleRecords = new Map<string, ConsoleRecord[]>();
const storageDeviceRecords = new Map<string, StorageDeviceRecord[]>();
const consoleInstalls = new Map<string, Set<string>>();
const deviceInstalls = new Map<string, Set<string>>();
const definitions = new Map<string, DefinitionRecord[]>();
const collectionFollows: CollectionFollowEdge[] = [];
const libraryRuns = new Map<string, LibraryRun>();
const nextLibraryOutcome = new Map<string, LibraryRefreshOutcome>();
const actionLog = new Map<string, ActionLogEntry[]>();
const libraryGames = new Map<string, LibraryGame[]>();
const profileSettings = new Map<string, ProfileSettings>();
const followEdges: FollowEdge[] = [];

const DEFAULT_SUB = 'e2e-user-id';
let nextShareSlug = 1;
let nextConsoleId = 1;
let nextDeviceId = 1;

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
      isAdmin: false,
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

function userConsoles(sub: string): ConsoleRecord[] {
  let list = consoleRecords.get(sub);
  if (!list) {
    list = [];
    consoleRecords.set(sub, list);
  }
  return list;
}

function ownedConsoles(sub: string): Set<string> {
  return new Set(userConsoles(sub).map((c) => c.console_id));
}

function findOwnedConsole(sub: string, consoleId: string): ConsoleRecord | undefined {
  return userConsoles(sub).find((c) => c.console_id === consoleId);
}

function userDevices(sub: string): StorageDeviceRecord[] {
  let list = storageDeviceRecords.get(sub);
  if (!list) {
    list = [];
    storageDeviceRecords.set(sub, list);
  }
  return list;
}

function findOwnedDevice(sub: string, deviceId: string): StorageDeviceRecord | undefined {
  return userDevices(sub).find((d) => d.device_id === deviceId);
}

function userDefinitions(sub: string): DefinitionRecord[] {
  let list = definitions.get(sub);
  if (!list) {
    list = [];
    definitions.set(sub, list);
  }
  return list;
}

function findDefinitionAnyOwner(definitionId: string): DefinitionRecord | undefined {
  for (const list of definitions.values()) {
    const found = list.find((d) => d.definition_id === definitionId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function toDefinitionResponse(d: DefinitionRecord): Omit<DefinitionRecord, 'identity_sub' | 'game_ids'> & { item_count: number } {
  return {
    definition_id: d.definition_id,
    name: d.name,
    description: d.description,
    kind: d.kind,
    console_id: d.console_id,
    genre_filter: d.genre_filter,
    min_score: d.min_score,
    aaa_tier_filter: d.aaa_tier_filter,
    include_inactive: d.include_inactive,
    min_percent_completed: d.min_percent_completed,
    visibility: d.visibility,
    share_slug: d.share_slug,
    item_count: d.game_ids.length,
  };
}

/** Deterministic mock artwork/score fixtures for a collection item, matched to CATALOG_GAMES. */
function toCollectionItem(gameId: string, rank: number): CollectionItem {
  const game = CATALOG_GAMES.find((g) => g.game_id === gameId);
  return {
    game_id: gameId,
    rank,
    title: game?.canonical_title ?? gameId,
    franchise: game?.franchise ?? null,
    genre: game?.genre ?? null,
    aaa_tier: game?.aaa_tier ?? null,
    critical_score: 85,
    oc_score: 82,
    psn_rating: 4.5,
    cover_image_url: null,
    owner_has_access: game !== undefined,
  };
}

function toDefinitionItems(d: DefinitionRecord): CollectionItem[] {
  return d.game_ids.map((gameId, index) => toCollectionItem(gameId, index + 1));
}

function toConsoleResponse(c: ConsoleRecord): Omit<ConsoleRecord, 'identity_sub'> & { effective_capacity_gb: number; capacity_is_default: boolean } {
  return {
    console_id: c.console_id,
    name: c.name,
    platform: c.platform,
    raw_capacity_gb: c.raw_capacity_gb,
    model: c.model,
    update_buffer_gb: c.update_buffer_gb,
    effective_capacity_gb: c.raw_capacity_gb - c.update_buffer_gb,
    routing_genres: c.routing_genres,
    fill_order: c.fill_order,
    capacity_is_default: false,
  };
}

function toDeviceResponse(d: StorageDeviceRecord): Omit<StorageDeviceRecord, 'identity_sub'> & { effective_capacity_gb: number } {
  return {
    device_id: d.device_id,
    console_id: d.console_id,
    name: d.name,
    kind: d.kind,
    capacity_gb: d.capacity_gb,
    buffer_gb: d.buffer_gb,
    effective_capacity_gb: d.capacity_gb - d.buffer_gb,
  };
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
  void sub;

  const included: CollectionGame[] = [];
  const excluded: CollectionGame[] = [];
  for (const game of CATALOG_GAMES) {
    (matches(game) ? included : excluded).push(toCollectionGame(game));
  }

  const usedGb = included.length > 0 ? included.reduce((sum, game) => sum + game.size_gb, 0) : null;
  return { included, excluded, used_gb: usedGb };
}

function toProfileDefinition(
  d: DefinitionRecord,
): { definition_id: string; name: string; kind: string; console_id: string | null; item_count: number } {
  return { definition_id: d.definition_id, name: d.name, kind: d.kind, console_id: d.console_id, item_count: d.game_ids.length };
}



export function createCuratorApp(): Express {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: () => void) => {
    if (!req.path.startsWith('/_test') && req.path !== '/health') {
      getUser(subFromRequest(req));
    }
    next();
  });



  /** Clear all state (called at the start of each test). */
  app.post('/_test/reset', (_req: Request, res: Response) => {
    users.clear();
    consoleRecords.clear();
    storageDeviceRecords.clear();
    consoleInstalls.clear();
    deviceInstalls.clear();
    definitions.clear();
    collectionFollows.length = 0;
    libraryRuns.clear();
    nextLibraryOutcome.clear();
    actionLog.clear();
    libraryGames.clear();
    profileSettings.clear();
    followEdges.length = 0;
    nextShareSlug = 1;
    nextConsoleId = 1;
    nextDeviceId = 1;
    res.status(204).end();
  });

  /** Override the fixed catalog fixture (defaults back to the built-in list on reset). */
  app.post('/_test/catalog-games', (req: Request, res: Response) => {
    const body = req.body as { games?: GameSummary[] };
    CATALOG_GAMES = body.games ?? CATALOG_GAMES;
    res.status(204).end();
  });

  /** Seed the current (DEFAULT_SUB) user's owned console ids as minimal PS5 console records (empty
   * by default — capacity_fill/install-toggle 404s are the default path). */
  app.post('/_test/consoles', (req: Request, res: Response) => {
    const body = req.body as { consoleIds?: string[] };
    consoleRecords.set(
      DEFAULT_SUB,
      (body.consoleIds ?? []).map((consoleId) => ({
        console_id: consoleId,
        identity_sub: DEFAULT_SUB,
        name: consoleId,
        platform: 'PS5',
        raw_capacity_gb: 825,
        model: null,
        update_buffer_gb: 0,
        routing_genres: [],
        fill_order: 0,
      })),
    );
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

  app.post('/_test/admin', (req: Request, res: Response) => {
    const body = req.body as { isAdmin?: boolean };
    getUser(DEFAULT_SUB).isAdmin = body.isAdmin ?? true;
    res.status(204).end();
  });

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
      definitions?: {
        definition_id: string;
        name: string;
        kind: string;
        console_id?: string | null;
        visibility?: 'private' | 'unlisted' | 'public';
        game_ids?: string[];
      }[];
    };
    getUser(body.sub);
    definitions.set(
      body.sub,
      (body.definitions ?? []).map((d) => ({
        identity_sub: body.sub,
        definition_id: d.definition_id,
        name: d.name,
        description: null,
        kind: d.kind,
        console_id: d.console_id ?? null,
        genre_filter: [],
        min_score: null,
        aaa_tier_filter: null,
        include_inactive: false,
        min_percent_completed: null,
        visibility: d.visibility ?? 'private',
        share_slug: `slug-${nextShareSlug++}`,
        game_ids: d.game_ids ?? [],
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
      is_admin: user.isAdmin,
    });
  });

  /** DELETE /me — permanently delete the caller's account and all associated data. */
  app.delete('/me', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    logAction(sub, 'account_deleted');
    users.delete(sub);
    consoleRecords.delete(sub);
    storageDeviceRecords.delete(sub);
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
      user.enrichmentKeys.rawg_key_rejected_at = null; // a successful save proves any prior rejection is stale
    } else {
      user.enrichmentKeys.opencritic_configured = true;
      user.enrichmentKeys.opencritic_added_at = now;
      user.enrichmentKeys.opencritic_key_rejected_at = null;
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
    const q = req.query['q'] as string | undefined;
    const franchise = req.query['franchise'] as string | undefined;
    const genre = req.query['genre'] as string | undefined;
    const aaaTier = req.query['aaaTier'] as string | undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;

    const filtered = CATALOG_GAMES.filter(
      (game) =>
        (!q || game.canonical_title.toLowerCase().includes(q.toLowerCase())) &&
        (!franchise || game.franchise === franchise) &&
        (!genre || game.genre === genre) &&
        (!aaaTier || game.aaa_tier === aaaTier),
    );
    const page = filtered.slice(offset, offset + limit).map((game) => ({
      ...game,
      cover_image_url: null,
      store_product_id: null,
      critical_score: game.critical_score ?? null,
      oc_score: game.oc_score ?? null,
      psn_rating: game.psn_rating ?? null,
    }));
    res.json({ games: page, total: filtered.length });
  });

  /** GET /catalog/genres — the genres carried by at least one game in the catalog fixture. */
  app.get('/catalog/genres', (_req: Request, res: Response) => {
    const genres = [...new Set(CATALOG_GAMES.map((game) => game.genre).filter((genre): genre is string => !!genre))];
    res.json({ genres });
  });

  /** GET /catalog/games/:gameId — one catalogued game, 404 when the id is unknown. */
  app.get('/catalog/games/:gameId', (req: Request, res: Response) => {
    const game = CATALOG_GAMES.find((candidate) => candidate.game_id === req.params['gameId']);
    if (!game) {
      res.status(404).json({ detail: 'No such game.' });
      return;
    }
    res.json({
      ...game,
      cover_image_url: null,
      store_product_id: null,
      critical_score: game.critical_score ?? null,
      oc_score: game.oc_score ?? null,
      psn_rating: game.psn_rating ?? null,
    });
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

  /** POST /collections — save a named collection definition, freezing `game_ids` as its membership. */
  app.post('/collections', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as {
      name: string;
      description?: string | null;
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
      include_inactive?: boolean;
      min_percent_completed?: number | null;
      game_ids?: string[];
    };

    if (body.kind !== 'capacity_fill' && body.kind !== 'filter_list') {
      res.status(400).json({ detail: "kind must be 'capacity_fill' or 'filter_list'." });
      return;
    }
    if (userDefinitions(sub).some((d) => d.name === body.name)) {
      res.status(409).json({ detail: `You already have a collection named '${body.name}'.` });
      return;
    }

    const definition: DefinitionRecord = {
      identity_sub: sub,
      definition_id: `def-${userDefinitions(sub).length + 1}`,
      name: body.name,
      description: body.description ?? null,
      kind: body.kind,
      console_id: body.console_id ?? null,
      genre_filter: body.genre_filter ?? [],
      min_score: body.min_score ?? null,
      aaa_tier_filter: body.aaa_tier_filter ?? null,
      include_inactive: body.include_inactive ?? false,
      min_percent_completed: body.min_percent_completed ?? null,
      visibility: 'private',
      share_slug: `slug-${nextShareSlug++}`,
      game_ids: body.game_ids ?? [],
    };
    userDefinitions(sub).push(definition);
    res.status(201).json(toDefinitionResponse(definition));
  });

  /** GET /collections — list the caller's saved definitions. */
  app.get('/collections', (req: Request, res: Response) => {
    res.json(userDefinitions(subFromRequest(req)).map(toDefinitionResponse));
  });

  /** GET /collections/followed — every collection the caller follows. Registered before
   * GET /collections/:id below -- Express matches routes in registration order, same reasoning as
   * the real Curator route. */
  app.get('/collections/followed', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const followed = collectionFollows
      .filter((f) => f.follower === sub)
      .sort((a, b) => b.followedAt.localeCompare(a.followedAt))
      .map((f) => findDefinitionAnyOwner(f.definitionId))
      .filter((d): d is DefinitionRecord => d !== undefined);
    res.json(followed.map(toDefinitionResponse));
  });

  /** GET /collections/{id} — the caller's own collection, with its items. */
  app.get('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === req.params['id']);
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    res.json({ ...toDefinitionResponse(definition), items: toDefinitionItems(definition) });
  });

  /** PATCH /collections/{id} — rename, change description, and/or replace membership. */
  app.patch('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === req.params['id']);
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    const body = req.body as { name?: string; description?: string | null; game_ids?: string[] };
    if (body.name !== undefined && userDefinitions(sub).some((d) => d !== definition && d.name === body.name)) {
      res.status(409).json({ detail: `You already have a collection named '${body.name}'.` });
      return;
    }
    if (body.name !== undefined) {
      definition.name = body.name;
    }
    if ('description' in body) {
      definition.description = body.description ?? null;
    }
    if (body.game_ids !== undefined) {
      definition.game_ids = body.game_ids;
    }
    res.json({ ...toDefinitionResponse(definition), items: toDefinitionItems(definition) });
  });

  /** PUT /collections/{id}/visibility — change private/unlisted/public. */
  app.put('/collections/:id/visibility', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === req.params['id']);
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    const body = req.body as { visibility: string };
    if (body.visibility !== 'private' && body.visibility !== 'unlisted' && body.visibility !== 'public') {
      res.status(400).json({ detail: 'visibility must be "private", "unlisted", or "public".' });
      return;
    }
    definition.visibility = body.visibility;
    res.json(toDefinitionResponse(definition));
  });

  /** DELETE /collections/{id} — delete one of the caller's collections. */
  app.delete('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDefinitions(sub);
    const idx = list.findIndex((d) => d.definition_id === req.params['id']);
    if (idx < 0) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    list.splice(idx, 1);
    res.status(204).end();
  });

  /** POST /collections/{id}/follow — follow a collection that isn't the caller's own. */
  app.post('/collections/:id/follow', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = findDefinitionAnyOwner(req.params['id']);
    if (!definition || definition.visibility === 'private') {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    if (definition.identity_sub === sub) {
      res.status(400).json({ detail: 'Cannot follow your own collection.' });
      return;
    }
    if (!collectionFollows.some((f) => f.follower === sub && f.definitionId === definition.definition_id)) {
      collectionFollows.push({ follower: sub, definitionId: definition.definition_id, followedAt: new Date().toISOString() });
    }
    res.status(204).end();
  });

  /** DELETE /collections/{id}/follow — unfollow. Always 204, idempotent. */
  app.delete('/collections/:id/follow', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const idx = collectionFollows.findIndex((f) => f.follower === sub && f.definitionId === req.params['id']);
    if (idx >= 0) {
      collectionFollows.splice(idx, 1);
    }
    res.status(204).end();
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



  /** GET /public/collections/{shareSlug} — the one anonymous route in the real API. No caller
   * identity is trusted; an unknown slug and a currently-private collection's slug are
   * indistinguishable 404s. */
  app.get('/public/collections/:shareSlug', (req: Request, res: Response) => {
    const shareSlug = req.params['shareSlug'];
    let found: DefinitionRecord | undefined;
    for (const list of definitions.values()) {
      found = list.find((d) => d.share_slug === shareSlug);
      if (found) break;
    }
    if (!found || found.visibility === 'private') {
      res.status(404).json({ detail: 'Collection not found.' });
      return;
    }
    res.json({
      definition_id: found.definition_id,
      name: found.name,
      description: found.description,
      visibility: found.visibility,
      items: toDefinitionItems(found),
    });
  });



  /** POST /consoles — create a console for the caller. */
  app.post('/consoles', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as {
      name: string;
      platform: string;
      raw_capacity_gb?: number | null;
      model?: string | null;
      update_buffer_gb?: number;
      routing_genres?: string[];
      fill_order?: number;
    };
    if (body.platform !== 'PS5' && body.platform !== 'PS4') {
      res.status(400).json({ detail: 'platform must be "PS5" or "PS4".' });
      return;
    }
    const capacityIsDefault = body.raw_capacity_gb === undefined || body.raw_capacity_gb === null;
    const record: ConsoleRecord = {
      console_id: `console-${nextConsoleId++}`,
      identity_sub: sub,
      name: body.name,
      platform: body.platform,
      raw_capacity_gb: body.raw_capacity_gb ?? (body.platform === 'PS5' ? 825 : 500),
      model: body.model ?? null,
      update_buffer_gb: body.update_buffer_gb ?? 0,
      routing_genres: body.routing_genres ?? [],
      fill_order: body.fill_order ?? 0,
    };
    userConsoles(sub).push(record);
    res.status(201).json({ ...toConsoleResponse(record), capacity_is_default: capacityIsDefault });
  });

  /** GET /consoles — list the caller's own consoles. */
  app.get('/consoles', (req: Request, res: Response) => {
    res.json(userConsoles(subFromRequest(req)).map(toConsoleResponse));
  });

  /** PATCH /consoles/{id} — patch a console's editable fields. */
  app.patch('/consoles/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedConsole(sub, req.params['id']);
    if (!record) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }
    const body = req.body as Partial<Pick<ConsoleRecord, 'name' | 'raw_capacity_gb' | 'update_buffer_gb' | 'routing_genres' | 'fill_order'>>;
    Object.assign(record, body);
    res.json(toConsoleResponse(record));
  });

  /** DELETE /consoles/{id} — delete a console (its own installs go with it; an attached storage
   * device is detached, not deleted). */
  app.delete('/consoles/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userConsoles(sub);
    const idx = list.findIndex((c) => c.console_id === req.params['id']);
    if (idx < 0) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }
    const [removed] = list.splice(idx, 1);
    consoleInstalls.delete(removed.console_id);
    for (const device of userDevices(sub)) {
      if (device.console_id === removed.console_id) {
        device.console_id = null;
      }
    }
    res.status(204).end();
  });

  /** GET /consoles/{id}/installs — every game id currently marked installed on this console. */
  app.get('/consoles/:id/installs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedConsole(sub, req.params['id'])) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }
    res.json({ game_ids: Array.from(consoleInstalls.get(req.params['id']) ?? []).sort() });
  });

  /** PUT /consoles/{consoleId}/installs/{gameId} — set install-checked state on an owned console. */
  app.put('/consoles/:consoleId/installs/:gameId', (req: Request, res: Response) => {
    const { consoleId, gameId } = req.params;
    if (!ownedConsoles(subFromRequest(req)).has(consoleId)) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }

    const body = req.body as { installed: boolean };
    let installed = consoleInstalls.get(consoleId);
    if (!installed) {
      installed = new Set();
      consoleInstalls.set(consoleId, installed);
    }
    if (body.installed) {
      installed.add(gameId);
    } else {
      installed.delete(gameId);
    }
    res.json({ console_id: consoleId, game_id: gameId, installed: body.installed });
  });



  /** POST /storage-devices — create a storage device for the caller, optionally attached. */
  app.post('/storage-devices', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as { name: string; kind: string; capacity_gb: number; buffer_gb?: number; console_id?: string | null };
    if (body.kind !== 'm2' && body.kind !== 'usb') {
      res.status(400).json({ detail: 'kind must be "m2" or "usb".' });
      return;
    }
    if (body.console_id && !findOwnedConsole(sub, body.console_id)) {
      res.status(400).json({ detail: `Unknown console_id '${body.console_id}' for this user.` });
      return;
    }
    const record: StorageDeviceRecord = {
      device_id: `device-${nextDeviceId++}`,
      identity_sub: sub,
      console_id: body.console_id ?? null,
      name: body.name,
      kind: body.kind,
      capacity_gb: body.capacity_gb,
      buffer_gb: body.buffer_gb ?? 0,
    };
    userDevices(sub).push(record);
    res.status(201).json(toDeviceResponse(record));
  });

  /** GET /storage-devices — list the caller's own devices, attached or not. */
  app.get('/storage-devices', (req: Request, res: Response) => {
    res.json(userDevices(subFromRequest(req)).map(toDeviceResponse));
  });

  /** PATCH /storage-devices/{id} — patch a device's editable fields. */
  app.patch('/storage-devices/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, req.params['id']);
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    const body = req.body as Partial<Pick<StorageDeviceRecord, 'name' | 'capacity_gb' | 'buffer_gb'>>;
    Object.assign(record, body);
    res.json(toDeviceResponse(record));
  });

  /** DELETE /storage-devices/{id} — delete a device (cascades to its own install rows). */
  app.delete('/storage-devices/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDevices(sub);
    const idx = list.findIndex((d) => d.device_id === req.params['id']);
    if (idx < 0) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    const [removed] = list.splice(idx, 1);
    deviceInstalls.delete(removed.device_id);
    res.status(204).end();
  });

  /** PUT /storage-devices/{id}/attach/{consoleId} — attach a device to one of the caller's consoles. */
  app.put('/storage-devices/:id/attach/:consoleId', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, req.params['id']);
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    if (!findOwnedConsole(sub, req.params['consoleId'])) {
      res.status(400).json({ detail: `Unknown console_id '${req.params['consoleId']}' for this user.` });
      return;
    }
    record.console_id = req.params['consoleId'];
    res.json(toDeviceResponse(record));
  });

  /** DELETE /storage-devices/{id}/attach — detach a device from whichever console it's on. */
  app.delete('/storage-devices/:id/attach', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, req.params['id']);
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    record.console_id = null;
    res.json(toDeviceResponse(record));
  });

  /** GET /storage-devices/{id}/installs — every game id currently marked installed on this device. */
  app.get('/storage-devices/:id/installs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedDevice(sub, req.params['id'])) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    res.json({ game_ids: Array.from(deviceInstalls.get(req.params['id']) ?? []).sort() });
  });

  /** PUT /storage-devices/{id}/installs/{gameId} — set install-checked state on a device. Marking a
   * PS5 title installed on kind="usb" is allowed (Sony's own Extended Storage) -- see the real
   * route's docstring; this mock never rejects it either. */
  app.put('/storage-devices/:deviceId/installs/:gameId', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const { deviceId, gameId } = req.params;
    if (!findOwnedDevice(sub, deviceId)) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    const body = req.body as { installed: boolean };
    let installed = deviceInstalls.get(deviceId);
    if (!installed) {
      installed = new Set();
      deviceInstalls.set(deviceId, installed);
    }
    if (body.installed) {
      installed.add(gameId);
    } else {
      installed.delete(gameId);
    }
    res.json({ device_id: deviceId, game_id: gameId, installed: body.installed });
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
