import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccountActionsResponse,
  CatalogGamesResponse,
  CatalogGenresResponse,
  CollectionPreviewResponse,
  CollectionRunResponse,
  CollectionSpecRequest,
  CollectionVisibility,
  ConsoleInstallResponse,
  ConsoleInstallsResponse,
  ConsoleRequest,
  ConsoleResponse,
  ConsoleUpdateRequest,
  CollectionItemSortField,
  CollectionItemsPageResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  DeviceLinkRequest,
  DevicesResponse,
  EnrichmentKeyStatusResponse,
  EnrichmentRunResponse,
  EnrichmentRunStatusResponse,
  FollowListResponse,
  GameSummaryResponse,
  IdentityResponse,
  LibraryCategoriesResponse,
  LibraryPageResponse,
  LibraryRefreshResponse,
  LibraryRefreshStatusResponse,
  ManualGameRequest,
  MeasuredSizeResponse,
  MeResponse,
  PresenceResponse,
  ProfileDefinitionResponse,
  ProfileLibraryPageResponse,
  ProfileLinkResponse,
  ProfileLinkSiteResponse,
  ProfileSettingsRequest,
  ProfileSettingsResponse,
  PsnPreferencesRequest,
  PsnPreferencesResponse,
  PublicCollectionResponse,
  RefreshScheduleRequest,
  RefreshScheduleResponse,
  PublicProfileResponse,
  SaveDefinitionRequest,
  StorageDeviceInstallResponse,
  StorageDeviceInstallsResponse,
  StorageDeviceRequest,
  StorageDeviceResponse,
  StorageDeviceUpdateRequest,
  TrophySummaryResponse,
  UpdateDefinitionRequest,
} from './curator.models';

export interface CatalogGamesQuery {
  q?: string;
  franchise?: string;
  genre?: string;
  aaaTier?: string;
  limit?: number;
  offset?: number;
}

export type LibrarySortField =
  | 'title'
  | 'category'
  | 'rawg_rating'
  | 'opencritic_rating'
  | 'psn_rating'
  | 'percent_completed';

export interface LibraryQuery {
  q?: string;
  category?: string;
  sort?: LibrarySortField;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CollectionItemsQuery {
  q?: string;
  genre?: string;
  sort?: CollectionItemSortField;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

function collectionItemsQueryParams(query: CollectionItemsQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set('q', query.q);
  }
  if (query.genre) {
    params = params.set('genre', query.genre);
  }
  if (query.sort) {
    params = params.set('sort', query.sort);
  }
  if (query.sortDir) {
    params = params.set('sortDir', query.sortDir);
  }
  if (query.limit !== undefined) {
    params = params.set('limit', query.limit);
  }
  if (query.offset !== undefined) {
    params = params.set('offset', query.offset);
  }
  return params;
}

function libraryQueryParams(query: LibraryQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set('q', query.q);
  }
  if (query.category) {
    params = params.set('category', query.category);
  }
  if (query.sort) {
    params = params.set('sort', query.sort);
  }
  if (query.sortDir) {
    params = params.set('sortDir', query.sortDir);
  }
  if (query.limit !== undefined) {
    params = params.set('limit', query.limit);
  }
  if (query.offset !== undefined) {
    params = params.set('offset', query.offset);
  }
  return params;
}

/** Thin HTTP wrapper over the Curator catalog/collections/consoles/library endpoints, shared
 * across the catalog/collections/library feature areas since their result DTOs overlap. */
@Injectable({ providedIn: 'root' })
export class CuratorService {
  private readonly http = inject(HttpClient);

  listCatalogGames(query: CatalogGamesQuery): Observable<CatalogGamesResponse> {
    let params = new HttpParams();
    if (query.q) {
      params = params.set('q', query.q);
    }
    if (query.franchise) {
      params = params.set('franchise', query.franchise);
    }
    if (query.genre) {
      params = params.set('genre', query.genre);
    }
    if (query.aaaTier) {
      params = params.set('aaaTier', query.aaaTier);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', query.limit);
    }
    if (query.offset !== undefined) {
      params = params.set('offset', query.offset);
    }
    return this.http.get<CatalogGamesResponse>('/curator/api/catalog/games', { params });
  }

  getCatalogGame(gameId: string): Observable<GameSummaryResponse> {
    return this.http.get<GameSummaryResponse>(`/curator/api/catalog/games/${gameId}`);
  }

  getCatalogGenres(): Observable<CatalogGenresResponse> {
    return this.http.get<CatalogGenresResponse>('/curator/api/catalog/genres');
  }

