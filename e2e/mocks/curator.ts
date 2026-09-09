
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

export interface RefreshSchedule {
  cadence: 'daily' | 'weekly' | 'monthly';
  ps_plus_watch: boolean;
  next_run_at: string;
  last_run_at: string | null;
  consecutive_failures: number;
  paused_reason: string | null;
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
  refreshSchedule: RefreshSchedule | null;
  isAdmin: boolean;
}

const DEFAULT_REFRESH_SCHEDULE: RefreshSchedule = {
  cadence: 'weekly',
  ps_plus_watch: false,
  next_run_at: '2026-03-09T07:43:34+00:00',
  last_run_at: '2026-03-02T07:43:34+00:00',
  consecutive_failures: 0,
  paused_reason: null,
};

const ACCOUNT_CREATED_AT = '2026-01-02T03:04:05+00:00';

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

export type SizeSource = 'measured' | 'estimated' | 'default';

export const UNMEASURED_SIZE_SOURCE: SizeSource = 'default';

export interface GameSummary {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
  critical_score?: number | null;
  oc_score?: number | null;
  psn_rating?: number | null;
  size_source?: SizeSource;
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
  size_source: SizeSource;
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
  install_target_console_id: string | null;
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
  installed_on_target: boolean | null;
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
  genre: string | null;
  rawg_rating: number | null;
  opencritic_rating: number | null;
  psn_rating: number | null;
  psn_product_id: string | null;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
  percent_completed: number | null;
  platforms: string[];
  source: string;
}

const LIBRARY_SORT_FIELDS = ['title', 'genre', 'rawg_rating', 'opencritic_rating', 'psn_rating'] as const;
type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

