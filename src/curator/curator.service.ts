import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { CuratorApi, CuratorQueryParams } from './curator-api';
import {
  AccountActionsResponse,
  CatalogGamesResponse,
  CatalogGenresResponse,
  CatalogKind,
  CatalogSortField,
  FriendRequestsResponse,
  GameCollectionsResponse,
  LibraryHiddenFilter,
  PsPlusRotationResponse,
  PsPlusRotationSummaryResponse,
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
  LibraryGenresResponse,
  LibraryPageResponse,
  LibraryRefreshResponse,
  LibraryRefreshStatusResponse,
  LibrarySortField,
  ManualCandidatesResponse,
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
  SortDirection,
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
  excludeOwned?: boolean;
  kind?: CatalogKind;
  sort?: CatalogSortField;
  sortDir?: SortDirection;
  limit?: number;
  offset?: number;
}

export interface LibraryQuery {
  q?: string;
  genre?: string;
  sort?: LibrarySortField;
  sortDir?: SortDirection;
  limit?: number;
  offset?: number;
  hidden?: LibraryHiddenFilter;
}

export interface CollectionItemsQuery {
  q?: string;
  genre?: string;
  sort?: CollectionItemSortField;
  sortDir?: SortDirection;
  limit?: number;
  offset?: number;
}

function collectionItemsQueryParams(query: CollectionItemsQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set(CuratorQueryParams.q, query.q);
  }
  if (query.genre) {
    params = params.set(CuratorQueryParams.genre, query.genre);
  }
  if (query.sort) {
    params = params.set(CuratorQueryParams.sort, query.sort);
  }
  if (query.sortDir) {
    params = params.set(CuratorQueryParams.sortDir, query.sortDir);
  }
  if (query.limit !== undefined) {
    params = params.set(CuratorQueryParams.limit, query.limit);
  }
  if (query.offset !== undefined) {
    params = params.set(CuratorQueryParams.offset, query.offset);
  }
  return params;
}