  previewCollection(
    spec: CollectionSpecRequest,
    options: { limit?: number; offset?: number } = {},
  ): Observable<CollectionPreviewResponse> {
    let params = new HttpParams();
    if (options.limit !== undefined) {
      params = params.set('limit', options.limit);
    }
    if (options.offset !== undefined) {
      params = params.set('offset', options.offset);
    }
    return this.http.post<CollectionPreviewResponse>('/curator/api/collections/preview', spec, { params });
  }

  saveDefinition(body: SaveDefinitionRequest): Observable<DefinitionResponse> {
    return this.http.post<DefinitionResponse>('/curator/api/collections', body);
  }

  listDefinitions(): Observable<DefinitionResponse[]> {
    return this.http.get<DefinitionResponse[]>('/curator/api/collections');
  }

  listFollowedCollections(): Observable<DefinitionResponse[]> {
    return this.http.get<DefinitionResponse[]>('/curator/api/collections/followed');
  }

  getDefinition(definitionId: string): Observable<DefinitionDetailResponse> {
    return this.http.get<DefinitionDetailResponse>(`/curator/api/collections/${definitionId}`);
  }

  getDefinitionItems(definitionId: string, query: CollectionItemsQuery = {}): Observable<CollectionItemsPageResponse> {
    return this.http.get<CollectionItemsPageResponse>(`/curator/api/collections/${definitionId}/items`, {
      params: collectionItemsQueryParams(query),
    });
  }

  linkConsoleDevice(consoleId: string, deviceId: string): Observable<void> {
    const body: DeviceLinkRequest = { device_id: deviceId };
    return this.http.put<void>(`/curator/api/consoles/${consoleId}/device-link`, body);
  }

