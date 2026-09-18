export type ContentKind = 'game' | 'media_app' | 'add_on' | 'demo' | 'soundtrack' | 'theme' | 'subscription';

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
  percent_completed: number | null;
  content_kind: ContentKind | null;
  price: CatalogPriceResponse | null;
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
  excluded_owned: number;
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
  aaa_tier: string | null;
  franchise: string;
  composite_score: number | null;
  rank_score: number;
  size_gb: number;
  size_source: SizeSource;
  percent_completed: number | null;
}

export interface CollectionPreviewResponse {
  included: CollectionGameResponse[];
  excluded: CollectionGameResponse[];
  included_total: number;
  excluded_total: number;
  included_game_ids: string[];
  used_gb: number | null;
  ignored_filters: IgnoredFilterResponse[];
  excluded_for_missing_trophy_data: number;
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
  owner_has_access: boolean;
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
  included_total: number;
  excluded_total: number;
  included_game_ids: string[];
  used_gb: number | null;
  ignored_filters: IgnoredFilterResponse[];
  excluded_for_missing_trophy_data: number;
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
  platforms: string[];
  trophy_match: TrophyMatch;
}

export interface LibraryPageResponse {
  games: LibraryGameResponse[];
  total: number;
  trophy_progress: TrophyProgressResponse;
  hidden_count: number;
}

export interface StoreSearchResultResponse {
  id: string | null;
  kind: string | null;
  game_id: string | null;
  default_product_id: string | null;
  name: string | null;
  platforms: string[];
  cover_image_url: string | null;
  classification: string | null;
  price: string | null;
  discounted_price: string | null;
  is_free: boolean | null;
}

export interface ManualCandidatesResponse {
  catalog: GameSummaryResponse[];
  store: StoreSearchResultResponse[];
  already_owned: number;
  store_consulted: boolean;
  store_unavailable: 'no_psn_link' | 'psn_auth_failed' | null;
}

export interface ManualStoreHit {
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
  library_count: number | null;
  collections_count: number | null;
  trophies_hidden_by_owner_setting: boolean;
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
  percent_completed: number | null;
  cover_image_url: string | null;
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
  capacity_is_default: boolean;
  device_link: ConsoleDeviceLinkResponse | null;
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
