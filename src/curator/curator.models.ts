/** DTOs mirroring the Curator FastAPI Pydantic response/request models for catalog, collections,
 * consoles, and library-refresh. Field names/nullability match the Python source exactly. */

export interface GameSummaryResponse {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
  cover_image_url: string | null;
  store_product_id: string | null;
  critical_score: number | null;
  oc_score: number | null;
  psn_rating: number | null;
  percent_completed?: number | null;
}

export interface CatalogGamesResponse {
  games: GameSummaryResponse[];
  total: number;
}

export interface CatalogGenresResponse {
  genres: string[];
}

export interface CollectionSpecRequest {
  kind: string;
  console_id?: string | null;
  genre_filter: string[];
  min_score?: number | null;
  aaa_tier_filter?: string | null;
  /** An OR-capable predicate tree (Curator WP8, curator.collections.filter_predicate) that replaces
   * genre_filter/min_score/aaa_tier_filter entirely when set. No authoring UI exists in Librarian yet --
   * this is a pass-through type only. */
  filter_predicate?: Record<string, unknown> | null;
  include_inactive?: boolean;
  min_percent_completed?: number | null;
  sort_order?: string | null;
  exclude_installed_on?: string[];
}

export interface CollectionGameResponse {
  game_id: string;
  title: string;
  genre: string;
  aaa_tier: string;
  franchise: string;
  composite_score: number | null;
  rank_score: number;
  size_gb: number;
  percent_completed: number | null;
}

export interface CollectionPreviewResponse {
  included: CollectionGameResponse[];
  excluded: CollectionGameResponse[];
  used_gb: number | null;
}

export interface SaveDefinitionRequest extends CollectionSpecRequest {
  name: string;
  description?: string | null;
  game_ids?: string[];
}

export interface UpdateDefinitionRequest {
  name?: string;
  description?: string | null;
  game_ids?: string[];
}

export type CollectionVisibility = 'private' | 'unlisted' | 'public';

export interface VisibilityUpdateRequest {
  visibility: CollectionVisibility;
}

export interface DefinitionResponse {
  definition_id: string;
  name: string;
  description: string | null;
  kind: string;
  console_id: string | null;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
  /** See CollectionSpecRequest's field of the same name. */
  filter_predicate?: Record<string, unknown> | null;
  include_inactive: boolean;
  min_percent_completed: number | null;
  sort_order: string | null;
  exclude_installed_on: string[];
  visibility: CollectionVisibility;
  share_slug: string | null;
  item_count: number;
}

export interface CollectionItemResponse {
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
  /** The collection owner's own access — identical for every viewer. A title the owner has since
   * lost stays listed and renders as unavailable rather than disappearing. */
  owner_has_access: boolean;
}

export interface DefinitionDetailResponse extends DefinitionResponse {
  items: CollectionItemResponse[];
}

export type CollectionItemSortField = 'rank' | 'title' | 'critical_score' | 'oc_score' | 'psn_rating';

export interface CollectionItemsPageResponse {
  items: CollectionItemResponse[];
  total: number;
}

export interface PublicCollectionResponse {
  definition_id: string;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  items: CollectionItemResponse[];
}

export interface CollectionRunResponse {
  run_id: string;
  included: CollectionGameResponse[];
  excluded: CollectionGameResponse[];
  used_gb: number | null;
}

export interface ConsoleInstallResponse {
  console_id: string;
  game_id: string;
  installed: boolean;
}

export interface LibraryRefreshResponse {
  run_id: string;
}

export interface LibraryRefreshResultSummary {
  rawg_enriched_titles: string[];
  opencritic_enriched_titles: string[];
  opencritic_topup_incomplete: boolean;
}

export interface LibraryRefreshStatusResponse {
  run_id: string;
  status: string;
  error: string | null;
  result_summary: LibraryRefreshResultSummary | null;
}

export interface LibraryGameResponse {
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
  /** `'psn'` for an entitlement-backed entry, `'manual'` for one the owner added by hand. */
  source: string;
  cover_image_url: string | null;
  /** Platforms the owner holds this game on, newest first. Empty for a manually-added entry. */
  platforms: string[];
}

export interface LibraryPageResponse {
  games: LibraryGameResponse[];
  total: number;
}

export interface ManualGameRequest {
  game_id: string;
  native_ps5?: boolean;
  ps4_eligible?: boolean;
  owned_edition?: string | null;
}

export interface LibraryCategoriesResponse {
  categories: string[];
}