  unlinkConsoleDevice(consoleId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/consoles/${consoleId}/device-link`);
  }

  removeDefinitionItem(definitionId: string, gameId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/collections/${definitionId}/items/${gameId}`);
  }

  updateDefinition(definitionId: string, body: UpdateDefinitionRequest): Observable<DefinitionDetailResponse> {
    return this.http.patch<DefinitionDetailResponse>(`/curator/api/collections/${definitionId}`, body);
  }

  deleteDefinition(definitionId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/collections/${definitionId}`);
  }

  setDefinitionVisibility(definitionId: string, visibility: CollectionVisibility): Observable<DefinitionResponse> {
    return this.http.put<DefinitionResponse>(`/curator/api/collections/${definitionId}/visibility`, { visibility });
  }

  followDefinition(definitionId: string): Observable<void> {
    return this.http.post<void>(`/curator/api/collections/${definitionId}/follow`, {});
  }

  unfollowDefinition(definitionId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/collections/${definitionId}/follow`);
  }

  getPublicCollection(shareSlug: string): Observable<PublicCollectionResponse> {
    return this.http.get<PublicCollectionResponse>(`/curator/api/public/collections/${shareSlug}`);
  }

  runDefinition(
    definitionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Observable<CollectionRunResponse> {
    let params = new HttpParams();
    if (options.limit !== undefined) {
      params = params.set('limit', options.limit);
    }
    if (options.offset !== undefined) {
      params = params.set('offset', options.offset);
    }
    return this.http.post<CollectionRunResponse>(`/curator/api/collections/${definitionId}/runs`, {}, { params });
  }

  createConsole(body: ConsoleRequest): Observable<ConsoleResponse> {
    return this.http.post<ConsoleResponse>('/curator/api/consoles', body);
  }

  listConsoles(): Observable<ConsoleResponse[]> {
    return this.http.get<ConsoleResponse[]>('/curator/api/consoles');
  }

  getConsole(consoleId: string): Observable<ConsoleResponse> {
    return this.http.get<ConsoleResponse>(`/curator/api/consoles/${consoleId}`);
  }

  updateConsole(consoleId: string, body: ConsoleUpdateRequest): Observable<ConsoleResponse> {
    return this.http.patch<ConsoleResponse>(`/curator/api/consoles/${consoleId}`, body);
  }

  deleteConsole(consoleId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/consoles/${consoleId}`);
  }

  getConsoleInstalls(consoleId: string): Observable<ConsoleInstallsResponse> {
    return this.http.get<ConsoleInstallsResponse>(`/curator/api/consoles/${consoleId}/installs`);
  }

  setConsoleInstall(consoleId: string, gameId: string, installed: boolean): Observable<ConsoleInstallResponse> {
    return this.http.put<ConsoleInstallResponse>(`/curator/api/consoles/${consoleId}/installs/${gameId}`, {
      installed,
    });
  }

  createStorageDevice(body: StorageDeviceRequest): Observable<StorageDeviceResponse> {
    return this.http.post<StorageDeviceResponse>('/curator/api/storage-devices', body);
  }

  listStorageDevices(): Observable<StorageDeviceResponse[]> {
    return this.http.get<StorageDeviceResponse[]>('/curator/api/storage-devices');
  }

  getStorageDevice(deviceId: string): Observable<StorageDeviceResponse> {
    return this.http.get<StorageDeviceResponse>(`/curator/api/storage-devices/${deviceId}`);
  }

  updateStorageDevice(deviceId: string, body: StorageDeviceUpdateRequest): Observable<StorageDeviceResponse> {
    return this.http.patch<StorageDeviceResponse>(`/curator/api/storage-devices/${deviceId}`, body);
  }

  deleteStorageDevice(deviceId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/storage-devices/${deviceId}`);
  }

  attachStorageDevice(deviceId: string, consoleId: string): Observable<StorageDeviceResponse> {
    return this.http.put<StorageDeviceResponse>(`/curator/api/storage-devices/${deviceId}/attach/${consoleId}`, {});
  }

  detachStorageDevice(deviceId: string): Observable<StorageDeviceResponse> {
    return this.http.delete<StorageDeviceResponse>(`/curator/api/storage-devices/${deviceId}/attach`);
  }

  getStorageDeviceInstalls(deviceId: string): Observable<StorageDeviceInstallsResponse> {
    return this.http.get<StorageDeviceInstallsResponse>(`/curator/api/storage-devices/${deviceId}/installs`);
  }

  setStorageDeviceInstall(
    deviceId: string,
    gameId: string,
    installed: boolean,
  ): Observable<StorageDeviceInstallResponse> {
    return this.http.put<StorageDeviceInstallResponse>(
      `/curator/api/storage-devices/${deviceId}/installs/${gameId}`,
      { installed },
    );
  }

  getMeasuredSizes(gameId: string): Observable<MeasuredSizeResponse[]> {
    return this.http.get<MeasuredSizeResponse[]>(`/curator/api/games/${gameId}/measured-sizes`);
  }

  setMeasuredSize(gameId: string, platform: string, sizeGb: number): Observable<MeasuredSizeResponse> {
    return this.http.put<MeasuredSizeResponse>(`/curator/api/games/${gameId}/measured-sizes/${platform}`, {
      size_gb: sizeGb,
    });
  }

  refreshLibrary(): Observable<LibraryRefreshResponse> {
    return this.http.post<LibraryRefreshResponse>('/curator/api/library/refresh', {});
  }

  getLibraryRefreshStatus(runId: string): Observable<LibraryRefreshStatusResponse> {
    return this.http.get<LibraryRefreshStatusResponse>(`/curator/api/library/refresh/${runId}`);
  }

  getLibrary(query: LibraryQuery = {}): Observable<LibraryPageResponse> {
    return this.http.get<LibraryPageResponse>('/curator/api/library', { params: libraryQueryParams(query) });
  }

  addManualGame(body: ManualGameRequest): Observable<void> {
    return this.http.post<void>('/curator/api/library/manual', body);
  }

  removeManualGame(gameId: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/library/manual/${gameId}`);
  }

  getLibraryCategories(): Observable<LibraryCategoriesResponse> {
    return this.http.get<LibraryCategoriesResponse>('/curator/api/library/categories');
  }

  getEnrichmentKeyStatus(): Observable<EnrichmentKeyStatusResponse> {
    return this.http.get<EnrichmentKeyStatusResponse>('/curator/api/me/enrichment-keys');
  }

  setRawgKey(apiKey: string): Observable<void> {
    return this.http.put<void>('/curator/api/me/enrichment-keys/rawg', { api_key: apiKey });
  }

  deleteRawgKey(): Observable<void> {
    return this.http.delete<void>('/curator/api/me/enrichment-keys/rawg');
  }

  setOpenCriticKey(apiKey: string): Observable<void> {
    return this.http.put<void>('/curator/api/me/enrichment-keys/opencritic', { api_key: apiKey });
  }

  deleteOpenCriticKey(): Observable<void> {
    return this.http.delete<void>('/curator/api/me/enrichment-keys/opencritic');
  }

  getPsnPreferences(): Observable<PsnPreferencesResponse> {
    return this.http.get<PsnPreferencesResponse>('/curator/api/me/psn-preferences');
  }

  setPsnPreferences(body: PsnPreferencesRequest): Observable<void> {
    return this.http.put<void>('/curator/api/me/psn-preferences', body);
  }

  getTrophySummary(): Observable<TrophySummaryResponse> {
    return this.http.get<TrophySummaryResponse>('/curator/api/trophies/summary');
  }

  getIdentity(): Observable<IdentityResponse> {
    return this.http.get<IdentityResponse>('/curator/api/identity');
  }

  getPresence(): Observable<PresenceResponse> {
    return this.http.get<PresenceResponse>('/curator/api/presence');
  }

  getDevices(): Observable<DevicesResponse> {
    return this.http.get<DevicesResponse>('/curator/api/devices');
  }

  getMyActions(): Observable<AccountActionsResponse> {
    return this.http.get<AccountActionsResponse>('/curator/api/me/actions');
  }

  getProfileSettings(): Observable<ProfileSettingsResponse> {
    return this.http.get<ProfileSettingsResponse>('/curator/api/me/profile-settings');
  }

  setProfileSettings(body: ProfileSettingsRequest): Observable<ProfileSettingsResponse> {
    return this.http.put<ProfileSettingsResponse>('/curator/api/me/profile-settings', body);
  }

  getRefreshSchedule(): Observable<RefreshScheduleResponse> {
    return this.http.get<RefreshScheduleResponse>('/curator/api/me/refresh-schedule');
  }

  setRefreshSchedule(body: RefreshScheduleRequest): Observable<RefreshScheduleResponse> {
    return this.http.put<RefreshScheduleResponse>('/curator/api/me/refresh-schedule', body);
  }

  deleteRefreshSchedule(): Observable<void> {
    return this.http.delete<void>('/curator/api/me/refresh-schedule');
  }

  listProfileLinkSites(): Observable<ProfileLinkSiteResponse[]> {
    return this.http.get<ProfileLinkSiteResponse[]>('/curator/api/me/profile-link-sites');
  }

  getProfileLinks(): Observable<ProfileLinkResponse[]> {
    return this.http.get<ProfileLinkResponse[]>('/curator/api/me/profile-links');
  }

  setProfileLink(siteKey: string, handle: string): Observable<ProfileLinkResponse> {
    return this.http.put<ProfileLinkResponse>(`/curator/api/me/profile-links/${siteKey}`, { handle });
  }

  deleteProfileLink(siteKey: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/me/profile-links/${siteKey}`);
  }

  getUserProfile(sub: string): Observable<PublicProfileResponse> {
    return this.http.get<PublicProfileResponse>(`/curator/api/users/${sub}/profile`);
  }

  followUser(sub: string): Observable<void> {
    return this.http.post<void>(`/curator/api/users/${sub}/follow`, {});
  }

  unfollowUser(sub: string): Observable<void> {
    return this.http.delete<void>(`/curator/api/users/${sub}/follow`);
  }

  getFollowers(sub: string, limit = 50, offset = 0): Observable<FollowListResponse> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<FollowListResponse>(`/curator/api/users/${sub}/followers`, { params });
  }

  getFollowing(sub: string, limit = 50, offset = 0): Observable<FollowListResponse> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<FollowListResponse>(`/curator/api/users/${sub}/following`, { params });
  }

  getUserLibrary(sub: string, query: LibraryQuery = {}): Observable<ProfileLibraryPageResponse> {
    return this.http.get<ProfileLibraryPageResponse>(`/curator/api/users/${sub}/library`, {
      params: libraryQueryParams(query),
    });
  }

  getUserLibraryCategories(sub: string): Observable<LibraryCategoriesResponse> {
    return this.http.get<LibraryCategoriesResponse>(`/curator/api/users/${sub}/library/categories`);
  }

  getUserCollections(sub: string): Observable<ProfileDefinitionResponse[]> {
    return this.http.get<ProfileDefinitionResponse[]>(`/curator/api/users/${sub}/collections`);
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>('/curator/api/me');
  }

  startEnrichmentRun(): Observable<EnrichmentRunResponse> {
    return this.http.post<EnrichmentRunResponse>('/curator/api/enrichment/runs', {});
  }

  getLatestEnrichmentRun(): Observable<EnrichmentRunStatusResponse> {
    return this.http.get<EnrichmentRunStatusResponse>('/curator/api/enrichment/runs/latest');
  }

  getEnrichmentRunStatus(runId: string): Observable<EnrichmentRunStatusResponse> {
    return this.http.get<EnrichmentRunStatusResponse>(`/curator/api/enrichment/runs/${runId}`);
  }
}