function queryLibraryGames(games: LibraryGame[], req: Request): { games: LibraryGame[]; total: number } {
  const q = (req.query['q'] as string | undefined)?.toLowerCase();
  const genre = req.query['genre'] as string | undefined;
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
  if (genre) {
    filtered = filtered.filter((g) => g.genre === genre);
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

function libraryGenres(games: LibraryGame[]): string[] {
  return Array.from(new Set(games.map((g) => g.genre).filter((c): c is string => c !== null))).sort();
}

type SeededLibraryGame = Pick<LibraryGame, 'game_id' | 'title' | 'rawg_enriched' | 'opencritic_enriched'> &
  Partial<LibraryGame>;

function normalizeLibraryGames(games: SeededLibraryGame[]): LibraryGame[] {
  return games.map((g) => ({
    game_id: g.game_id,
    title: g.title,
    genre: g.genre ?? null,
    rawg_rating: g.rawg_rating ?? null,
    opencritic_rating: g.opencritic_rating ?? null,
    psn_rating: g.psn_rating ?? null,
    psn_product_id: g.psn_product_id ?? null,
    rawg_enriched: g.rawg_enriched,
    opencritic_enriched: g.opencritic_enriched,
    percent_completed: g.percent_completed ?? null,
    platforms: g.platforms ?? [],
    source: g.source ?? 'psn',
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

export type EnrichmentRunTerminalStatus = 'succeeded' | 'failed' | 'cancelled';

export interface EnrichmentRunOutcome {
  status: EnrichmentRunTerminalStatus;
  error?: string | null;
  result_summary?: Record<string, unknown> | null;
}

interface EnrichmentRun {
  run_id: string;
  status: string;
  error: string | null;
  result_summary: Record<string, unknown> | null;
}

const LIBRARIAN_ENRICHMENT_POLL_INTERVAL_MS = 2500;
const ENRICHMENT_RUN_LEAVES_THE_QUEUE_AFTER_MS = 250;
const ENRICHMENT_RUN_SETTLES_ONE_LIVE_POLL_LATER_MS = LIBRARIAN_ENRICHMENT_POLL_INTERVAL_MS + 1000;



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
const enrichmentRuns = new Map<string, EnrichmentRun>();
const actionLog = new Map<string, ActionLogEntry[]>();
const libraryGames = new Map<string, LibraryGame[]>();
const profileSettings = new Map<string, ProfileSettings>();
const profileLinkHandles = new Map<string, Map<string, string>>();
const followEdges: FollowEdge[] = [];

const PROFILE_LINK_SITES = [
  { site_key: 'psnprofiles', display_name: 'PSNProfiles', url_template: 'https://psnprofiles.com/{handle}' },
  { site_key: 'truetrophies', display_name: 'TrueTrophies', url_template: 'https://www.truetrophies.com/gamer/{handle}' },
  { site_key: 'exophase', display_name: 'Exophase', url_template: 'https://www.exophase.com/psn/user/{handle}/' },
];

const PROFILE_LINK_HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

const DEFAULT_SUB = 'e2e-user-id';
let nextShareSlug = 1;
let nextConsoleId = 1;
let nextDeviceId = 1;
let nextEnrichmentRunId = 1;
let latestEnrichmentRunId: string | null = null;
let nextEnrichmentOutcome: EnrichmentRunOutcome | null = null;

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

interface StoreSearchHit {
  id: string;
  kind: string;
  default_product_id: string | null;
  name: string;
  platforms: string[];
  cover_image_url: string | null;
  classification: string | null;
  price: string | null;
  discounted_price: string | null;
  is_free: boolean | null;
}

const STORE_ONLY_GAMES: StoreSearchHit[] = [
  {
    id: 'concept-siren-blood-curse',
    kind: 'Concept',
    default_product_id: 'UP9000-NPUA80183_00-SIRENBLOODCURSE0',
    name: 'Siren: Blood Curse',
    platforms: ['PS3'],
    cover_image_url: null,
    classification: 'Full Game',
    price: '$19.99',
    discounted_price: null,
    is_free: false,
  },
  {
    id: 'concept-siren-new-translation',
    kind: 'Concept',
    default_product_id: null,
    name: 'Siren: New Translation',
    platforms: ['PS3'],
    cover_image_url: null,
    classification: 'Full Game',
    price: null,
    discounted_price: null,
    is_free: null,
  },
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

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw new Error(`Route parameter ":${name}" was not a single string on ${req.method} ${req.url}`);
  }
  return value;
}

function subFromRequest(req: Request): string {
  const header = req.headers['x-e2e-sub'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return DEFAULT_SUB;
}

function psnAccountIdFor(sub: string): string {
  return sub === DEFAULT_SUB ? IDENTITY.account_id : `psn-account-${sub}`;
}

function onlineIdFor(sub: string): string {
  return sub === DEFAULT_SUB ? IDENTITY.online_id : `${sub}_gamer`;
}

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
      refreshSchedule: null,
      isAdmin: false,
    };
    users.set(sub, user);
  }
  return user;
}

function findUser(sub: string): UserRecord | undefined {
  return users.get(sub);
}

function refusedForLackingAdmin(req: Request, res: Response): boolean {
  if (getUser(subFromRequest(req)).isAdmin) {
    return false;
  }
  res.status(403).json({ detail: 'curator.admin claim required.' });
  return true;
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
    install_target_console_id: d.install_target_console_id,
    item_count: d.game_ids.length,
  };
}

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
    installed_on_target: null,
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

function profileLinksFor(sub: string): { site_key: string; display_name: string; handle: string; url: string }[] {
  const handles = profileLinkHandles.get(sub);
  if (!handles) {
    return [];
  }
  return PROFILE_LINK_SITES.flatMap((site) => {
    const handle = handles.get(site.site_key);
    if (handle === undefined) {
      return [];
    }
    return {
      site_key: site.site_key,
      display_name: site.display_name,
      handle,
      url: site.url_template.replace('{handle}', handle),
    };
  });
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
    size_source: game.size_source ?? UNMEASURED_SIZE_SOURCE,
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
    if (spec.genre_filter.length > 0 && (game.genre === null || !spec.genre_filter.includes(game.genre))) {
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

function pageCollectionResult(
  result: { included: CollectionGame[]; excluded: CollectionGame[]; used_gb: number | null },
  req: Request,
): {
  included: CollectionGame[];
  excluded: CollectionGame[];
  included_total: number;
  excluded_total: number;
  included_game_ids: string[];
  used_gb: number | null;
} {
  const limit = Number(req.query['limit'] ?? 50);
  const offset = Number(req.query['offset'] ?? 0);
  return {
    included: result.included.slice(offset, offset + limit),
    excluded: result.excluded.slice(offset, offset + limit),
    included_total: result.included.length,
    excluded_total: result.excluded.length,
    included_game_ids: result.included.map((game) => game.game_id),
    used_gb: result.used_gb,
  };
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
    enrichmentRuns.clear();
    latestEnrichmentRunId = null;
    nextEnrichmentOutcome = null;
    nextEnrichmentRunId = 1;
    actionLog.clear();
    libraryGames.clear();
    profileSettings.clear();
    profileLinkHandles.clear();
    followEdges.length = 0;
    nextShareSlug = 1;
    nextConsoleId = 1;
    nextDeviceId = 1;
    res.status(204).end();
  });

  app.post('/_test/catalog-games', (req: Request, res: Response) => {
    const body = req.body as { games?: GameSummary[] };
    CATALOG_GAMES = body.games ?? CATALOG_GAMES;
    res.status(204).end();
  });

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

  app.post('/_test/library-games', (req: Request, res: Response) => {
    const body = req.body as { games?: SeededLibraryGame[] };
    libraryGames.set(DEFAULT_SUB, normalizeLibraryGames(body.games ?? []));
    res.status(204).end();
  });

  app.post('/_test/library-refresh-outcome', (req: Request, res: Response) => {
    const body = req.body as LibraryRefreshOutcome;
    nextLibraryOutcome.set(DEFAULT_SUB, body);
    res.status(204).end();
  });

  app.post('/_test/enrichment-run-outcome', (req: Request, res: Response) => {
    nextEnrichmentOutcome = req.body as EnrichmentRunOutcome;
    res.status(204).end();
  });

  app.post('/_test/enrichment-run', (req: Request, res: Response) => {
    const body = req.body as Partial<EnrichmentRun>;
    const runId = body.run_id ?? `enrichment-run-${nextEnrichmentRunId++}`;
    enrichmentRuns.set(runId, {
      run_id: runId,
      status: body.status ?? 'queued',
      error: body.error ?? null,
      result_summary: body.result_summary ?? null,
    });
    latestEnrichmentRunId = runId;
    res.status(204).end();
  });

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

  app.post('/_test/psn-preferences', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences>;
    const user = getUser(DEFAULT_SUB);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

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

  app.post('/_test/seed-user', (req: Request, res: Response) => {
    const body = req.body as { sub: string };
    getUser(body.sub);
    res.status(204).end();
  });

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

  app.post('/_test/user/psn-preferences', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences> & { sub: string };
    const user = getUser(body.sub);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

  app.post('/_test/user/refresh-schedule', (req: Request, res: Response) => {
    const { sub, ...schedule } = req.body as Partial<RefreshSchedule> & { sub: string };
    getUser(sub).refreshSchedule = { ...DEFAULT_REFRESH_SCHEDULE, ...schedule };
    res.status(204).end();
  });

  app.post('/_test/user/profile-settings', (req: Request, res: Response) => {
    const body = req.body as Partial<ProfileSettings> & { sub: string };
    getUser(body.sub);
    profileSettings.set(body.sub, { ...DEFAULT_PROFILE_SETTINGS, ...settingsFor(body.sub), ...body });
    res.status(204).end();
  });

  app.post('/_test/user/library-games', (req: Request, res: Response) => {
    const body = req.body as { sub: string; games?: SeededLibraryGame[] };
    getUser(body.sub);
    libraryGames.set(body.sub, normalizeLibraryGames(body.games ?? []));
    res.status(204).end();
  });

  app.post('/_test/user/collections', (req: Request, res: Response) => {
    const body = req.body as {
      sub: string;
      definitions?: {
        definition_id: string;
        name: string;
        kind: string;
        console_id?: string | null;
        install_target_console_id?: string | null;
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
        install_target_console_id: d.install_target_console_id ?? null,
        game_ids: d.game_ids ?? [],
      })),
    );
    res.status(204).end();
  });

  app.post('/_test/follow', (req: Request, res: Response) => {
    const body = req.body as { follower_sub: string; followed_sub: string };
    getUser(body.follower_sub);
    getUser(body.followed_sub);
    if (!isFollowing(body.follower_sub, body.followed_sub)) {
      followEdges.push({ follower: body.follower_sub, followed: body.followed_sub, followedAt: new Date().toISOString() });
    }
    res.status(204).end();
  });



  app.get('/health', (_req: Request, res: Response) => {
    res.type('text/plain').send('Healthy');
  });

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

  app.get('/me/actions', (req: Request, res: Response) => {
    res.json({ actions: actionLog.get(subFromRequest(req)) ?? [] });
  });

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

  app.delete('/psn/link', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const user = getUser(sub);
    user.psn = null;
    logAction(sub, 'unlinked');
    res.status(204).end();
  });

  app.get('/me/psn-preferences', (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    res.json(user.psnPreferences);
  });

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

  app.get('/me/refresh-schedule', (req: Request, res: Response) => {
    const schedule = getUser(subFromRequest(req)).refreshSchedule;
    if (!schedule) {
      res.status(404).json({ detail: 'No refresh schedule is configured.' });
      return;
    }
    res.json(schedule);
  });

  app.put('/me/refresh-schedule', (req: Request, res: Response) => {
    const body = req.body as Partial<RefreshSchedule>;
    const user = getUser(subFromRequest(req));
    if (body.cadence !== 'daily' && body.cadence !== 'weekly' && body.cadence !== 'monthly') {
      res.status(422).json({ detail: 'Unknown cadence.' });
      return;
    }
    user.refreshSchedule = {
      ...DEFAULT_REFRESH_SCHEDULE,
      ...user.refreshSchedule,
      cadence: body.cadence,
      ps_plus_watch: body.ps_plus_watch ?? false,
    };
    res.json(user.refreshSchedule);
  });

  app.delete('/me/refresh-schedule', (req: Request, res: Response) => {
    getUser(subFromRequest(req)).refreshSchedule = null;
    res.status(204).end();
  });

  app.get('/me/enrichment-keys', (req: Request, res: Response) => {
    res.json(getUser(subFromRequest(req)).enrichmentKeys);
  });

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
    const clearedBySuccessfulSave = null;
    if (provider === 'rawg') {
      user.enrichmentKeys.rawg_configured = true;
      user.enrichmentKeys.rawg_added_at = now;
      user.enrichmentKeys.rawg_key_rejected_at = clearedBySuccessfulSave;
    } else {
      user.enrichmentKeys.opencritic_configured = true;
      user.enrichmentKeys.opencritic_added_at = now;
      user.enrichmentKeys.opencritic_key_rejected_at = clearedBySuccessfulSave;
    }
    logAction(sub, 'enrichment_key_added', provider);
    res.status(204).end();
  });

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

  app.get('/catalog/genres', (_req: Request, res: Response) => {
    const genres = [...new Set(CATALOG_GAMES.map((game) => game.genre).filter((genre): genre is string => !!genre))];
    res.json({ genres });
  });

  app.get('/catalog/games/:gameId', (req: Request, res: Response) => {
    const game = CATALOG_GAMES.find((candidate) => candidate.game_id === pathParam(req, 'gameId'));
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

    const generated = generateCollection(sub, {
      kind: spec.kind,
      genre_filter: spec.genre_filter ?? [],
      min_score: spec.min_score ?? null,
      aaa_tier_filter: spec.aaa_tier_filter ?? null,
    });
    res.json(pageCollectionResult(generated, req));
  });

  app.post('/collections', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as {
      name: string;
      description?: string | null;
      kind: string;
      console_id?: string | null;
      install_target_console_id?: string | null;
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
      install_target_console_id: body.install_target_console_id ?? null,
      game_ids: body.game_ids ?? [],
    };
    userDefinitions(sub).push(definition);
    res.status(201).json(toDefinitionResponse(definition));
  });

  app.get('/collections', (req: Request, res: Response) => {
    res.json(userDefinitions(subFromRequest(req)).map(toDefinitionResponse));
  });

  app.get('/collections/followed', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const followed = collectionFollows
      .filter((f) => f.follower === sub)
      .sort((a, b) => b.followedAt.localeCompare(a.followedAt))
      .map((f) => findDefinitionAnyOwner(f.definitionId))
      .filter((d): d is DefinitionRecord => d !== undefined);
    res.json(followed.map(toDefinitionResponse));
  });

  app.get('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, 'id'));
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    res.json({ ...toDefinitionResponse(definition), items: toDefinitionItems(definition) });
  });

  app.patch('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, 'id'));
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

  app.put('/collections/:id/visibility', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, 'id'));
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

  app.delete('/collections/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDefinitions(sub);
    const idx = list.findIndex((d) => d.definition_id === pathParam(req, 'id'));
    if (idx < 0) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }
    list.splice(idx, 1);
    res.status(204).end();
  });

  app.post('/collections/:id/follow', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = findDefinitionAnyOwner(pathParam(req, 'id'));
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

  app.delete('/collections/:id/follow', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const idx = collectionFollows.findIndex((f) => f.follower === sub && f.definitionId === pathParam(req, 'id'));
    if (idx >= 0) {
      collectionFollows.splice(idx, 1);
    }
    res.status(204).end();
  });

  app.post('/collections/:id/runs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, 'id'));
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }

    const result = generateCollection(sub, definition);
    res.status(201).json({ run_id: `run-${String(Date.now())}`, ...pageCollectionResult(result, req) });
  });



  app.get('/public/collections/:shareSlug', (req: Request, res: Response) => {
    const shareSlug = pathParam(req, 'shareSlug');
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

  app.get('/consoles', (req: Request, res: Response) => {
    res.json(userConsoles(subFromRequest(req)).map(toConsoleResponse));
  });

  app.patch('/consoles/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedConsole(sub, pathParam(req, 'id'));
    if (!record) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }
    const body = req.body as Partial<Pick<ConsoleRecord, 'name' | 'raw_capacity_gb' | 'update_buffer_gb' | 'routing_genres' | 'fill_order'>>;
    Object.assign(record, body);
    res.json(toConsoleResponse(record));
  });

  app.delete('/consoles/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userConsoles(sub);
    const idx = list.findIndex((c) => c.console_id === pathParam(req, 'id'));
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

  app.get('/consoles/:id/installs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedConsole(sub, pathParam(req, 'id'))) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }
    res.json({ game_ids: Array.from(consoleInstalls.get(pathParam(req, 'id')) ?? []).sort() });
  });

  app.put('/consoles/:consoleId/installs/:gameId', (req: Request, res: Response) => {
    const consoleId = pathParam(req, 'consoleId');
    const gameId = pathParam(req, 'gameId');
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

  app.get('/storage-devices', (req: Request, res: Response) => {
    res.json(userDevices(subFromRequest(req)).map(toDeviceResponse));
  });

  app.patch('/storage-devices/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, 'id'));
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    const body = req.body as Partial<Pick<StorageDeviceRecord, 'name' | 'capacity_gb' | 'buffer_gb'>>;
    Object.assign(record, body);
    res.json(toDeviceResponse(record));
  });

  app.delete('/storage-devices/:id', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDevices(sub);
    const idx = list.findIndex((d) => d.device_id === pathParam(req, 'id'));
    if (idx < 0) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    const [removed] = list.splice(idx, 1);
    deviceInstalls.delete(removed.device_id);
    res.status(204).end();
  });

  app.put('/storage-devices/:id/attach/:consoleId', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, 'id'));
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    if (!findOwnedConsole(sub, pathParam(req, 'consoleId'))) {
      res.status(400).json({ detail: `Unknown console_id '${pathParam(req, 'consoleId')}' for this user.` });
      return;
    }
    record.console_id = pathParam(req, 'consoleId');
    res.json(toDeviceResponse(record));
  });

  app.delete('/storage-devices/:id/attach', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, 'id'));
    if (!record) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    record.console_id = null;
    res.json(toDeviceResponse(record));
  });

  app.get('/storage-devices/:id/installs', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedDevice(sub, pathParam(req, 'id'))) {
      res.status(404).json({ detail: 'Storage device not found.' });
      return;
    }
    res.json({ game_ids: Array.from(deviceInstalls.get(pathParam(req, 'id')) ?? []).sort() });
  });

  app.put('/storage-devices/:deviceId/installs/:gameId', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const deviceId = pathParam(req, 'deviceId');
    const gameId = pathParam(req, 'gameId');
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

  app.get('/library', (req: Request, res: Response) => {
    res.json(queryLibraryGames(libraryGames.get(subFromRequest(req)) ?? [], req));
  });

  app.get('/library/genres', (req: Request, res: Response) => {
    res.json({ genres: libraryGenres(libraryGames.get(subFromRequest(req)) ?? []) });
  });

  app.get('/library/manual/search', (req: Request, res: Response) => {
    if (!getUser(subFromRequest(req)).psn) {
      res.status(404).json({ detail: 'PSN account not linked.' });
      return;
    }
    const q = req.query['q'];
    if (typeof q !== 'string' || q.trim().length === 0) {
      res.status(422).json({ detail: 'q is required.' });
      return;
    }
    const term = q.toLowerCase();
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;
    const results = STORE_ONLY_GAMES.filter((hit) => hit.name.toLowerCase().includes(term)).slice(0, limit);
    res.json({ domain: 'MobileGames', results: results.map((hit) => ({ ...hit, game_id: null })) });
  });

  app.post('/library/manual', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as { game_id?: string; store_hit?: { query: string; id: string } };
    const storeHit = body.store_hit;
    if ((body.game_id === undefined) === (storeHit === undefined)) {
      res.status(422).json({ detail: "Name the game with exactly one of 'game_id' or 'store_hit'." });
      return;
    }

    let gameId: string;
    let title: string;
    let platforms: string[] = [];

    if (storeHit) {
      if (!getUser(sub).psn) {
        res.status(404).json({ detail: 'PSN account not linked.' });
        return;
      }
      const query = storeHit.query.toLowerCase();
      const hit = STORE_ONLY_GAMES.filter((candidate) => candidate.name.toLowerCase().includes(query)).find(
        (candidate) => candidate.id === storeHit.id,
      );
      if (!hit) {
        res.status(404).json({ detail: 'That title is not in the PlayStation Store results for this search.' });
        return;
      }
      gameId = `g-admitted-${hit.id}`;
      title = hit.name;
      platforms = hit.platforms;
    } else {
      const game = CATALOG_GAMES.find((candidate) => candidate.game_id === body.game_id);
      if (!game) {
        res.status(404).json({ detail: 'Unknown game.' });
        return;
      }
      gameId = game.game_id;
      title = game.canonical_title;
    }

    const owned = libraryGames.get(sub) ?? [];
    if (!owned.some((game) => game.game_id === gameId)) {
      owned.push(
        normalizeLibraryGames([
          { game_id: gameId, title, rawg_enriched: false, opencritic_enriched: false, source: 'manual', platforms },
        ])[0],
      );
      libraryGames.set(sub, owned);
    }
    res.status(204).end();
  });

  app.delete('/library/manual/:gameId', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const gameId = pathParam(req, 'gameId');
    const owned = libraryGames.get(sub) ?? [];
    const index = owned.findIndex((game) => game.game_id === gameId && game.source === 'manual');
    if (index < 0) {
      res.status(404).json({ detail: 'No manually-added entry for that game.' });
      return;
    }
    owned.splice(index, 1);
    libraryGames.set(sub, owned);
    res.status(204).end();
  });

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

  app.get('/library/refresh/:runId', (req: Request, res: Response) => {
    const run = libraryRuns.get(pathParam(req, 'runId'));
    if (!run || run.sub !== subFromRequest(req)) {
      res.status(404).json({ detail: 'Library refresh run not found.' });
      return;
    }
    res.json({ run_id: pathParam(req, 'runId'), status: run.status, error: run.error, result_summary: run.result_summary });
  });

  app.post('/enrichment/runs', (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const runId = `enrichment-run-${nextEnrichmentRunId++}`;
    enrichmentRuns.set(runId, { run_id: runId, status: 'queued', error: null, result_summary: null });
    latestEnrichmentRunId = runId;

    setTimeout(() => {
      const run = enrichmentRuns.get(runId);
      if (run) {
        run.status = 'running';
      }
    }, ENRICHMENT_RUN_LEAVES_THE_QUEUE_AFTER_MS);

    setTimeout(() => {
      const run = enrichmentRuns.get(runId);
      if (run) {
        const outcome = nextEnrichmentOutcome ?? { status: 'succeeded' as EnrichmentRunTerminalStatus };
        run.status = outcome.status;
        run.error = outcome.error ?? null;
        run.result_summary = outcome.result_summary ?? null;
      }
    }, ENRICHMENT_RUN_SETTLES_ONE_LIVE_POLL_LATER_MS);

    res.status(202).json({ run_id: runId });
  });

  app.get('/enrichment/runs/latest', (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const run = latestEnrichmentRunId === null ? undefined : enrichmentRuns.get(latestEnrichmentRunId);
    if (!run) {
      res.status(404).json({ detail: 'No enrichment run has been queued yet.' });
      return;
    }
    res.json(run);
  });

  app.get('/enrichment/runs/:runId', (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const run = enrichmentRuns.get(pathParam(req, 'runId'));
    if (!run) {
      res.status(404).json({ detail: 'Enrichment run not found.' });
      return;
    }
    res.json(run);
  });

  app.get('/me/profile-settings', (req: Request, res: Response) => {
    res.json(settingsFor(subFromRequest(req)));
  });

  app.get('/me/profile-link-sites', (_req: Request, res: Response) => {
    res.json(PROFILE_LINK_SITES.map((site) => ({ site_key: site.site_key, display_name: site.display_name })));
  });

  app.get('/me/profile-links', (req: Request, res: Response) => {
    res.json(profileLinksFor(subFromRequest(req)));
  });

  app.put('/me/profile-links/:site_key', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const siteKey = pathParam(req, 'site_key');
    const site = PROFILE_LINK_SITES.find((s) => s.site_key === siteKey);
    if (!site) {
      res.status(400).json({ detail: 'Unknown site.' });
      return;
    }
    const handle = (req.body as { handle?: string }).handle?.trim() ?? null;
    if (handle === null || !PROFILE_LINK_HANDLE_PATTERN.test(handle)) {
      res.status(400).json({ detail: 'Handle must be 3-16 characters: letters, digits, - or _.' });
      return;
    }
    const handles = profileLinkHandles.get(sub) ?? new Map<string, string>();
    handles.set(site.site_key, handle);
    profileLinkHandles.set(sub, handles);
    res.json({
      site_key: site.site_key,
      display_name: site.display_name,
      handle,
      url: site.url_template.replace('{handle}', handle),
    });
  });

  app.delete('/me/profile-links/:site_key', (req: Request, res: Response) => {
    profileLinkHandles.get(subFromRequest(req))?.delete(pathParam(req, 'site_key'));
    res.status(204).end();
  });

  app.put('/me/profile-settings', (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as Partial<ProfileSettings>;
    const next: ProfileSettings = { ...DEFAULT_PROFILE_SETTINGS, ...body };
    profileSettings.set(sub, next);
    res.json(next);
  });

  app.get('/users/:sub/profile', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
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

    const libraryCount = libraryVisible ? (libraryGames.get(target) ?? []).length : null;
    const collectionsCount = collectionsVisible
      ? userDefinitions(target).filter((d) => viewerIsOwner || d.visibility === 'public').length
      : null;

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
      created_at: ACCOUNT_CREATED_AT,
      library_count: libraryCount,
      collections_count: collectionsCount,
      trophies_hidden_by_owner_setting:
        viewerIsOwner &&
        trophies === null &&
        targetUser.psn !== null &&
        !(settings.show_trophies && targetUser.psnPreferences.harvest_trophies),
      profile_links: viewerCanSeePublicSections ? profileLinksFor(target) : [],
    });
  });

  app.post('/users/:sub/follow', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
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

  app.delete('/users/:sub/follow', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
    const viewer = subFromRequest(req);
    const idx = followEdges.findIndex((e) => e.follower === viewer && e.followed === target);
    if (idx >= 0) {
      followEdges.splice(idx, 1);
      logAction(viewer, 'unfollowed', target);
    }
    res.status(204).end();
  });

  app.get('/users/:sub/followers', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
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

  app.get('/users/:sub/following', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
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

  function libraryVisibilityGate(req: Request, res: Response): boolean {
    const target = pathParam(req, 'sub');
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

  app.get('/users/:sub/library', (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json(queryLibraryGames(libraryGames.get(pathParam(req, 'sub')) ?? [], req));
  });

  app.get('/users/:sub/library/genres', (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json({ genres: libraryGenres(libraryGames.get(pathParam(req, 'sub')) ?? []) });
  });

  app.get('/users/:sub/collections', (req: Request, res: Response) => {
    const target = pathParam(req, 'sub');
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