export interface PsnSummary {
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

export interface MeResponse {
  sub: string;
  email: string | null;
  linked: boolean;
  psn: PsnSummary | null;
  is_admin: boolean;
}

export interface EnrichmentRunResponse {
  run_id: string;
}

/** Loosely typed: each of the four passes (opencritic_cache_refresh/franchise_reclassification/
 * tier_reclassification/enrichment) has its own inner shape that varies by its own nested `status`
 * string -- see curator._enrichment_run_handler in app.py for the four passes' exact Python shapes. */
export interface EnrichmentPassSummary {
  status?: string;
  [key: string]: unknown;
}

export interface EnrichmentRunResultSummary {
  opencritic_cache_refresh?: EnrichmentPassSummary;
  franchise_reclassification?: EnrichmentPassSummary;
  tier_reclassification?: EnrichmentPassSummary;
  enrichment?: EnrichmentPassSummary;
}

export interface EnrichmentRunStatusResponse {
  run_id: string;
  status: string;
  error: string | null;
  result_summary: EnrichmentRunResultSummary | null;
}

export interface EnrichmentKeyStatusResponse {
  rawg_configured: boolean;
  opencritic_configured: boolean;
  rawg_added_at: string | null;
  opencritic_added_at: string | null;
  rawg_key_rejected_at: string | null;
  opencritic_key_rejected_at: string | null;
}

export interface SetEnrichmentKeyRequest {
  api_key: string;
}

export interface PsnPreferencesResponse {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
  allow_friend_writes: boolean;
  allow_chat_writes: boolean;
}

export interface PsnPreferencesRequest {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
  allow_friend_writes: boolean;
  allow_chat_writes: boolean;
}

export interface TrophyCountsResponse {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface TrophySummaryResponse {
  level: number;
  progress: number;
  tier: number;
  earned: TrophyCountsResponse;
  account_id: string | null;
}

export interface IdentityResponse {
  account_id: string;
  online_id: string;
  region: string | null;
}

export interface PresenceResponse {
  online_status: string;
  platform: string | null;
  last_online_date: string | null;
  game_title: string | null;
}

export interface DeviceResponse {
  device_id: string;
  device_type: string;
  device_name: string;
  activation_type: string;
  activation_date: string | null;
  deactivation_date: string | null;
  linked_console_id: string | null;
}

export interface DeviceLinkRequest {
  device_id: string;
}

export interface DevicesResponse {
  devices: DeviceResponse[];
}

export interface AccountActionResponse {
  action: string;
  detail: string | null;
  occurred_at: string;
}

export interface AccountActionsResponse {
  actions: AccountActionResponse[];
}

export interface ProfileSettingsResponse {
  is_public: boolean;
  show_library: boolean;
  show_collections: boolean;
  show_trophies: boolean;
  show_identity: boolean;
}

export type ProfileSettingsRequest = ProfileSettingsResponse;

export interface ProfileTrophySummaryResponse {
  level: number;
  tier: number;
  earned: TrophyCountsResponse;
}

/** No `region` field, structurally — PSN only ever exposes an account's region to that account
 * itself, which makes it useless for the cross-user viewer's-own-token lookup this backs. */
export interface ProfileIdentityResponse {
  online_id: string;
}

export interface PublicProfileResponse {
  sub: string;
  psn_account_id: string | null;
  is_public: boolean;
  viewer_is_owner: boolean;
  viewer_is_following: boolean;
  follower_count: number;
  following_count: number;
  library_visible: boolean;
  collections_visible: boolean;
  trophies: ProfileTrophySummaryResponse | null;
  identity: ProfileIdentityResponse | null;
}

export interface FollowListEntryResponse {
  sub: string;
  psn_account_id: string | null;
  followed_at: string;
}

export interface FollowListResponse {
  entries: FollowListEntryResponse[];
  total: number;
}

export interface ProfileLibraryGameResponse {
  game_id: string;
  title: string;
  category: string | null;
  rawg_rating: number | null;
  opencritic_rating: number | null;
  psn_rating: number | null;
  psn_product_id: string | null;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
  /** Always null for now -- viewer-mode trophy completion isn't built yet. */
  percent_completed: number | null;
  cover_image_url: string | null;
  /** Platforms this owner holds the game on, newest first. Empty for a manually-added entry. */
  platforms: string[];
}

export interface ProfileLibraryPageResponse {
  games: ProfileLibraryGameResponse[];
  total: number;
}

export interface ProfileDefinitionResponse {
  definition_id: string;
  name: string;
  kind: string;
  console_id: string | null;
  item_count: number;
}

export interface ConsoleRequest {
  name: string;
  platform: string;
  raw_capacity_gb?: number | null;
  model?: string | null;
  update_buffer_gb?: number;
  routing_genres?: string[];
  fill_order?: number;
}

export interface ConsoleUpdateRequest {
  name?: string;
  raw_capacity_gb?: number;
  update_buffer_gb?: number;
  routing_genres?: string[];
  fill_order?: number;
}

export interface ConsoleResponse {
  console_id: string;
  name: string;
  platform: string;
  raw_capacity_gb: number;
  model: string | null;
  update_buffer_gb: number;
  effective_capacity_gb: number;
  routing_genres: string[];
  fill_order: number;
  /** Only ever `true` in the response to the `POST` that created this console, when
   * `raw_capacity_gb` was omitted and the capacity shown was auto-assigned from `model`/`platform`
   * rather than supplied — a one-time "we guessed this, correct it if wrong" signal. */
  capacity_is_default: boolean;
}

export interface ConsoleInstallsResponse {
  game_ids: string[];
}

export interface StorageDeviceRequest {
  name: string;
  kind: string;
  capacity_gb: number;
  buffer_gb?: number;
  console_id?: string | null;
}

export interface StorageDeviceUpdateRequest {
  name?: string;
  capacity_gb?: number;
  buffer_gb?: number;
}

export interface StorageDeviceResponse {
  device_id: string;
  console_id: string | null;
  name: string;
  kind: string;
  capacity_gb: number;
  buffer_gb: number;
  effective_capacity_gb: number;
}

export interface StorageDeviceInstallResponse {
  device_id: string;
  game_id: string;
  installed: boolean;
}

export interface StorageDeviceInstallsResponse {
  game_ids: string[];
}

export interface MeasuredSizeResponse {
  game_id: string;
  platform: string;
  size_gb: number;
  recorded_by: string | null;
  recorded_at: string;
}
