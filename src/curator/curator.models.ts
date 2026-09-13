/** Curator's closed `games.content_kind` vocabulary; `null` means nothing has classified the entry yet. */
export type ContentKind = 'game' | 'media_app' | 'add_on' | 'demo' | 'soundtrack' | 'theme' | 'subscription';

/** The `kind` a catalog request may ask for: one kind, or `all` to drop the default game-only view. */
export type CatalogKind = ContentKind | 'all';

export type CatalogSortField = 'title' | 'price';

export interface CatalogPriceResponse {
  is_free: boolean | null;
  tied_to_subscription: boolean | null;
  base_cents: number | null;
  discounted_cents: number | null;
  discount_text: string | null;
  fetched_at: string;
}

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
  content_kind?: ContentKind | null;
  /** The most recent storefront price; absent from a Curator that predates the field. */
  price?: CatalogPriceResponse | null;
}

export interface PublicCollectionSummaryResponse {
  definition_id: string;
  name: string;
  share_slug: string;
  item_count: number;
  updated_at: string;
}

export interface GameCollectionsResponse {
  collections: PublicCollectionSummaryResponse[];
  total: number;
}

export interface CatalogGamesResponse {
  games: GameSummaryResponse[];
  total: number;
  /**
   * Matches dropped because the caller already holds them; non-zero only for an `excludeOwned` request.
   * Absent from a Curator that predates the field, which reads as nothing excluded.
   */
  excluded_owned?: number;
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
  /** Replaces `genre_filter`, `min_score` and `aaa_tier_filter` entirely when set. */
  filter_predicate?: Record<string, unknown> | null;
  include_inactive?: boolean;
  min_percent_completed?: number | null;
  sort_order?: string | null;
  exclude_installed_on?: string[];
  install_target_console_id?: string | null;
}

export type SizeSource = 'measured' | 'download' | 'estimated' | 'capped_default' | 'default';

export interface IgnoredFilterResponse {
  filter: string;
  reason: string;
}

export interface CollectionGameResponse {
  game_id: string;
  title: string;
  genre: string;
  /** Null when the game has no stored publisher tier. */
  aaa_tier: string | null;
  franchise: string;
  composite_score: number | null;
  rank_score: number;
  size_gb: number;
  /**
   * Which rung produced `size_gb`: a contributed measurement, Sony's own download size, a per-platform
   * estimate band, the platform's media ceiling, or the flat fallback. Only `default` means nothing
   * knows this title's size.
   */
  size_source: SizeSource;
  percent_completed: number | null;
}

export interface CollectionPreviewResponse {
  included: CollectionGameResponse[];
  excluded: CollectionGameResponse[];
  /** Counts the whole generated result; `included` is only the requested page of it. */
  included_total: number;
  excluded_total: number;
  /** Every included id, unpaged; `included` is one page of it. */
  included_game_ids: string[];
  used_gb: number | null;
  /** Filters the run let everything through, each with why; absent from a Curator that predates the field. */
  ignored_filters?: IgnoredFilterResponse[];
  /** Games a completion floor dropped for carrying no trophy data at all. */
  excluded_for_missing_trophy_data?: number;
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
  filter_predicate?: Record<string, unknown> | null;
  include_inactive: boolean;
  min_percent_completed: number | null;
  sort_order: string | null;
  exclude_installed_on: string[];
  install_target_console_id: string | null;
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
  /** The owner's own access, identical for every viewer; a title the owner has since lost stays listed. */
  owner_has_access: boolean;
  /** Installed on the collection's `install_target_console_id`; `null` when it targets no console. */
  installed_on_target: boolean | null;
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
  /** Counts the whole generated result; the run persists all of it, the response carries one page. */
  included_total: number;
  excluded_total: number;
  /** Every proposed id, unpaged. */
  included_game_ids: string[];
  used_gb: number | null;
  ignored_filters?: IgnoredFilterResponse[];
  excluded_for_missing_trophy_data?: number;
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
  rejected_providers?: string[];
  unavailable_providers?: string[];
  stopped_reason?: string;
  rate_limited_provider?: string;
  retry_after_seconds?: number;
  remaining_count?: number;
}

export interface LibraryRefreshStatusResponse {
  run_id: string;
  status: string;
  error: string | null;
  result_summary: LibraryRefreshResultSummary | null;
}

export type LibraryEntrySource = 'psn' | 'manual';

/** Whether an entry resolved to a PSN trophy title; `not_attempted` until a refresh has tried. */
export type TrophyMatch = 'matched' | 'unmatched' | 'not_attempted';

export type TrophyProgressState = 'off' | 'pending' | 'on';

export type TrophyProgressReason = 'no_link' | 'harvest_off' | 'never_refreshed';

export interface TrophyProgressResponse {
  state: TrophyProgressState;
  reason: TrophyProgressReason | null;
}

export type LibraryHiddenFilter = 'exclude' | 'only';

export interface LibraryGameResponse {
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
  source: LibraryEntrySource;
  cover_image_url: string | null;
  /** Platforms the owner holds this game on, newest first. Empty for a manually-added entry. */
  platforms: string[];
  trophy_match?: TrophyMatch;
}

