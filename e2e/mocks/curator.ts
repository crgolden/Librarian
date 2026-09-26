
import { randomUUID } from 'node:crypto';
import { constants } from 'node:http2';
import express, { type Express, type Request, type Response } from 'express';
import { newDisplayName, newId, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';
import { CuratorQueryParams, CuratorRoutes } from '../../src/curator/curator-api';
import {
  AaaTiers,
  ALL_CATALOG_KINDS,
  type AccountActionOutcome,
  AccountActionOutcomes,
  type CatalogSortField,
  CatalogSortFields,
  CollectionKinds,
  CollectionVisibilities,
  type CollectionVisibility,
  type ConsoleDeviceLinkState,
  ConsoleDeviceLinkStates,
  CONSOLE_PLATFORM_OPTIONS,
  ConsolePlatforms,
  type ContentKind,
  ContentKinds,
  type JobStatus,
  JobStatuses,
  LibraryEntrySources,
  LibraryHiddenFilters,
  LibrarySortFields,
  type PsPlusTier,
  type RefreshCadence,
  RefreshCadences,
  type SizeSource,
  SortDirections,
  StorageKinds,
  StoreUnavailableReasons,
  type TrophyMatch,
  TrophyMatches,
  type TrophyProgressReason,
  TrophyProgressReasons,
  type TrophyProgressState,
  TrophyProgressStates,
  UNMEASURED_SIZE_SOURCE,
} from '../../src/curator/curator.models';
import { ControlRoutes } from './control-routes';
import { CONSOLE_PLATFORM_ERROR, DEVICE_KIND_ERROR } from '../../src/consoles/consoles.messages';
import { HEALTHY_BODY, HEALTH_PATH } from '../../src/shared/health';
import { ContentTypes } from '../../src/shared/content-types';
import { environment } from '../../src/environments/environment.ci';
import {
  AccountActions,
  CuratorConsoleCapacityDefaultsGb,
  CuratorDetails,
  CuratorFallbacks,
  CuratorPageLimits,
  EnrichmentProviders,
  PROFILE_LINK_HANDLE_PLACEHOLDER,
  ProfileLinkSites,
} from './curator-constants';
import {
  newCatalogGame,
  newFutureInstant,
  newPsnRating,
  newScore,
  newTrophySummary,
  type SeededLibraryGame,
} from './curator-records';
import { e2eContract } from './e2e-identity-contract';
import { PsnDeviceActivationTypes, PsnOnlineStatuses } from '../psn-constants';
import e2eSettings from '../e2e-settings.json';

export type {
  ConsoleDeviceLinkState,
  ContentKind,
  PsPlusTier,
  SizeSource,
  TrophyMatch,
  TrophyProgressReason,
  TrophyProgressState,
};


function newRouteParamName(): string {
  return `p${randomUUID().replaceAll('-', '')}`;
}

const RouteParam = {
  consoleId: newRouteParamName(),
  deviceId: newRouteParamName(),
  gameId: newRouteParamName(),
  id: newRouteParamName(),
  onlineId: newRouteParamName(),
  provider: newRouteParamName(),
  runId: newRouteParamName(),
  shareSlug: newRouteParamName(),
  site_key: newRouteParamName(),
  sub: newRouteParamName(),
} as const;

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
  cadence: RefreshCadence;
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
  onlineId: string;
  trophySummary: TrophySummary;
}

export interface TrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface TrophySummary {
  level: number;
  progress: number;
  tier: number;
  earned: TrophyCounts;
  account_id: string;
}

const DEFAULT_REFRESH_SCHEDULE: RefreshSchedule = {
  cadence: RefreshCadences.weekly,
  ps_plus_watch: false,
  next_run_at: newFutureInstant(),
  last_run_at: newUtcInstant(),
  consecutive_failures: 0,
  paused_reason: null,
};

const ACCOUNT_CREATED_AT = newUtcInstant();

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

export interface CatalogPrice {
  is_free: boolean | null;
  tied_to_subscription: boolean | null;
  base_cents: number | null;
  discounted_cents: number | null;
  discount_text: string | null;
  fetched_at: string;
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
  cover_image_url?: string | null;
  size_source?: SizeSource;
  content_kind?: ContentKind | null;
  price?: CatalogPrice | null;
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
  visibility: CollectionVisibility;
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
  trophy_match: TrophyMatch;
}

export interface TrophyProgress {
  state: TrophyProgressState;
  reason: TrophyProgressReason | null;
}

export interface PsPlusTitle {
  title_id: string;
  game_id: string | null;
  title: string | null;
  tier: PsPlusTier | null;
  platforms: string[];
  cover_image_url: string | null;
  store_product_id: string | null;
  since_at: string | null;
}

export interface PsPlusRotation {
  catalog_walked_at: string | null;
  since: string | null;
  added: PsPlusTitle[];
  leaving: PsPlusTitle[];
  unclaimed: PsPlusTitle[];
  lapsed: PsPlusTitle[];
  categories: { tier: PsPlusTier; walked_at: string | null; total: number }[];
}

export interface FriendRequest {
  online_id: string | null;
  account_id: string;
}

export interface ConsoleDeviceLink {
  device_id: string;
  state: ConsoleDeviceLinkState;
}

const LIBRARY_SORT_FIELDS = Object.values(LibrarySortFields);
type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

function queryLibraryGames(games: LibraryGame[], req: Request): { games: LibraryGame[]; total: number } {
  const q = (req.query[CuratorQueryParams.q] as string | undefined)?.toLowerCase();
  const genre = req.query[CuratorQueryParams.genre] as string | undefined;
  const sortParam = req.query[CuratorQueryParams.sort] as string | undefined;
  const sort: LibrarySortField = LIBRARY_SORT_FIELDS.includes(sortParam as LibrarySortField)
    ? (sortParam as LibrarySortField)
    : LibrarySortFields.title;
  const desc = req.query[CuratorQueryParams.sortDir] === SortDirections.desc;
  const limit = req.query[CuratorQueryParams.limit] ? parseInt(req.query[CuratorQueryParams.limit] as string, 10) : CuratorPageLimits.library;
  const offset = req.query[CuratorQueryParams.offset] ? parseInt(req.query[CuratorQueryParams.offset] as string, 10) : 0;

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
    source: g.source ?? LibraryEntrySources.psn,
    trophy_match: g.trophy_match ?? TrophyMatches.notAttempted,
  }));
}

function hiddenFor(sub: string): Set<string> {
  let hidden = hiddenLibraryGames.get(sub);
  if (!hidden) {
    hidden = new Set();
    hiddenLibraryGames.set(sub, hidden);
  }
  return hidden;
}

function trophyProgressFor(user: UserRecord): TrophyProgress {
  if (user.psn === null) {
    return { state: TrophyProgressStates.off, reason: TrophyProgressReasons.noLink };
  }
  if (!user.psnPreferences.harvest_trophies) {
    return { state: TrophyProgressStates.off, reason: TrophyProgressReasons.harvestOff };
  }
  const games = libraryGames.get(user.sub) ?? [];
  if (games.every((game) => game.percent_completed === null)) {
    return { state: TrophyProgressStates.pending, reason: TrophyProgressReasons.neverRefreshed };
  }
  return { state: TrophyProgressStates.on, reason: null };
}

export interface LibraryRefreshResultSummary {
  rawg_enriched_titles: string[];
  opencritic_enriched_titles: string[];
  opencritic_topup_incomplete: boolean;
}

