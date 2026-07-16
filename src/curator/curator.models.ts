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

export interface LibraryRefreshStatusResponse {
  run_id: string;
  status: string;
  error: string | null;
}