export interface LibraryPageResponse {
  games: LibraryGameResponse[];
  total: number;
  /** Why `percent_completed` is blank across the page; absent from a Curator that predates the field. */
  trophy_progress?: TrophyProgressResponse;
  /** How many of the caller's games are hidden, whichever view this page shows. */
  hidden_count?: number;
}

export interface StoreSearchResultResponse {
  /** For the full-games domain this is a PSN concept id. Null where PSN published none. */
  id: string | null;
  /** `'Concept'` or `'Product'`, saying which id space `id` belongs to. */
  kind: string | null;
  /** The catalog game this hit already resolves to. Null does not mean the catalog has never seen it. */
  game_id: string | null;
  default_product_id: string | null;
  name: string | null;
  platforms: string[];
  cover_image_url: string | null;
  /** PSN's own display classification, verbatim. Null is not the same as "not a full game". */
  classification: string | null;
  price: string | null;
  discounted_price: string | null;
  is_free: boolean | null;
}

export interface ManualCandidatesResponse {
  /** Catalogued games the caller does not already hold. */
  catalog: GameSummaryResponse[];
  /** Store candidates, empty unless `store_consulted`. */
  store: StoreSearchResultResponse[];
  /** Catalogued matches dropped as already owned. */
  already_owned: number;
  /** Whether a Store search was spent. */
  store_consulted: boolean;
  /** Why the Store could not be consulted, when that question arose. */
  store_unavailable: 'no_psn_link' | 'psn_auth_failed' | null;
}

export interface ManualStoreHit {
  /** The `q` that produced the hit; Curator re-runs it to verify `id`. */
  query: string;
  id: string;
}

export interface ManualGameOptions {
  native_ps5?: boolean;
  ps4_eligible?: boolean;
  owned_edition?: string | null;
}

export type ManualGameRequest = ManualGameOptions &
  ({ game_id: string; store_hit?: never } | { store_hit: ManualStoreHit; game_id?: never });

export interface LibraryGenresResponse {
  genres: string[];
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

export type RefreshCadence = 'daily' | 'weekly' | 'monthly';

export interface RefreshScheduleResponse {
  cadence: RefreshCadence;
  ps_plus_watch: boolean;
  next_run_at: string;
  last_run_at: string | null;
  consecutive_failures: number;
  paused_reason: string | null;
}

export interface RefreshScheduleRequest {
  cadence: RefreshCadence;
  ps_plus_watch: boolean;
}

export type PsPlusTier = 'extra' | 'premium';

export interface PsPlusTitleResponse {
  title_id: string;
  /** The catalog game to link to, or null when the title is known only to the storefront. */
  game_id: string | null;
  title: string | null;
  tier: PsPlusTier | null;
  platforms: string[];
  cover_image_url: string | null;
  store_product_id: string | null;
  since_at: string | null;
}

export interface PsPlusCategoryResponse {
  tier: PsPlusTier;
  walked_at: string | null;
  total: number;
}

export interface PsPlusRotationResponse {
  catalog_walked_at: string | null;
  /** The instant `added` and `leaving` are measured from; null until every category has two walks. */
  since: string | null;
  added: PsPlusTitleResponse[];
  leaving: PsPlusTitleResponse[];
  unclaimed: PsPlusTitleResponse[];
  lapsed: PsPlusTitleResponse[];
  categories: PsPlusCategoryResponse[];
}

export interface PsPlusRotationSummaryResponse {
  catalog_walked_at: string | null;
  unclaimed: number;
  leaving: number;
}

export interface FriendRequestResponse {
  online_id: string | null;
  account_id: string;
}

export interface FriendRequestsResponse {
  requests: FriendRequestResponse[];
}

export interface ProfileTrophySummaryResponse {
  level: number;
  tier: number;
  earned: TrophyCountsResponse;
}

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
  created_at: string | null;
  /** Null when `library_visible` is false. */
  library_count: number | null;
  /** Null when `collections_visible` is false; counts only public definitions for a non-owner. */
  collections_count: number | null;
  /** Always false for a viewer. */
  trophies_hidden_by_owner_setting: boolean;
  /** Empty for a viewer of a private profile. */
  profile_links: ProfileLinkResponse[];
}

export interface ProfileLinkSiteResponse {
  site_key: string;
  display_name: string;
}

export interface ProfileLinkResponse {
  site_key: string;
  display_name: string;
  handle: string;
  /** Built by Curator from the site's own template; never supplied by, or echoed from, a client. */
  url: string;
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
  genre: string | null;
  rawg_rating: number | null;
  opencritic_rating: number | null;
  psn_rating: number | null;
  psn_product_id: string | null;
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
  /** Always null in viewer mode; Curator only ever populates it for the owner's own request. */
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
  /**
   * True only in the response to the `POST` that created this console with `raw_capacity_gb` omitted;
   * the capacity was assigned from `model`/`platform`.
   */
  capacity_is_default: boolean;
  /** The linked PSN device and what PSN currently says about it; absent or null when unlinked. */
  device_link?: ConsoleDeviceLinkResponse | null;
}

export type ConsoleDeviceLinkState = 'linked' | 'device_deactivated' | 'device_missing' | 'not_checked';

export interface ConsoleDeviceLinkResponse {
  device_id: string;
  state: ConsoleDeviceLinkState;
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