interface LibraryRun {
  sub: string;
  status: JobStatus;
  error: string | null;
  result_summary: LibraryRefreshResultSummary | null;
}

interface LibraryRefreshOutcome {
  status: typeof JobStatuses.succeeded | typeof JobStatuses.failed;
  error?: string;
  result_summary?: LibraryRefreshResultSummary;
}

export type EnrichmentRunTerminalStatus = typeof JobStatuses.succeeded | typeof JobStatuses.failed | typeof JobStatuses.cancelled;

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

const ENRICHMENT_RUN_LEAVES_THE_QUEUE_AFTER_MS = e2eSettings.mockTimings.enrichmentRunLeavesQueueAfterMs;
const ENRICHMENT_RUN_SETTLES_ONE_LIVE_POLL_LATER_MS =
  environment.adminEnrichmentPollIntervalMs + e2eSettings.mockTimings.enrichmentRunSettlesAfterPollMs;



interface ActionLogEntry {
  action: string;
  detail: string | null;
  occurred_at: string;
  outcome: AccountActionOutcome;
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
const hiddenLibraryGames = new Map<string, Set<string>>();
const psPlusRotations = new Map<string, PsPlusRotation>();
const receivedFriendRequests = new Map<string, FriendRequest[]>();
const acceptedFriendRequests = new Map<string, string[]>();
const sentFriendRequests = new Map<string, string[]>();
const consoleDeviceLinks = new Map<string, ConsoleDeviceLink>();
const profileSettings = new Map<string, ProfileSettings>();
const profileLinkHandles = new Map<string, Map<string, string>>();
const followEdges: FollowEdge[] = [];

const PROFILE_LINK_SITES = Object.values(ProfileLinkSites);

const PROFILE_LINK_HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

const EMPTY_PS_PLUS_ROTATION: PsPlusRotation = {
  catalog_walked_at: null,
  since: null,
  added: [],
  leaving: [],
  unclaimed: [],
  lapsed: [],
  categories: [],
};

const E2E_CONTRACT = e2eContract();
const DEFAULT_SUB = E2E_CONTRACT.defaultSub;
let nextShareSlug = 1;
let nextConsoleId = 1;
let nextDeviceId = 1;
let nextEnrichmentRunId = 1;
let latestEnrichmentRunId: string | null = null;
let nextEnrichmentOutcome: EnrichmentRunOutcome | null = null;

function logAction(sub: string, action: string, detail: string | null = null): void {
  const entries = actionLog.get(sub) ?? [];
  entries.push({ action, detail, occurred_at: new Date().toISOString(), outcome: AccountActionOutcomes.completed });
  actionLog.set(sub, entries);
}

let CATALOG_GAMES: GameSummary[] = Array.from({ length: randomIntBetween(1, CuratorPageLimits.catalog) }, newCatalogGame);

export interface StoreSearchHit {
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

export function admittedGameId(storeId: string): string {
  return `g-admitted-${storeId}`;
}

let storeSearchHits: StoreSearchHit[] = [];

function toCatalogSummary(game: GameSummary) {
  return {
    ...game,
    cover_image_url: game.cover_image_url ?? null,
    store_product_id: null,
    critical_score: game.critical_score ?? null,
    oc_score: game.oc_score ?? null,
    psn_rating: game.psn_rating ?? null,
    percent_completed: null,
    content_kind: game.content_kind ?? null,
    price: game.price ?? null,
  };
}

const CATALOG_SORT_FIELDS = Object.values(CatalogSortFields);

function priceRank(game: GameSummary): number | null {
  const price = game.price;
  if (!price) {
    return null;
  }
  if (price.is_free === true) {
    return 0;
  }
  return price.discounted_cents ?? price.base_cents;
}

function sortCatalog(games: GameSummary[], req: Request): GameSummary[] {
  const asked = req.query[CuratorQueryParams.sort] as string | undefined;
  const field: CatalogSortField = CATALOG_SORT_FIELDS.includes(asked as CatalogSortField)
    ? (asked as CatalogSortField)
    : CatalogSortFields.title;
  const desc = req.query[CuratorQueryParams.sortDir] === SortDirections.desc;
  return [...games].sort((a, b) => {
    if (field === CatalogSortFields.title) {
      const byTitle = a.canonical_title.localeCompare(b.canonical_title);
      return desc ? -byTitle : byTitle;
    }
    const left = priceRank(a);
    const right = priceRank(b);
    if (left === null && right === null) return a.canonical_title.localeCompare(b.canonical_title);
    if (left === null) return 1;
    if (right === null) return -1;
    return desc ? right - left : left - right;
  });
}

function matchesKind(game: GameSummary, req: Request): boolean {
  const kind = (req.query[CuratorQueryParams.kind] as string | undefined) ?? ContentKinds.game;
  if (kind === ALL_CATALOG_KINDS) {
    return true;
  }
  if (kind === ContentKinds.game) {
    return game.content_kind === undefined || game.content_kind === null || game.content_kind === ContentKinds.game;
  }
  return game.content_kind === kind;
}

const PRESENCE = {
  online_status: PsnOnlineStatuses.online,
  platform: ConsolePlatforms.ps5,
  last_online_date: newUtcInstant(),
  game_title: newText(),
};

const HARVESTED_DEVICE_ID = newId();

const DEVICES = {
  devices: [
    {
      device_id: HARVESTED_DEVICE_ID,
      device_type: ConsolePlatforms.ps5,
      device_name: newDisplayName(),
      activation_type: PsnDeviceActivationTypes.primary,
      activation_date: newUtcInstant(),
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
  const header = req.headers[E2E_CONTRACT.subHeader];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return DEFAULT_SUB;
}

function psnAccountIdFor(sub: string): string {
  return `psn-account-${sub}`;
}

function psnLinkFrom(seeded: Partial<PsnLink>): PsnLink {
  return {
    access_token_expires_at:
      seeded.access_token_expires_at === undefined ? newFutureInstant() : seeded.access_token_expires_at,
    refresh_token_expires_at:
      seeded.refresh_token_expires_at === undefined ? newFutureInstant() : seeded.refresh_token_expires_at,
  };
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
      onlineId: newText(),
      trophySummary: newTrophySummary(),
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
  res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.adminClaimRequired });
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
    critical_score: newScore(),
    oc_score: newScore(),
    psn_rating: newPsnRating(),
    cover_image_url: null,
    owner_has_access: game !== undefined,
    installed_on_target: null,
  };
}

function toDefinitionItems(d: DefinitionRecord): CollectionItem[] {
  return d.game_ids.map((gameId, index) => toCollectionItem(gameId, index + 1));
}

function toConsoleResponse(
  c: ConsoleRecord,
): Omit<ConsoleRecord, 'identity_sub'> & {
  effective_capacity_gb: number;
  capacity_is_default: boolean;
  device_link: ConsoleDeviceLink | null;
} {
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
    device_link: consoleDeviceLinks.get(c.console_id) ?? null,
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
      url: site.url_template.replace(PROFILE_LINK_HANDLE_PLACEHOLDER, handle),
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
    genre: game.genre ?? CuratorFallbacks.genre,
    aaa_tier: game.aaa_tier ?? AaaTiers.indie,
    franchise: game.franchise ?? game.canonical_title,
    composite_score: newScore(),
    rank_score: 1,
    size_gb: newScore(),
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
  ignored_filters: { filter: string; reason: string }[];
  excluded_for_missing_trophy_data: number;
} {
  const limit = Number(req.query[CuratorQueryParams.limit] ?? CuratorPageLimits.collectionPreview);
  const offset = Number(req.query[CuratorQueryParams.offset] ?? 0);
  return {
    included: result.included.slice(offset, offset + limit),
    excluded: result.excluded.slice(offset, offset + limit),
    included_total: result.included.length,
    excluded_total: result.excluded.length,
    included_game_ids: result.included.map((game) => game.game_id),
    used_gb: result.used_gb,
    ignored_filters: [],
    excluded_for_missing_trophy_data: 0,
  };
}

function toProfileDefinition(
  d: DefinitionRecord,
): { definition_id: string; name: string; kind: string; console_id: string | null; item_count: number } {
  return { definition_id: d.definition_id, name: d.name, kind: d.kind, console_id: d.console_id, item_count: d.game_ids.length };
}



const CONTROL_PATHS = new Set<string>(Object.values(ControlRoutes));

export function createCuratorApp(): Express {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: () => void) => {
    if (!CONTROL_PATHS.has(req.path) && req.path !== HEALTH_PATH) {
      getUser(subFromRequest(req));
    }
    next();
  });

  app.post(ControlRoutes.reset, (_req: Request, res: Response) => {
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
    hiddenLibraryGames.clear();
    psPlusRotations.clear();
    receivedFriendRequests.clear();
    acceptedFriendRequests.clear();
    sentFriendRequests.clear();
    consoleDeviceLinks.clear();
    profileSettings.clear();
    profileLinkHandles.clear();
    followEdges.length = 0;
    storeSearchHits = [];
    nextShareSlug = 1;
    nextConsoleId = 1;
    nextDeviceId = 1;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.catalogGames, (req: Request, res: Response) => {
    const body = req.body as { games?: GameSummary[] };
    CATALOG_GAMES = body.games ?? CATALOG_GAMES;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.storeSearchHits, (req: Request, res: Response) => {
    const body = req.body as { hits?: StoreSearchHit[] };
    storeSearchHits = body.hits ?? [];
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.consoles, (req: Request, res: Response) => {
    const body = req.body as { consoleIds?: string[] };
    consoleRecords.set(
      DEFAULT_SUB,
      (body.consoleIds ?? []).map((consoleId) => ({
        console_id: consoleId,
        identity_sub: DEFAULT_SUB,
        name: consoleId,
        platform: ConsolePlatforms.ps5,
        raw_capacity_gb: CuratorConsoleCapacityDefaultsGb.ps5,
        model: null,
        update_buffer_gb: 0,
        routing_genres: [],
        fill_order: 0,
      })),
    );
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.libraryGames, (req: Request, res: Response) => {
    const body = req.body as { games?: SeededLibraryGame[] };
    libraryGames.set(DEFAULT_SUB, normalizeLibraryGames(body.games ?? []));
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.libraryRefreshOutcome, (req: Request, res: Response) => {
    const body = req.body as LibraryRefreshOutcome;
    nextLibraryOutcome.set(DEFAULT_SUB, body);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.enrichmentRunOutcome, (req: Request, res: Response) => {
    nextEnrichmentOutcome = req.body as EnrichmentRunOutcome;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.enrichmentRun, (req: Request, res: Response) => {
    const body = req.body as Partial<EnrichmentRun>;
    const runId = body.run_id ?? `enrichment-run-${nextEnrichmentRunId++}`;
    enrichmentRuns.set(runId, {
      run_id: runId,
      status: body.status ?? JobStatuses.queued,
      error: body.error ?? null,
      result_summary: body.result_summary ?? null,
    });
    latestEnrichmentRunId = runId;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.psnLink, (req: Request, res: Response) => {
    const user = getUser(DEFAULT_SUB);
    user.psn = psnLinkFrom(req.body as Partial<PsnLink>);
    user.psnAccountId ??= psnAccountIdFor(DEFAULT_SUB);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.psnPreferences, (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences>;
    const user = getUser(DEFAULT_SUB);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.enrichmentKeys, (req: Request, res: Response) => {
    const body = req.body as Partial<EnrichmentKeyStatus>;
    const user = getUser(DEFAULT_SUB);
    user.enrichmentKeys = { ...DEFAULT_ENRICHMENT_KEY_STATUS, ...body };
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.admin, (req: Request, res: Response) => {
    const body = req.body as { isAdmin?: boolean };
    getUser(DEFAULT_SUB).isAdmin = body.isAdmin ?? true;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.seedUser, (req: Request, res: Response) => {
    const body = req.body as { sub: string };
    getUser(body.sub);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userPsnLink, (req: Request, res: Response) => {
    const body = req.body as Partial<PsnLink> & { sub: string; psn_account_id?: string };
    const user = getUser(body.sub);
    user.psn = psnLinkFrom(body);
    user.psnAccountId = body.psn_account_id ?? user.psnAccountId ?? psnAccountIdFor(body.sub);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userPsnProfile, (req: Request, res: Response) => {
    const body = req.body as { sub: string; online_id?: string; trophy_summary?: TrophySummary };
    const user = getUser(body.sub);
    user.onlineId = body.online_id ?? user.onlineId;
    user.trophySummary = body.trophy_summary ?? user.trophySummary;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userPsnPreferences, (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences> & { sub: string };
    const user = getUser(body.sub);
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userRefreshSchedule, (req: Request, res: Response) => {
    const { sub, ...schedule } = req.body as Partial<RefreshSchedule> & { sub: string };
    getUser(sub).refreshSchedule = { ...DEFAULT_REFRESH_SCHEDULE, ...schedule };
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userProfileSettings, (req: Request, res: Response) => {
    const body = req.body as Partial<ProfileSettings> & { sub: string };
    getUser(body.sub);
    profileSettings.set(body.sub, { ...DEFAULT_PROFILE_SETTINGS, ...settingsFor(body.sub), ...body });
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userLibraryGames, (req: Request, res: Response) => {
    const body = req.body as { sub: string; games?: SeededLibraryGame[] };
    getUser(body.sub);
    libraryGames.set(body.sub, normalizeLibraryGames(body.games ?? []));
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userCollections, (req: Request, res: Response) => {
    const body = req.body as {
      sub: string;
      definitions?: {
        definition_id: string;
        name: string;
        kind: string;
        console_id?: string | null;
        install_target_console_id?: string | null;
        visibility?: CollectionVisibility;
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
        visibility: d.visibility ?? CollectionVisibilities.private,
        share_slug: `slug-${nextShareSlug++}`,
        install_target_console_id: d.install_target_console_id ?? null,
        game_ids: d.game_ids ?? [],
      })),
    );
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userPsPlusRotation, (req: Request, res: Response) => {
    const { sub, ...rotation } = req.body as Partial<PsPlusRotation> & { sub: string };
    getUser(sub);
    psPlusRotations.set(sub, { ...EMPTY_PS_PLUS_ROTATION, ...rotation });
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.userFriendRequests, (req: Request, res: Response) => {
    const body = req.body as { sub: string; requests?: FriendRequest[] };
    getUser(body.sub);
    receivedFriendRequests.set(body.sub, body.requests ?? []);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.consoleDeviceLink, (req: Request, res: Response) => {
    const body = req.body as { console_id: string; device_id?: string; state?: ConsoleDeviceLinkState };
    consoleDeviceLinks.set(body.console_id, {
      device_id: body.device_id ?? HARVESTED_DEVICE_ID,
      state: body.state ?? ConsoleDeviceLinkStates.linked,
    });
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.hiddenLibraryGames, (req: Request, res: Response) => {
    const body = req.body as { game_ids?: string[] };
    hiddenLibraryGames.set(DEFAULT_SUB, new Set(body.game_ids ?? []));
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(ControlRoutes.follow, (req: Request, res: Response) => {
    const body = req.body as { follower_sub: string; followed_sub: string };
    getUser(body.follower_sub);
    getUser(body.followed_sub);
    if (!isFollowing(body.follower_sub, body.followed_sub)) {
      followEdges.push({ follower: body.follower_sub, followed: body.followed_sub, followedAt: new Date().toISOString() });
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });



  app.get(HEALTH_PATH, (_req: Request, res: Response) => {
    res.type(ContentTypes.plainText).send(HEALTHY_BODY);
  });

  app.get(CuratorRoutes.me, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    res.json({
      sub: user.sub,
      email: user.email,
      linked: user.psn !== null,
      psn: user.psn,
      is_admin: user.isAdmin,
    });
  });

  app.delete(CuratorRoutes.me, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    logAction(sub, AccountActions.accountDeleted);
    users.delete(sub);
    consoleRecords.delete(sub);
    storageDeviceRecords.delete(sub);
    definitions.delete(sub);
    libraryGames.delete(sub);
    profileSettings.delete(sub);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.meActions, (req: Request, res: Response) => {
    res.json({ actions: actionLog.get(subFromRequest(req)) ?? [] });
  });

  app.post(CuratorRoutes.psnLink, (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const npsso = body['npsso'] as string | undefined;
    if (!npsso) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: CuratorDetails.npssoRequired });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    user.psn = psnLinkFrom({});
    user.psnAccountId ??= psnAccountIdFor(sub);
    logAction(sub, AccountActions.linkRequested);
    res.status(constants.HTTP_STATUS_OK).json({ linked: true, psn: user.psn });
  });

  app.delete(CuratorRoutes.psnLink, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const user = getUser(sub);
    user.psn = null;
    logAction(sub, AccountActions.unlinked);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.mePsnPreferences, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    res.json(user.psnPreferences);
  });

  app.put(CuratorRoutes.mePsnPreferences, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    const body = req.body as Partial<PsnPreferences>;
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.meRefreshSchedule, (req: Request, res: Response) => {
    const schedule = getUser(subFromRequest(req)).refreshSchedule;
    if (!schedule) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.noRefreshSchedule });
      return;
    }
    res.json(schedule);
  });

  app.put(CuratorRoutes.meRefreshSchedule, (req: Request, res: Response) => {
    const body = req.body as Partial<RefreshSchedule>;
    const user = getUser(subFromRequest(req));
    if (body.cadence !== RefreshCadences.daily && body.cadence !== RefreshCadences.weekly && body.cadence !== RefreshCadences.monthly) {
      res.status(constants.HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ detail: CuratorDetails.unknownCadence });
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

  app.delete(CuratorRoutes.meRefreshSchedule, (req: Request, res: Response) => {
    getUser(subFromRequest(req)).refreshSchedule = null;
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.meEnrichmentKeys, (req: Request, res: Response) => {
    res.json(getUser(subFromRequest(req)).enrichmentKeys);
  });

  app.put(`${CuratorRoutes.meEnrichmentKeys}/:${RouteParam.provider}`, (req: Request, res: Response) => {
    const provider = pathParam(req, RouteParam.provider);
    if (provider !== EnrichmentProviders.rawg && provider !== EnrichmentProviders.opencritic) {
      res.status(constants.HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ detail: CuratorDetails.unknownProvider });
      return;
    }
    const body = req.body as { api_key?: string };
    if (!body.api_key || !body.api_key.trim()) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.apiKeyEmpty });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    const now = new Date().toISOString();
    const clearedBySuccessfulSave = null;
    if (provider === EnrichmentProviders.rawg) {
      user.enrichmentKeys.rawg_configured = true;
      user.enrichmentKeys.rawg_added_at = now;
      user.enrichmentKeys.rawg_key_rejected_at = clearedBySuccessfulSave;
    } else {
      user.enrichmentKeys.opencritic_configured = true;
      user.enrichmentKeys.opencritic_added_at = now;
      user.enrichmentKeys.opencritic_key_rejected_at = clearedBySuccessfulSave;
    }
    logAction(sub, AccountActions.enrichmentKeyAdded, provider);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.delete(`${CuratorRoutes.meEnrichmentKeys}/:${RouteParam.provider}`, (req: Request, res: Response) => {
    const provider = pathParam(req, RouteParam.provider);
    if (provider !== EnrichmentProviders.rawg && provider !== EnrichmentProviders.opencritic) {
      res.status(constants.HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ detail: CuratorDetails.unknownProvider });
      return;
    }

    const sub = subFromRequest(req);
    const user = getUser(sub);
    if (provider === EnrichmentProviders.rawg) {
      user.enrichmentKeys.rawg_configured = false;
      user.enrichmentKeys.rawg_added_at = null;
    } else {
      user.enrichmentKeys.opencritic_configured = false;
      user.enrichmentKeys.opencritic_added_at = null;
    }
    logAction(sub, AccountActions.enrichmentKeyRemoved, provider);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.trophiesSummary, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    if (!user.psnPreferences.harvest_trophies) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.trophyHarvestingDisabled });
      return;
    }
    res.json(user.trophySummary);
  });

  app.get(CuratorRoutes.identity, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    if (!user.psnPreferences.harvest_identity) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.identityHarvestingDisabled });
      return;
    }
    res.json({
      account_id: user.psnAccountId ?? psnAccountIdFor(user.sub),
      online_id: user.onlineId,
      region: null,
    });
  });

  app.get(CuratorRoutes.presence, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    if (!user.psnPreferences.harvest_presence) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.presenceHarvestingDisabled });
      return;
    }
    res.json(PRESENCE);
  });

  app.get(CuratorRoutes.devices, (req: Request, res: Response) => {
    const user = getUser(subFromRequest(req));
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    if (!user.psnPreferences.harvest_devices) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.deviceHarvestingDisabled });
      return;
    }
    res.json(DEVICES);
  });

  app.get(CuratorRoutes.catalogGames, (req: Request, res: Response) => {
    const q = req.query[CuratorQueryParams.q] as string | undefined;
    const franchise = req.query[CuratorQueryParams.franchise] as string | undefined;
    const genre = req.query[CuratorQueryParams.genre] as string | undefined;
    const aaaTier = req.query[CuratorQueryParams.aaaTier] as string | undefined;
    const limit = req.query[CuratorQueryParams.limit] ? parseInt(req.query[CuratorQueryParams.limit] as string, 10) : CuratorPageLimits.catalog;
    const offset = req.query[CuratorQueryParams.offset] ? parseInt(req.query[CuratorQueryParams.offset] as string, 10) : 0;

    const excludeOwned = req.query[CuratorQueryParams.excludeOwned] === String(true);
    const owned = excludeOwned
      ? new Set((libraryGames.get(subFromRequest(req)) ?? []).map((game) => game.game_id))
      : new Set<string>();

    const matching = CATALOG_GAMES.filter(
      (game) =>
        (!q || game.canonical_title.toLowerCase().includes(q.toLowerCase())) &&
        (!franchise || game.franchise === franchise) &&
        (!genre || game.genre === genre) &&
        (!aaaTier || game.aaa_tier === aaaTier) &&
        matchesKind(game, req),
    );
    const filtered = sortCatalog(
      matching.filter((game) => !owned.has(game.game_id)),
      req,
    );
    const page = filtered.slice(offset, offset + limit).map(toCatalogSummary);
    res.json({
      games: page,
      total: filtered.length,
      excluded_owned: matching.length - filtered.length,
    });
  });

  app.get(CuratorRoutes.catalogGamesByGameIdCollections(`:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const gameId = pathParam(req, RouteParam.gameId);
    const holding: DefinitionRecord[] = [];
    for (const list of definitions.values()) {
      holding.push(...list.filter((d) => d.visibility === CollectionVisibilities.public && d.game_ids.includes(gameId)));
    }
    res.json({
      collections: holding.map((d) => ({
        definition_id: d.definition_id,
        name: d.name,
        share_slug: d.share_slug,
        item_count: d.game_ids.length,
        updated_at: ACCOUNT_CREATED_AT,
      })),
      total: holding.length,
    });
  });

  app.get(CuratorRoutes.catalogGenres, (_req: Request, res: Response) => {
    const genres = [...new Set(CATALOG_GAMES.map((game) => game.genre).filter((genre): genre is string => !!genre))];
    res.json({ genres });
  });

  app.get(CuratorRoutes.catalogGamesByGameId(`:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const game = CATALOG_GAMES.find((candidate) => candidate.game_id === pathParam(req, RouteParam.gameId));
    if (!game) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.noSuchGame });
      return;
    }
    res.json(toCatalogSummary(game));
  });

  app.post(CuratorRoutes.collectionsPreview, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const spec = req.body as {
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
    };

    if (spec.kind !== CollectionKinds.capacityFill && spec.kind !== CollectionKinds.filterList) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.unknownCollectionKind });
      return;
    }
    if (spec.kind === CollectionKinds.capacityFill && (!spec.console_id || !ownedConsoles(sub).has(spec.console_id))) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.consoleIdMissingOrUnknown });
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

  app.post(CuratorRoutes.collections, (req: Request, res: Response) => {
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

    if (body.kind !== CollectionKinds.capacityFill && body.kind !== CollectionKinds.filterList) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.unknownCollectionKind });
      return;
    }
    if (userDefinitions(sub).some((d) => d.name === body.name)) {
      res.status(constants.HTTP_STATUS_CONFLICT).json({ detail: `You already have a collection named '${body.name}'.` });
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
      visibility: CollectionVisibilities.private,
      share_slug: `slug-${nextShareSlug++}`,
      install_target_console_id: body.install_target_console_id ?? null,
      game_ids: body.game_ids ?? [],
    };
    userDefinitions(sub).push(definition);
    res.status(constants.HTTP_STATUS_CREATED).json(toDefinitionResponse(definition));
  });

  app.get(CuratorRoutes.collections, (req: Request, res: Response) => {
    res.json(userDefinitions(subFromRequest(req)).map(toDefinitionResponse));
  });

  app.get(CuratorRoutes.collectionsFollowed, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const followed = collectionFollows
      .filter((f) => f.follower === sub)
      .sort((a, b) => b.followedAt.localeCompare(a.followedAt))
      .map((f) => findDefinitionAnyOwner(f.definitionId))
      .filter((d): d is DefinitionRecord => d !== undefined);
    res.json(followed.map(toDefinitionResponse));
  });

  app.get(CuratorRoutes.collectionsByDefinitionId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, RouteParam.id));
    if (!definition) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }
    res.json({ ...toDefinitionResponse(definition), items: toDefinitionItems(definition) });
  });

  app.patch(CuratorRoutes.collectionsByDefinitionId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, RouteParam.id));
    if (!definition) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }
    const body = req.body as { name?: string; description?: string | null; game_ids?: string[] };
    if (body.name !== undefined && userDefinitions(sub).some((d) => d !== definition && d.name === body.name)) {
      res.status(constants.HTTP_STATUS_CONFLICT).json({ detail: `You already have a collection named '${body.name}'.` });
      return;
    }
    if (body.name !== undefined) {
      definition.name = body.name;
    }
    if (body.description !== undefined) {
      definition.description = body.description ?? null;
    }
    if (body.game_ids !== undefined) {
      definition.game_ids = body.game_ids;
    }
    res.json({ ...toDefinitionResponse(definition), items: toDefinitionItems(definition) });
  });

  app.put(CuratorRoutes.collectionsByDefinitionIdVisibility(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, RouteParam.id));
    if (!definition) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }
    const body = req.body as { visibility: string };
    if (body.visibility !== CollectionVisibilities.private && body.visibility !== CollectionVisibilities.unlisted && body.visibility !== CollectionVisibilities.public) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.unknownVisibility });
      return;
    }
    definition.visibility = body.visibility;
    res.json(toDefinitionResponse(definition));
  });

  app.delete(CuratorRoutes.collectionsByDefinitionId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDefinitions(sub);
    const idx = list.findIndex((d) => d.definition_id === pathParam(req, RouteParam.id));
    if (idx < 0) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }
    list.splice(idx, 1);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(CuratorRoutes.collectionsByDefinitionIdFollow(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = findDefinitionAnyOwner(pathParam(req, RouteParam.id));
    if (!definition || definition.visibility === CollectionVisibilities.private) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }
    if (definition.identity_sub === sub) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.cannotFollowOwnCollection });
      return;
    }
    if (!collectionFollows.some((f) => f.follower === sub && f.definitionId === definition.definition_id)) {
      collectionFollows.push({ follower: sub, definitionId: definition.definition_id, followedAt: new Date().toISOString() });
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.delete(CuratorRoutes.collectionsByDefinitionIdFollow(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const idx = collectionFollows.findIndex((f) => f.follower === sub && f.definitionId === pathParam(req, RouteParam.id));
    if (idx >= 0) {
      collectionFollows.splice(idx, 1);
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(CuratorRoutes.collectionsByDefinitionIdRuns(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const definition = userDefinitions(sub).find((d) => d.definition_id === pathParam(req, RouteParam.id));
    if (!definition) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionDefinitionNotFound });
      return;
    }

    const result = generateCollection(sub, definition);
    res.status(constants.HTTP_STATUS_CREATED).json({ run_id: `run-${String(Date.now())}`, ...pageCollectionResult(result, req) });
  });



  app.get(CuratorRoutes.publicCollectionsByShareSlug(`:${RouteParam.shareSlug}`), (req: Request, res: Response) => {
    const shareSlug = pathParam(req, RouteParam.shareSlug);
    let found: DefinitionRecord | undefined;
    for (const list of definitions.values()) {
      found = list.find((d) => d.share_slug === shareSlug);
      if (found) break;
    }
    if (!found || found.visibility === CollectionVisibilities.private) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.collectionNotFound });
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



  app.post(CuratorRoutes.consoles, (req: Request, res: Response) => {
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
    if (!(CONSOLE_PLATFORM_OPTIONS as readonly string[]).includes(body.platform)) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CONSOLE_PLATFORM_ERROR });
      return;
    }
    const capacityIsDefault = body.raw_capacity_gb === undefined || body.raw_capacity_gb === null;
    const record: ConsoleRecord = {
      console_id: `console-${nextConsoleId++}`,
      identity_sub: sub,
      name: body.name,
      platform: body.platform,
      raw_capacity_gb:
        body.raw_capacity_gb ??
        (body.platform === ConsolePlatforms.ps5
          ? CuratorConsoleCapacityDefaultsGb.ps5
          : body.platform === ConsolePlatforms.ps4
            ? CuratorConsoleCapacityDefaultsGb.ps4
            : CuratorConsoleCapacityDefaultsGb.unlistedPlatform),
      model: body.model ?? null,
      update_buffer_gb: body.update_buffer_gb ?? 0,
      routing_genres: body.routing_genres ?? [],
      fill_order: body.fill_order ?? 0,
    };
    userConsoles(sub).push(record);
    res.status(constants.HTTP_STATUS_CREATED).json({ ...toConsoleResponse(record), capacity_is_default: capacityIsDefault });
  });

  app.get(CuratorRoutes.consoles, (req: Request, res: Response) => {
    res.json(userConsoles(subFromRequest(req)).map(toConsoleResponse));
  });

  app.patch(CuratorRoutes.consolesByConsoleId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedConsole(sub, pathParam(req, RouteParam.id));
    if (!record) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.consoleNotFound });
      return;
    }
    const body = req.body as Partial<Pick<ConsoleRecord, 'name' | 'raw_capacity_gb' | 'update_buffer_gb' | 'routing_genres' | 'fill_order'>>;
    Object.assign(record, body);
    res.json(toConsoleResponse(record));
  });

  app.delete(CuratorRoutes.consolesByConsoleId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userConsoles(sub);
    const idx = list.findIndex((c) => c.console_id === pathParam(req, RouteParam.id));
    if (idx < 0) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.consoleNotFound });
      return;
    }
    const [removed] = list.splice(idx, 1);
    consoleInstalls.delete(removed.console_id);
    for (const device of userDevices(sub)) {
      if (device.console_id === removed.console_id) {
        device.console_id = null;
      }
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.consolesByConsoleIdInstalls(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedConsole(sub, pathParam(req, RouteParam.id))) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.consoleNotFound });
      return;
    }
    res.json({ game_ids: Array.from(consoleInstalls.get(pathParam(req, RouteParam.id)) ?? []).sort() });
  });

  app.put(CuratorRoutes.consolesByConsoleIdInstallsByGameId(`:${RouteParam.consoleId}`, `:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const consoleId = pathParam(req, RouteParam.consoleId);
    const gameId = pathParam(req, RouteParam.gameId);
    if (!ownedConsoles(subFromRequest(req)).has(consoleId)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.consoleNotFound });
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



  app.post(CuratorRoutes.storageDevices, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as { name: string; kind: string; capacity_gb: number; buffer_gb?: number; console_id?: string | null };
    if (body.kind !== StorageKinds.m2 && body.kind !== StorageKinds.usb) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: DEVICE_KIND_ERROR });
      return;
    }
    if (body.console_id && !findOwnedConsole(sub, body.console_id)) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: `Unknown console_id '${body.console_id}' for this user.` });
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
    res.status(constants.HTTP_STATUS_CREATED).json(toDeviceResponse(record));
  });

  app.get(CuratorRoutes.storageDevices, (req: Request, res: Response) => {
    res.json(userDevices(subFromRequest(req)).map(toDeviceResponse));
  });

  app.patch(CuratorRoutes.storageDevicesByDeviceId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, RouteParam.id));
    if (!record) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
      return;
    }
    const body = req.body as Partial<Pick<StorageDeviceRecord, 'name' | 'capacity_gb' | 'buffer_gb'>>;
    Object.assign(record, body);
    res.json(toDeviceResponse(record));
  });

  app.delete(CuratorRoutes.storageDevicesByDeviceId(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const list = userDevices(sub);
    const idx = list.findIndex((d) => d.device_id === pathParam(req, RouteParam.id));
    if (idx < 0) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
      return;
    }
    const [removed] = list.splice(idx, 1);
    deviceInstalls.delete(removed.device_id);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.put(CuratorRoutes.storageDevicesByDeviceIdAttachByConsoleId(`:${RouteParam.id}`, `:${RouteParam.consoleId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, RouteParam.id));
    if (!record) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
      return;
    }
    if (!findOwnedConsole(sub, pathParam(req, RouteParam.consoleId))) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: `Unknown console_id '${pathParam(req, RouteParam.consoleId)}' for this user.` });
      return;
    }
    record.console_id = pathParam(req, RouteParam.consoleId);
    res.json(toDeviceResponse(record));
  });

  app.delete(CuratorRoutes.storageDevicesByDeviceIdAttach(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const record = findOwnedDevice(sub, pathParam(req, RouteParam.id));
    if (!record) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
      return;
    }
    record.console_id = null;
    res.json(toDeviceResponse(record));
  });

  app.get(CuratorRoutes.storageDevicesByDeviceIdInstalls(`:${RouteParam.id}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!findOwnedDevice(sub, pathParam(req, RouteParam.id))) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
      return;
    }
    res.json({ game_ids: Array.from(deviceInstalls.get(pathParam(req, RouteParam.id)) ?? []).sort() });
  });

  app.put(CuratorRoutes.storageDevicesByDeviceIdInstallsByGameId(`:${RouteParam.deviceId}`, `:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const deviceId = pathParam(req, RouteParam.deviceId);
    const gameId = pathParam(req, RouteParam.gameId);
    if (!findOwnedDevice(sub, deviceId)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storageDeviceNotFound });
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

  app.get(CuratorRoutes.library, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const hidden = hiddenFor(sub);
    const all = libraryGames.get(sub) ?? [];
    const hiddenOnly = req.query[CuratorQueryParams.hidden] === LibraryHiddenFilters.only;
    const inView = all.filter((game) => hidden.has(game.game_id) === hiddenOnly);
    res.json({
      ...queryLibraryGames(inView, req),
      trophy_progress: trophyProgressFor(getUser(sub)),
      hidden_count: hidden.size,
    });
  });

  app.put(CuratorRoutes.libraryByGameIdHidden(`:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const gameId = pathParam(req, RouteParam.gameId);
    if (!(libraryGames.get(sub) ?? []).some((game) => game.game_id === gameId)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.noLibraryEntry });
      return;
    }
    hiddenFor(sub).add(gameId);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.delete(CuratorRoutes.libraryByGameIdHidden(`:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    hiddenFor(sub).delete(pathParam(req, RouteParam.gameId));
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.mePsPlusRotation, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!getUser(sub).psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    res.json(psPlusRotations.get(sub) ?? EMPTY_PS_PLUS_ROTATION);
  });

  app.get(CuratorRoutes.mePsPlusRotationSummary, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!getUser(sub).psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    const rotation = psPlusRotations.get(sub) ?? EMPTY_PS_PLUS_ROTATION;
    res.json({
      catalog_walked_at: rotation.catalog_walked_at,
      unclaimed: rotation.unclaimed.length,
      leaving: rotation.leaving.length,
    });
  });

  app.get(CuratorRoutes.meFriendRequests, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const user = getUser(sub);
    if (!user.psn) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinked });
      return;
    }
    if (!user.psnPreferences.harvest_identity) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.identityHarvestingDisabled });
      return;
    }
    const accepted = acceptedFriendRequests.get(sub) ?? [];
    res.json({
      requests: (receivedFriendRequests.get(sub) ?? []).filter(
        (request) => request.online_id === null || !accepted.includes(request.online_id),
      ),
    });
  });

  app.put(CuratorRoutes.meFriendsByOnlineId(`:${RouteParam.onlineId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const user = getUser(sub);
    if (!user.psnPreferences.allow_friend_writes) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.friendWritesNotPermitted });
      return;
    }
    const onlineId = pathParam(req, RouteParam.onlineId);
    const pending = (receivedFriendRequests.get(sub) ?? []).some((request) => request.online_id === onlineId);
    if (!pending) {
      res.status(constants.HTTP_STATUS_CONFLICT).json({ detail: CuratorDetails.noPendingRequest });
      return;
    }
    acceptedFriendRequests.set(sub, [...(acceptedFriendRequests.get(sub) ?? []), onlineId]);
    logAction(sub, AccountActions.friendAdded, onlineId);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(CuratorRoutes.meFriendRequestsByOnlineId(`:${RouteParam.onlineId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    if (!getUser(sub).psnPreferences.allow_friend_writes) {
      res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.friendWritesNotPermitted });
      return;
    }
    const onlineId = pathParam(req, RouteParam.onlineId);
    sentFriendRequests.set(sub, [...(sentFriendRequests.get(sub) ?? []), onlineId]);
    logAction(sub, AccountActions.friendRequestSent, onlineId);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.libraryGenres, (req: Request, res: Response) => {
    res.json({ genres: libraryGenres(libraryGames.get(subFromRequest(req)) ?? []) });
  });

  app.get(CuratorRoutes.libraryManualCandidates, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const q = req.query[CuratorQueryParams.q];
    if (typeof q !== 'string' || q.trim().length === 0) {
      res.status(constants.HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ detail: CuratorDetails.queryRequired });
      return;
    }
    const term = q.toLowerCase();
    const includeStore = req.query[CuratorQueryParams.includeStore] === String(true);
    const limit = req.query[CuratorQueryParams.limit] ? parseInt(req.query[CuratorQueryParams.limit] as string, 10) : CuratorPageLimits.manualCandidates;

    const owned = new Set((libraryGames.get(sub) ?? []).map((game) => game.game_id));
    const matching = CATALOG_GAMES.filter((game) => game.canonical_title.toLowerCase().includes(term));
    const addable = matching.filter((game) => !owned.has(game.game_id));
    const catalog = addable.slice(0, limit).map(toCatalogSummary);
    const alreadyOwned = matching.length - addable.length;

    if ((catalog.length > 0 || alreadyOwned > 0) && !includeStore) {
      res.json({
        catalog,
        store: [],
        already_owned: alreadyOwned,
        store_consulted: false,
        store_unavailable: null,
      });
      return;
    }

    if (!getUser(sub).psn) {
      res.json({
        catalog,
        store: [],
        already_owned: alreadyOwned,
        store_consulted: false,
        store_unavailable: StoreUnavailableReasons.noPsnLink,
      });
      return;
    }

    const hits = storeSearchHits.filter((hit) => hit.name.toLowerCase().includes(term)).slice(0, limit);
    res.json({
      catalog,
      store: hits.map((hit) => ({ ...hit, game_id: null })),
      already_owned: alreadyOwned,
      store_consulted: true,
      store_unavailable: null,
    });
  });

  app.post(CuratorRoutes.libraryManual, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as { game_id?: string; store_hit?: { query: string; id: string } };
    const storeHit = body.store_hit;
    if ((body.game_id === undefined) === (storeHit === undefined)) {
      res.status(constants.HTTP_STATUS_UNPROCESSABLE_ENTITY).json({ detail: CuratorDetails.manualAddNeedsOneIdentifier });
      return;
    }

    let gameId: string;
    let title: string;
    let platforms: string[] = [];

    if (storeHit) {
      if (!getUser(sub).psn) {
        res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.psnNotLinkedForStoreSearch });
        return;
      }
      const query = storeHit.query.toLowerCase();
      const hit = storeSearchHits.filter((candidate) => candidate.name.toLowerCase().includes(query)).find(
        (candidate) => candidate.id === storeHit.id,
      );
      if (!hit) {
        res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.storeHitNotInResults });
        return;
      }
      gameId = admittedGameId(hit.id);
      title = hit.name;
      platforms = hit.platforms;
    } else {
      const game = CATALOG_GAMES.find((candidate) => candidate.game_id === body.game_id);
      if (!game) {
        res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.unknownGame });
        return;
      }
      gameId = game.game_id;
      title = game.canonical_title;
    }

    const owned = libraryGames.get(sub) ?? [];
    const existing = owned.find((game) => game.game_id === gameId);
    if (existing && existing.source !== LibraryEntrySources.manual) {
      res.status(constants.HTTP_STATUS_CONFLICT).json({ detail: randomUUID() });
      return;
    }
    if (!existing) {
      owned.push(
        normalizeLibraryGames([
          { game_id: gameId, title, rawg_enriched: false, opencritic_enriched: false, source: LibraryEntrySources.manual, platforms },
        ])[0],
      );
      libraryGames.set(sub, owned);
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.delete(CuratorRoutes.libraryManualByGameId(`:${RouteParam.gameId}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const gameId = pathParam(req, RouteParam.gameId);
    const owned = libraryGames.get(sub) ?? [];
    const index = owned.findIndex((game) => game.game_id === gameId && game.source === LibraryEntrySources.manual);
    if (index < 0) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.noManualEntry });
      return;
    }
    owned.splice(index, 1);
    libraryGames.set(sub, owned);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.post(CuratorRoutes.libraryRefresh, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const runId = `lib-run-${Date.now()}`;
    libraryRuns.set(runId, { sub, status: JobStatuses.queued, error: null, result_summary: null });

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        run.status = JobStatuses.running;
      }
    }, e2eSettings.mockTimings.libraryRunStartsAfterMs);

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        const outcome = nextLibraryOutcome.get(sub) ?? { status: JobStatuses.succeeded };
        run.status = outcome.status;
        run.error = outcome.error ?? null;
        run.result_summary =
          outcome.status === JobStatuses.succeeded
            ? (outcome.result_summary ?? {
                rawg_enriched_titles: [],
                opencritic_enriched_titles: [],
                opencritic_topup_incomplete: false,
              })
            : null;
      }
    }, e2eSettings.mockTimings.libraryRunSettlesAfterMs);

    res.status(constants.HTTP_STATUS_ACCEPTED).json({ run_id: runId });
  });

  app.get(CuratorRoutes.libraryRefreshByRunId(`:${RouteParam.runId}`), (req: Request, res: Response) => {
    const run = libraryRuns.get(pathParam(req, RouteParam.runId));
    if (!run || run.sub !== subFromRequest(req)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.libraryRefreshRunNotFound });
      return;
    }
    res.json({ run_id: pathParam(req, RouteParam.runId), status: run.status, error: run.error, result_summary: run.result_summary });
  });

  app.post(CuratorRoutes.enrichmentRuns, (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const runId = `enrichment-run-${nextEnrichmentRunId++}`;
    enrichmentRuns.set(runId, { run_id: runId, status: JobStatuses.queued, error: null, result_summary: null });
    latestEnrichmentRunId = runId;

    setTimeout(() => {
      const run = enrichmentRuns.get(runId);
      if (run) {
        run.status = JobStatuses.running;
      }
    }, ENRICHMENT_RUN_LEAVES_THE_QUEUE_AFTER_MS);

    setTimeout(() => {
      const run = enrichmentRuns.get(runId);
      if (run) {
        const outcome = nextEnrichmentOutcome ?? { status: JobStatuses.succeeded as EnrichmentRunTerminalStatus };
        run.status = outcome.status;
        run.error = outcome.error ?? null;
        run.result_summary = outcome.result_summary ?? null;
      }
    }, ENRICHMENT_RUN_SETTLES_ONE_LIVE_POLL_LATER_MS);

    res.status(constants.HTTP_STATUS_ACCEPTED).json({ run_id: runId });
  });

  app.get(CuratorRoutes.enrichmentRunsLatest, (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const run = latestEnrichmentRunId === null ? undefined : enrichmentRuns.get(latestEnrichmentRunId);
    if (!run) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.noEnrichmentRunQueued });
      return;
    }
    res.json(run);
  });

  app.get(CuratorRoutes.enrichmentRunsByRunId(`:${RouteParam.runId}`), (req: Request, res: Response) => {
    if (refusedForLackingAdmin(req, res)) {
      return;
    }

    const run = enrichmentRuns.get(pathParam(req, RouteParam.runId));
    if (!run) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.enrichmentRunNotFound });
      return;
    }
    res.json(run);
  });

  app.get(CuratorRoutes.meProfileSettings, (req: Request, res: Response) => {
    res.json(settingsFor(subFromRequest(req)));
  });

  app.get(CuratorRoutes.meProfileLinkSites, (_req: Request, res: Response) => {
    res.json(PROFILE_LINK_SITES.map((site) => ({ site_key: site.site_key, display_name: site.display_name })));
  });

  app.get(CuratorRoutes.meProfileLinks, (req: Request, res: Response) => {
    res.json(profileLinksFor(subFromRequest(req)));
  });

  app.put(CuratorRoutes.meProfileLinksBySiteKey(`:${RouteParam.site_key}`), (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const siteKey = pathParam(req, RouteParam.site_key);
    const site = PROFILE_LINK_SITES.find((s) => s.site_key === siteKey);
    if (!site) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.unknownSite });
      return;
    }
    const handle = (req.body as { handle?: string }).handle?.trim() ?? null;
    if (handle === null || !PROFILE_LINK_HANDLE_PATTERN.test(handle)) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.invalidHandle });
      return;
    }
    const handles = profileLinkHandles.get(sub) ?? new Map<string, string>();
    handles.set(site.site_key, handle);
    profileLinkHandles.set(sub, handles);
    res.json({
      site_key: site.site_key,
      display_name: site.display_name,
      handle,
      url: site.url_template.replace(PROFILE_LINK_HANDLE_PLACEHOLDER, handle),
    });
  });

  app.delete(CuratorRoutes.meProfileLinksBySiteKey(`:${RouteParam.site_key}`), (req: Request, res: Response) => {
    profileLinkHandles.get(subFromRequest(req))?.delete(pathParam(req, RouteParam.site_key));
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.put(CuratorRoutes.meProfileSettings, (req: Request, res: Response) => {
    const sub = subFromRequest(req);
    const body = req.body as Partial<ProfileSettings>;
    const next: ProfileSettings = { ...DEFAULT_PROFILE_SETTINGS, ...body };
    profileSettings.set(sub, next);
    res.json(next);
  });

  app.get(CuratorRoutes.usersBySubProfile(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    const viewer = subFromRequest(req);
    const targetUser = findUser(target);
    if (!targetUser) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return;
    }

    const settings = settingsFor(target);
    const viewerIsOwner = viewer === target;
    const viewerCanSeePublicSections = viewerIsOwner || settings.is_public;

    const psnAccountId =
      viewerCanSeePublicSections && targetUser.psn ? (targetUser.psnAccountId ?? psnAccountIdFor(target)) : null;
    const libraryVisible = viewerIsOwner || (settings.is_public && settings.show_library);
    const collectionsVisible = viewerIsOwner || (settings.is_public && settings.show_collections);

    let trophies: { level: number; tier: number; earned: TrophyCounts } | null = null;
    let identity: { online_id: string } | null = null;

    const trophiesGateOpen =
      viewerCanSeePublicSections && settings.show_trophies && targetUser.psn !== null && targetUser.psnPreferences.harvest_trophies;
    const identityGateOpen =
      viewerCanSeePublicSections && settings.show_identity && targetUser.psn !== null && targetUser.psnPreferences.harvest_identity;

    if (trophiesGateOpen || identityGateOpen) {
      const viewerUser = findUser(viewer);
      const viewerHasPsn = viewerUser?.psn != null;
      if (trophiesGateOpen && viewerHasPsn) {
        const summary = targetUser.trophySummary;
        trophies = { level: summary.level, tier: summary.tier, earned: summary.earned };
      }
      if (identityGateOpen && viewerHasPsn) {
        identity = { online_id: targetUser.onlineId };
      }
    }

    const libraryCount = libraryVisible ? (libraryGames.get(target) ?? []).length : null;
    const collectionsCount = collectionsVisible
      ? userDefinitions(target).filter((d) => viewerIsOwner || d.visibility === CollectionVisibilities.public).length
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

  app.post(CuratorRoutes.usersBySubFollow(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return;
    }
    if (target === viewer) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ detail: CuratorDetails.cannotFollowYourself });
      return;
    }
    if (!isFollowing(viewer, target)) {
      followEdges.push({ follower: viewer, followed: target, followedAt: new Date().toISOString() });
    }
    logAction(viewer, AccountActions.followed, target);
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.delete(CuratorRoutes.usersBySubFollow(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    const viewer = subFromRequest(req);
    const idx = followEdges.findIndex((e) => e.follower === viewer && e.followed === target);
    if (idx >= 0) {
      followEdges.splice(idx, 1);
      logAction(viewer, AccountActions.unfollowed, target);
    }
    res.status(constants.HTTP_STATUS_NO_CONTENT).end();
  });

  app.get(CuratorRoutes.usersBySubFollowers(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    if (!findUser(target)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return;
    }
    const limit = req.query[CuratorQueryParams.limit] ? parseInt(req.query[CuratorQueryParams.limit] as string, 10) : CuratorPageLimits.followList;
    const offset = req.query[CuratorQueryParams.offset] ? parseInt(req.query[CuratorQueryParams.offset] as string, 10) : 0;
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

  app.get(CuratorRoutes.usersBySubFollowing(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    if (!findUser(target)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return;
    }
    const limit = req.query[CuratorQueryParams.limit] ? parseInt(req.query[CuratorQueryParams.limit] as string, 10) : CuratorPageLimits.followList;
    const offset = req.query[CuratorQueryParams.offset] ? parseInt(req.query[CuratorQueryParams.offset] as string, 10) : 0;
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
    const target = pathParam(req, RouteParam.sub);
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return true;
    }
    if (target !== viewer) {
      const settings = settingsFor(target);
      if (!(settings.is_public && settings.show_library)) {
        res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.profileSectionNotPublic });
        return true;
      }
    }
    return false;
  }

  app.get(CuratorRoutes.usersBySubLibrary(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json(queryLibraryGames(libraryGames.get(pathParam(req, RouteParam.sub)) ?? [], req));
  });

  app.get(CuratorRoutes.usersBySubLibraryGenres(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    if (libraryVisibilityGate(req, res)) {
      return;
    }
    res.json({ genres: libraryGenres(libraryGames.get(pathParam(req, RouteParam.sub)) ?? []) });
  });

  app.get(CuratorRoutes.usersBySubCollections(`:${RouteParam.sub}`), (req: Request, res: Response) => {
    const target = pathParam(req, RouteParam.sub);
    const viewer = subFromRequest(req);
    if (!findUser(target)) {
      res.status(constants.HTTP_STATUS_NOT_FOUND).json({ detail: CuratorDetails.userNotFound });
      return;
    }
    if (target !== viewer) {
      const settings = settingsFor(target);
      if (!(settings.is_public && settings.show_collections)) {
        res.status(constants.HTTP_STATUS_FORBIDDEN).json({ detail: CuratorDetails.profileSectionNotPublic });
        return;
      }
    }
    res.json(userDefinitions(target).map(toProfileDefinition));
  });

  return app;
}
