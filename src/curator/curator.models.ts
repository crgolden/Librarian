/** DTOs mirroring the Curator FastAPI Pydantic response/request models for catalog, collections,
 * consoles, and library-refresh. Field names/nullability match the Python source exactly. */

export interface GameSummaryResponse {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
}

export interface CatalogGamesResponse {
  games: GameSummaryResponse[];
}

export interface CollectionSpecRequest {
  kind: string;
  console_id?: string | null;
  genre_filter: string[];
  min_score?: number | null;
  aaa_tier_filter?: string | null;
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
}

export interface CollectionPreviewResponse {
  included: CollectionGameResponse[];
  excluded: CollectionGameResponse[];
  used_gb: number | null;
}

export interface SaveDefinitionRequest extends CollectionSpecRequest {
  name: string;
}

export interface DefinitionResponse {
  definition_id: string;
  name: string;
  kind: string;
  console_id: string | null;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
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
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
}

export interface EnrichmentKeyStatusResponse {
  rawg_configured: boolean;
  opencritic_configured: boolean;
  rawg_added_at: string | null;
  opencritic_added_at: string | null;
}

export interface SetEnrichmentKeyRequest {
  api_key: string;
}

export interface PsnPreferencesResponse {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
}

export interface PsnPreferencesRequest {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
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
  rawg_enriched: boolean;
  opencritic_enriched: boolean;
}

export interface ProfileDefinitionResponse {
  definition_id: string;
  name: string;
  kind: string;
  console_id: string | null;
}
