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
  IdentityResponse,
  LibraryRefreshResponse,
  LibraryRefreshStatusResponse,
  PresenceResponse,
  PsnPreferencesRequest,
  PsnPreferencesResponse,
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
}
