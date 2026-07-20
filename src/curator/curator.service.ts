import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccountActionsResponse,
  CatalogGamesResponse,
  CollectionPreviewResponse,
  CollectionRunResponse,
  CollectionSpecRequest,
  ConsoleInstallResponse,
  DefinitionResponse,
  DevicesResponse,
  EnrichmentKeyStatusResponse,
  FollowListResponse,
  IdentityResponse,
  LibraryGameResponse,
  LibraryRefreshResponse,
  LibraryRefreshStatusResponse,
  PresenceResponse,
  ProfileDefinitionResponse,
  ProfileLibraryGameResponse,
  ProfileSettingsRequest,
  ProfileSettingsResponse,
  PsnPreferencesRequest,
  PsnPreferencesResponse,
  PublicProfileResponse,
  SaveDefinitionRequest,
  TrophySummaryResponse,
} from './curator.models';

export interface CatalogGamesQuery {
  franchise?: string;
  genre?: string;
  aaaTier?: string;
  limit?: number;
  offset?: number;
}

/** Thin HTTP wrapper over the Curator catalog/collections/consoles/library endpoints, shared
 * across the catalog/collections/library feature areas since their result DTOs overlap. */
@Injectable({ providedIn: 'root' })
export class CuratorService {
  private readonly http = inject(HttpClient);

  listCatalogGames(query: CatalogGamesQuery): Observable<CatalogGamesResponse> {
    let params = new HttpParams();
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

  previewCollection(spec: CollectionSpecRequest): Observable<CollectionPreviewResponse> {
    return this.http.post<CollectionPreviewResponse>('/curator/api/collections/preview', spec);
  }

  saveDefinition(body: SaveDefinitionRequest): Observable<DefinitionResponse> {
    return this.http.post<DefinitionResponse>('/curator/api/collections', body);
  }

  listDefinitions(): Observable<DefinitionResponse[]> {
    return this.http.get<DefinitionResponse[]>('/curator/api/collections');
  }

  runDefinition(definitionId: string): Observable<CollectionRunResponse> {
    return this.http.post<CollectionRunResponse>(`/curator/api/collections/${definitionId}/runs`, {});
  }

  setConsoleInstall(consoleId: string, gameId: string, installed: boolean): Observable<ConsoleInstallResponse> {
    return this.http.put<ConsoleInstallResponse>(`/curator/api/consoles/${consoleId}/installs/${gameId}`, {
      installed,
    });
  }

  refreshLibrary(): Observable<LibraryRefreshResponse> {
    return this.http.post<LibraryRefreshResponse>('/curator/api/library/refresh', {});
  }

  getLibraryRefreshStatus(runId: string): Observable<LibraryRefreshStatusResponse> {
    return this.http.get<LibraryRefreshStatusResponse>(`/curator/api/library/refresh/${runId}`);
  }

  getLibrary(): Observable<LibraryGameResponse[]> {
    return this.http.get<LibraryGameResponse[]>('/curator/api/library');
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

  getUserLibrary(sub: string): Observable<ProfileLibraryGameResponse[]> {
    return this.http.get<ProfileLibraryGameResponse[]>(`/curator/api/users/${sub}/library`);
  }

  getUserCollections(sub: string): Observable<ProfileDefinitionResponse[]> {
    return this.http.get<ProfileDefinitionResponse[]>(`/curator/api/users/${sub}/collections`);
  }
}