function libraryQueryParams(query: LibraryQuery): HttpParams {
  let params = new HttpParams();
  if (query.q) {
    params = params.set(CuratorQueryParams.q, query.q);
  }
  if (query.genre) {
    params = params.set(CuratorQueryParams.genre, query.genre);
  }
  if (query.sort) {
    params = params.set(CuratorQueryParams.sort, query.sort);
  }
  if (query.sortDir) {
    params = params.set(CuratorQueryParams.sortDir, query.sortDir);
  }
  if (query.limit !== undefined) {
    params = params.set(CuratorQueryParams.limit, query.limit);
  }
  if (query.offset !== undefined) {
    params = params.set(CuratorQueryParams.offset, query.offset);
  }
  if (query.hidden) {
    params = params.set(CuratorQueryParams.hidden, query.hidden);
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class CuratorService {
  private readonly http = inject(HttpClient);

  listCatalogGames(query: CatalogGamesQuery): Observable<CatalogGamesResponse> {
    let params = new HttpParams();
    if (query.q) {
      params = params.set(CuratorQueryParams.q, query.q);
    }
    if (query.franchise) {
      params = params.set(CuratorQueryParams.franchise, query.franchise);
    }
    if (query.genre) {
      params = params.set(CuratorQueryParams.genre, query.genre);
    }
    if (query.aaaTier) {
      params = params.set(CuratorQueryParams.aaaTier, query.aaaTier);
    }
    if (query.excludeOwned === true) {
      params = params.set(CuratorQueryParams.excludeOwned, true);
    }
    if (query.kind) {
      params = params.set(CuratorQueryParams.kind, query.kind);
    }
    if (query.sort) {
      params = params.set(CuratorQueryParams.sort, query.sort);
    }
    if (query.sortDir) {
      params = params.set(CuratorQueryParams.sortDir, query.sortDir);
    }
    if (query.limit !== undefined) {
      params = params.set(CuratorQueryParams.limit, query.limit);
    }
    if (query.offset !== undefined) {
      params = params.set(CuratorQueryParams.offset, query.offset);
    }
    return this.http.get<CatalogGamesResponse>(CuratorApi.catalogGames, { params });
  }

  getCatalogGame(gameId: string): Observable<GameSummaryResponse> {
    return this.http.get<GameSummaryResponse>(CuratorApi.catalogGamesByGameId(gameId));
  }

  getCatalogGameCollections(gameId: string): Observable<GameCollectionsResponse> {
    return this.http.get<GameCollectionsResponse>(CuratorApi.catalogGamesByGameIdCollections(gameId));
  }

  getPsPlusRotation(): Observable<PsPlusRotationResponse> {
    return this.http.get<PsPlusRotationResponse>(CuratorApi.mePsPlusRotation);
  }

  getPsPlusRotationSummary(): Observable<PsPlusRotationSummaryResponse> {
    return this.http.get<PsPlusRotationSummaryResponse>(CuratorApi.mePsPlusRotationSummary);
  }

  hideLibraryGame(gameId: string): Observable<void> {
    return this.http.put<void>(CuratorApi.libraryByGameIdHidden(gameId), {});
  }

  unhideLibraryGame(gameId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.libraryByGameIdHidden(gameId));
  }

  getFriendRequests(): Observable<FriendRequestsResponse> {
    return this.http.get<FriendRequestsResponse>(CuratorApi.meFriendRequests);
  }

  sendFriendRequest(onlineId: string): Observable<void> {
    return this.http.post<void>(CuratorApi.meFriendRequestsByOnlineId(onlineId), {});
  }

  acceptFriendRequest(onlineId: string): Observable<void> {
    return this.http.put<void>(CuratorApi.meFriendsByOnlineId(onlineId), {});
  }

  getCatalogGenres(): Observable<CatalogGenresResponse> {
    return this.http.get<CatalogGenresResponse>(CuratorApi.catalogGenres);
  }

  previewCollection(
    spec: CollectionSpecRequest,
    options: { limit?: number; offset?: number } = {},
  ): Observable<CollectionPreviewResponse> {
    let params = new HttpParams();
    if (options.limit !== undefined) {
      params = params.set(CuratorQueryParams.limit, options.limit);
    }
    if (options.offset !== undefined) {
      params = params.set(CuratorQueryParams.offset, options.offset);
    }
    return this.http.post<CollectionPreviewResponse>(CuratorApi.collectionsPreview, spec, { params });
  }

  saveDefinition(body: SaveDefinitionRequest): Observable<DefinitionResponse> {
    return this.http.post<DefinitionResponse>(CuratorApi.collections, body);
  }

  listDefinitions(): Observable<DefinitionResponse[]> {
    return this.http.get<DefinitionResponse[]>(CuratorApi.collections);
  }

  listFollowedCollections(): Observable<DefinitionResponse[]> {
    return this.http.get<DefinitionResponse[]>(CuratorApi.collectionsFollowed);
  }

  getDefinition(definitionId: string): Observable<DefinitionDetailResponse> {
    return this.http.get<DefinitionDetailResponse>(CuratorApi.collectionsByDefinitionId(definitionId));
  }

  getDefinitionItems(definitionId: string, query: CollectionItemsQuery = {}): Observable<CollectionItemsPageResponse> {
    return this.http.get<CollectionItemsPageResponse>(CuratorApi.collectionsByDefinitionIdItems(definitionId), {
      params: collectionItemsQueryParams(query),
    });
  }

  linkConsoleDevice(consoleId: string, deviceId: string): Observable<void> {
    const body: DeviceLinkRequest = { device_id: deviceId };
    return this.http.put<void>(CuratorApi.consolesByConsoleIdDeviceLink(consoleId), body);
  }

  unlinkConsoleDevice(consoleId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.consolesByConsoleIdDeviceLink(consoleId));
  }

  removeDefinitionItem(definitionId: string, gameId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.collectionsByDefinitionIdItemsByGameId(definitionId, gameId));
  }

  updateDefinition(definitionId: string, body: UpdateDefinitionRequest): Observable<DefinitionDetailResponse> {
    return this.http.patch<DefinitionDetailResponse>(CuratorApi.collectionsByDefinitionId(definitionId), body);
  }

  deleteDefinition(definitionId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.collectionsByDefinitionId(definitionId));
  }

  setDefinitionVisibility(definitionId: string, visibility: CollectionVisibility): Observable<DefinitionResponse> {
    return this.http.put<DefinitionResponse>(CuratorApi.collectionsByDefinitionIdVisibility(definitionId), { visibility });
  }

  followDefinition(definitionId: string): Observable<void> {
    return this.http.post<void>(CuratorApi.collectionsByDefinitionIdFollow(definitionId), {});
  }

  unfollowDefinition(definitionId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.collectionsByDefinitionIdFollow(definitionId));
  }

  getPublicCollection(shareSlug: string): Observable<PublicCollectionResponse> {
    return this.http.get<PublicCollectionResponse>(CuratorApi.publicCollectionsByShareSlug(shareSlug));
  }

  runDefinition(
    definitionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Observable<CollectionRunResponse> {
    let params = new HttpParams();
    if (options.limit !== undefined) {
      params = params.set(CuratorQueryParams.limit, options.limit);
    }
    if (options.offset !== undefined) {
      params = params.set(CuratorQueryParams.offset, options.offset);
    }
    return this.http.post<CollectionRunResponse>(CuratorApi.collectionsByDefinitionIdRuns(definitionId), {}, { params });
  }

  createConsole(body: ConsoleRequest): Observable<ConsoleResponse> {
    return this.http.post<ConsoleResponse>(CuratorApi.consoles, body);
  }

  listConsoles(): Observable<ConsoleResponse[]> {
    return this.http.get<ConsoleResponse[]>(CuratorApi.consoles);
  }

  getConsole(consoleId: string): Observable<ConsoleResponse> {
    return this.http.get<ConsoleResponse>(CuratorApi.consolesByConsoleId(consoleId));
  }

  updateConsole(consoleId: string, body: ConsoleUpdateRequest): Observable<ConsoleResponse> {
    return this.http.patch<ConsoleResponse>(CuratorApi.consolesByConsoleId(consoleId), body);
  }

  deleteConsole(consoleId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.consolesByConsoleId(consoleId));
  }

  getConsoleInstalls(consoleId: string): Observable<ConsoleInstallsResponse> {
    return this.http.get<ConsoleInstallsResponse>(CuratorApi.consolesByConsoleIdInstalls(consoleId));
  }

  setConsoleInstall(consoleId: string, gameId: string, installed: boolean): Observable<ConsoleInstallResponse> {
    return this.http.put<ConsoleInstallResponse>(CuratorApi.consolesByConsoleIdInstallsByGameId(consoleId, gameId), {
      installed,
    });
  }

  createStorageDevice(body: StorageDeviceRequest): Observable<StorageDeviceResponse> {
    return this.http.post<StorageDeviceResponse>(CuratorApi.storageDevices, body);
  }

  listStorageDevices(): Observable<StorageDeviceResponse[]> {
    return this.http.get<StorageDeviceResponse[]>(CuratorApi.storageDevices);
  }

  getStorageDevice(deviceId: string): Observable<StorageDeviceResponse> {
    return this.http.get<StorageDeviceResponse>(CuratorApi.storageDevicesByDeviceId(deviceId));
  }

  updateStorageDevice(deviceId: string, body: StorageDeviceUpdateRequest): Observable<StorageDeviceResponse> {
    return this.http.patch<StorageDeviceResponse>(CuratorApi.storageDevicesByDeviceId(deviceId), body);
  }

  deleteStorageDevice(deviceId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.storageDevicesByDeviceId(deviceId));
  }

  attachStorageDevice(deviceId: string, consoleId: string): Observable<StorageDeviceResponse> {
    return this.http.put<StorageDeviceResponse>(CuratorApi.storageDevicesByDeviceIdAttachByConsoleId(deviceId, consoleId), {});
  }

  detachStorageDevice(deviceId: string): Observable<StorageDeviceResponse> {
    return this.http.delete<StorageDeviceResponse>(CuratorApi.storageDevicesByDeviceIdAttach(deviceId));
  }

  getStorageDeviceInstalls(deviceId: string): Observable<StorageDeviceInstallsResponse> {
    return this.http.get<StorageDeviceInstallsResponse>(CuratorApi.storageDevicesByDeviceIdInstalls(deviceId));
  }

  setStorageDeviceInstall(
    deviceId: string,
    gameId: string,
    installed: boolean,
  ): Observable<StorageDeviceInstallResponse> {
    return this.http.put<StorageDeviceInstallResponse>(
      CuratorApi.storageDevicesByDeviceIdInstallsByGameId(deviceId, gameId),
      { installed },
    );
  }

  getMeasuredSizes(gameId: string): Observable<MeasuredSizeResponse[]> {
    return this.http.get<MeasuredSizeResponse[]>(CuratorApi.gamesByGameIdMeasuredSizes(gameId));
  }

  setMeasuredSize(gameId: string, platform: string, sizeGb: number): Observable<MeasuredSizeResponse> {
    return this.http.put<MeasuredSizeResponse>(CuratorApi.gamesByGameIdMeasuredSizesByPlatform(gameId, platform), {
      size_gb: sizeGb,
    });
  }

  refreshLibrary(): Observable<LibraryRefreshResponse> {
    return this.http.post<LibraryRefreshResponse>(CuratorApi.libraryRefresh, {});
  }

  getLibraryRefreshStatus(runId: string): Observable<LibraryRefreshStatusResponse> {
    return this.http.get<LibraryRefreshStatusResponse>(CuratorApi.libraryRefreshByRunId(runId));
  }

  getLibrary(query: LibraryQuery = {}): Observable<LibraryPageResponse> {
    return this.http.get<LibraryPageResponse>(CuratorApi.library, { params: libraryQueryParams(query) });
  }

  manualAddCandidates(q: string, includeStore: boolean, limit: number): Observable<ManualCandidatesResponse> {
    let params = new HttpParams().set(CuratorQueryParams.q, q).set(CuratorQueryParams.limit, limit);
    if (includeStore) {
      params = params.set(CuratorQueryParams.includeStore, true);
    }
    return this.http.get<ManualCandidatesResponse>(CuratorApi.libraryManualCandidates, { params });
  }

  addManualGame(body: ManualGameRequest): Observable<void> {
    return this.http.post<void>(CuratorApi.libraryManual, body);
  }

  removeManualGame(gameId: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.libraryManualByGameId(gameId));
  }

  getLibraryGenres(): Observable<LibraryGenresResponse> {
    return this.http.get<LibraryGenresResponse>(CuratorApi.libraryGenres);
  }

  getEnrichmentKeyStatus(): Observable<EnrichmentKeyStatusResponse> {
    return this.http.get<EnrichmentKeyStatusResponse>(CuratorApi.meEnrichmentKeys);
  }

  setRawgKey(apiKey: string): Observable<void> {
    return this.http.put<void>(CuratorApi.meEnrichmentKeysRawg, { api_key: apiKey });
  }

  deleteRawgKey(): Observable<void> {
    return this.http.delete<void>(CuratorApi.meEnrichmentKeysRawg);
  }

  setOpenCriticKey(apiKey: string): Observable<void> {
    return this.http.put<void>(CuratorApi.meEnrichmentKeysOpencritic, { api_key: apiKey });
  }

  deleteOpenCriticKey(): Observable<void> {
    return this.http.delete<void>(CuratorApi.meEnrichmentKeysOpencritic);
  }

  getPsnPreferences(): Observable<PsnPreferencesResponse> {
    return this.http.get<PsnPreferencesResponse>(CuratorApi.mePsnPreferences);
  }

  setPsnPreferences(body: PsnPreferencesRequest): Observable<void> {
    return this.http.put<void>(CuratorApi.mePsnPreferences, body);
  }

  getTrophySummary(): Observable<TrophySummaryResponse> {
    return this.http.get<TrophySummaryResponse>(CuratorApi.trophiesSummary);
  }

  getIdentity(): Observable<IdentityResponse> {
    return this.http.get<IdentityResponse>(CuratorApi.identity);
  }

  getPresence(): Observable<PresenceResponse> {
    return this.http.get<PresenceResponse>(CuratorApi.presence);
  }

  getDevices(): Observable<DevicesResponse> {
    return this.http.get<DevicesResponse>(CuratorApi.devices);
  }

  getMyActions(): Observable<AccountActionsResponse> {
    return this.http.get<AccountActionsResponse>(CuratorApi.meActions);
  }

  getProfileSettings(): Observable<ProfileSettingsResponse> {
    return this.http.get<ProfileSettingsResponse>(CuratorApi.meProfileSettings);
  }

  setProfileSettings(body: ProfileSettingsRequest): Observable<ProfileSettingsResponse> {
    return this.http.put<ProfileSettingsResponse>(CuratorApi.meProfileSettings, body);
  }

  getRefreshSchedule(): Observable<RefreshScheduleResponse> {
    return this.http.get<RefreshScheduleResponse>(CuratorApi.meRefreshSchedule);
  }

  setRefreshSchedule(body: RefreshScheduleRequest): Observable<RefreshScheduleResponse> {
    return this.http.put<RefreshScheduleResponse>(CuratorApi.meRefreshSchedule, body);
  }

  deleteRefreshSchedule(): Observable<void> {
    return this.http.delete<void>(CuratorApi.meRefreshSchedule);
  }

  listProfileLinkSites(): Observable<ProfileLinkSiteResponse[]> {
    return this.http.get<ProfileLinkSiteResponse[]>(CuratorApi.meProfileLinkSites);
  }

  getProfileLinks(): Observable<ProfileLinkResponse[]> {
    return this.http.get<ProfileLinkResponse[]>(CuratorApi.meProfileLinks);
  }

  setProfileLink(siteKey: string, handle: string): Observable<ProfileLinkResponse> {
    return this.http.put<ProfileLinkResponse>(CuratorApi.meProfileLinksBySiteKey(siteKey), { handle });
  }

  deleteProfileLink(siteKey: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.meProfileLinksBySiteKey(siteKey));
  }

  getUserProfile(sub: string): Observable<PublicProfileResponse> {
    return this.http.get<PublicProfileResponse>(CuratorApi.usersBySubProfile(sub));
  }

  followUser(sub: string): Observable<void> {
    return this.http.post<void>(CuratorApi.usersBySubFollow(sub), {});
  }

  unfollowUser(sub: string): Observable<void> {
    return this.http.delete<void>(CuratorApi.usersBySubFollow(sub));
  }

  getFollowers(sub: string, limit = environment.followListPageSize, offset = 0): Observable<FollowListResponse> {
    const params = new HttpParams().set(CuratorQueryParams.limit, limit).set(CuratorQueryParams.offset, offset);
    return this.http.get<FollowListResponse>(CuratorApi.usersBySubFollowers(sub), { params });
  }

  getFollowing(sub: string, limit = environment.followListPageSize, offset = 0): Observable<FollowListResponse> {
    const params = new HttpParams().set(CuratorQueryParams.limit, limit).set(CuratorQueryParams.offset, offset);
    return this.http.get<FollowListResponse>(CuratorApi.usersBySubFollowing(sub), { params });
  }

  getUserLibrary(sub: string, query: LibraryQuery = {}): Observable<ProfileLibraryPageResponse> {
    return this.http.get<ProfileLibraryPageResponse>(CuratorApi.usersBySubLibrary(sub), {
      params: libraryQueryParams(query),
    });
  }

  getUserLibraryGenres(sub: string): Observable<LibraryGenresResponse> {
    return this.http.get<LibraryGenresResponse>(CuratorApi.usersBySubLibraryGenres(sub));
  }

  getUserCollections(sub: string): Observable<ProfileDefinitionResponse[]> {
    return this.http.get<ProfileDefinitionResponse[]>(CuratorApi.usersBySubCollections(sub));
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(CuratorApi.me);
  }

  startEnrichmentRun(): Observable<EnrichmentRunResponse> {
    return this.http.post<EnrichmentRunResponse>(CuratorApi.enrichmentRuns, {});
  }

  getLatestEnrichmentRun(): Observable<EnrichmentRunStatusResponse> {
    return this.http.get<EnrichmentRunStatusResponse>(CuratorApi.enrichmentRunsLatest);
  }

  getEnrichmentRunStatus(runId: string): Observable<EnrichmentRunStatusResponse> {
    return this.http.get<EnrichmentRunStatusResponse>(CuratorApi.enrichmentRunsByRunId(runId));
  }
}
