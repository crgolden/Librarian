import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CuratorService } from './curator.service';
import { CuratorApi, CuratorQueryParams } from './curator-api';
import {
  CollectionKinds,
  CollectionVisibilities,
  ConsolePlatforms,
  JobStatuses,
  LibrarySortFields,
  RefreshCadences,
  SortDirections,
  StorageKinds,
} from './curator.models';
import { HttpMethods } from '../bff/http-headers';
import { environment } from '../environments/environment';
import { newCount, newDisplayName, newId, newText, newUtcInstant } from '@crgolden/modules/testing';

describe('CuratorService', () => {
  let service: CuratorService;
  let httpMock: HttpTestingController;
  const definitionId = newId();
  const runId = newId();
  const consoleId = newId();
  const gameId = newId();
  const deviceId = newId();
  const shareSlug = newText();
  const otherSub = newId();
  const searchTerm = newText();
  const genre = newText();
  const collectionName = newText();
  const apiKey = newText();
  const limit = newCount();
  const offset = newCount();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(CuratorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listCatalogGames sends only the provided filters as query params', () => {
    service.listCatalogGames({ franchise: searchTerm, limit }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === CuratorApi.catalogGames,
    );
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.get(CuratorQueryParams.franchise)).toBe(searchTerm);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(limit));
    expect(req.request.params.has(CuratorQueryParams.genre)).toBe(false);
    expect(req.request.params.has(CuratorQueryParams.aaaTier)).toBe(false);
    req.flush({ games: [] });
  });

  it('listCatalogGames sends no params when no filters given', () => {
    service.listCatalogGames({}).subscribe();

    const req = httpMock.expectOne(CuratorApi.catalogGames);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ games: [] });
  });

  it('getCatalogGenres reads the genre vocabulary without any query params', () => {
    service.getCatalogGenres().subscribe();

    const req = httpMock.expectOne(CuratorApi.catalogGenres);
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ genres: [] });
  });

  it('previewCollection posts the spec', () => {
    const spec = { kind: CollectionKinds.filterList, genre_filter: [genre] };
    service.previewCollection(spec).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsPreview);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(spec);
    req.flush({ included: [], excluded: [], used_gb: null });
  });

  it('saveDefinition posts the named spec', () => {
    const body = { name: collectionName, kind: CollectionKinds.filterList, genre_filter: [] };
    service.saveDefinition(body).subscribe();

    const req = httpMock.expectOne(CuratorApi.collections);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(body);
    req.flush({
      definition_id: definitionId,
      name: collectionName,
      kind: CollectionKinds.filterList,
      console_id: null,
      genre_filter: [],
      min_score: null,
      aaa_tier_filter: null,
    });
  });

  it('listDefinitions gets the saved definitions', () => {
    service.listDefinitions().subscribe();

    const req = httpMock.expectOne(CuratorApi.collections);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush([]);
  });

  it('runDefinition posts to the definition-scoped runs endpoint', () => {
    service.runDefinition(definitionId).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionIdRuns(definitionId));
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush({ run_id: runId, included: [], excluded: [], used_gb: null });
  });

  it('setConsoleInstall puts the installed flag', () => {
    service.setConsoleInstall(consoleId, gameId, true).subscribe();

    const req = httpMock.expectOne(CuratorApi.consolesByConsoleIdInstallsByGameId(consoleId, gameId));
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ installed: true });
    req.flush({ console_id: consoleId, game_id: gameId, installed: true });
  });

  it('refreshLibrary posts with no body', () => {
    service.refreshLibrary().subscribe();

    const req = httpMock.expectOne(CuratorApi.libraryRefresh);
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush({ run_id: runId });
  });

  it('getLibraryRefreshStatus gets the run-scoped status', () => {
    service.getLibraryRefreshStatus(runId).subscribe();

    const req = httpMock.expectOne(CuratorApi.libraryRefreshByRunId(runId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ run_id: runId, status: JobStatuses.queued, error: null, result_summary: null });
  });

  it('getLibrary sends no params by default', () => {
    service.getLibrary().subscribe();

    const req = httpMock.expectOne(CuratorApi.library);
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ games: [], total: 0 });
  });

  it('getLibrary sends only the provided query params', () => {
    service.getLibrary({ q: searchTerm, genre, sort: LibrarySortFields.psnRating, sortDir: SortDirections.desc, limit, offset }).subscribe();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.library);
    expect(req.request.params.get(CuratorQueryParams.q)).toBe(searchTerm);
    expect(req.request.params.get(CuratorQueryParams.genre)).toBe(genre);
    expect(req.request.params.get(CuratorQueryParams.sort)).toBe(LibrarySortFields.psnRating);
    expect(req.request.params.get(CuratorQueryParams.sortDir)).toBe(SortDirections.desc);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(limit));
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String(offset));
    req.flush({ games: [], total: 0 });
  });

  it('getLibraryGenres gets the caller\'s own genre list', () => {
    service.getLibraryGenres().subscribe();

    const req = httpMock.expectOne(CuratorApi.libraryGenres);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ genres: [] });
  });

  it('getEnrichmentKeyStatus gets the key status', () => {
    service.getEnrichmentKeyStatus().subscribe();

    const req = httpMock.expectOne(CuratorApi.meEnrichmentKeys);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ rawg_configured: false, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
  });

  it('getPsnPreferences gets the caller\'s own harvest preferences', () => {
    service.getPsnPreferences().subscribe();

    const req = httpMock.expectOne(CuratorApi.mePsnPreferences);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
  });

  it('getTrophySummary gets the trophy summary', () => {
    service.getTrophySummary().subscribe();

    const req = httpMock.expectOne(CuratorApi.trophiesSummary);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({
      level: 1,
      progress: 0,
      tier: 1,
      earned: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      account_id: null,
    });
  });

  it('getIdentity gets the PSN identity', () => {
    service.getIdentity().subscribe();

    const req = httpMock.expectOne(CuratorApi.identity);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ account_id: newId(), online_id: newText(), region: null });
  });

  it('getFriendRequests gets the requests waiting on the caller', () => {
    service.getFriendRequests().subscribe();

    const req = httpMock.expectOne(CuratorApi.meFriendRequests);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ requests: [] });
  });

  it('getPresence gets the online presence', () => {
    service.getPresence().subscribe();

    const req = httpMock.expectOne(CuratorApi.presence);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ online_status: newText(), platform: null, last_online_date: null, game_title: null });
  });

  it('getDevices gets the registered devices', () => {
    service.getDevices().subscribe();

    const req = httpMock.expectOne(CuratorApi.devices);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ devices: [] });
  });

  it('setRawgKey puts the api_key body', () => {
    service.setRawgKey(apiKey).subscribe();

    const req = httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ api_key: apiKey });
    req.flush(null);
  });

  it('deleteRawgKey deletes the rawg key', () => {
    service.deleteRawgKey().subscribe();

    const req = httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg);
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('setOpenCriticKey puts the api_key body', () => {
    service.setOpenCriticKey(apiKey).subscribe();

    const req = httpMock.expectOne(CuratorApi.meEnrichmentKeysOpencritic);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ api_key: apiKey });
    req.flush(null);
  });

  it('deleteOpenCriticKey deletes the opencritic key', () => {
    service.deleteOpenCriticKey().subscribe();

    const req = httpMock.expectOne(CuratorApi.meEnrichmentKeysOpencritic);
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getRefreshSchedule gets the caller\'s own recurring-refresh schedule', () => {
    service.getRefreshSchedule().subscribe();

    const req = httpMock.expectOne(CuratorApi.meRefreshSchedule);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({
      cadence: RefreshCadences.weekly,
      ps_plus_watch: false,
      next_run_at: newUtcInstant(),
      last_run_at: null,
      consecutive_failures: 0,
      paused_reason: null,
    });
  });

  it('setRefreshSchedule puts the cadence and the PS Plus watch flag', () => {
    const body = { cadence: RefreshCadences.monthly, ps_plus_watch: true };
    service.setRefreshSchedule(body).subscribe();

    const req = httpMock.expectOne(CuratorApi.meRefreshSchedule);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual(body);
    req.flush({
      ...body,
      next_run_at: newUtcInstant(),
      last_run_at: null,
      consecutive_failures: 0,
      paused_reason: null,
    });
  });

  it('deleteRefreshSchedule withdraws the opt-in', () => {
    service.deleteRefreshSchedule().subscribe();

    const req = httpMock.expectOne(CuratorApi.meRefreshSchedule);
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getProfileSettings gets the caller\'s own profile settings', () => {
    service.getProfileSettings().subscribe();

    const req = httpMock.expectOne(CuratorApi.meProfileSettings);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({
      is_public: false,
      show_library: false,
      show_collections: false,
      show_trophies: false,
      show_identity: false,
    });
  });

  it('setProfileSettings puts the full settings body', () => {
    const body = {
      is_public: true,
      show_library: true,
      show_collections: false,
      show_trophies: true,
      show_identity: false,
    };
    service.setProfileSettings(body).subscribe();

    const req = httpMock.expectOne(CuratorApi.meProfileSettings);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual(body);
    req.flush(body);
  });

  it('getUserProfile gets the sub-scoped profile', () => {
    service.getUserProfile(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubProfile(otherSub));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({
      sub: otherSub,
      psn_account_id: null,
      is_public: false,
      viewer_is_owner: false,
      viewer_is_following: false,
      follower_count: 0,
      following_count: 0,
      library_visible: false,
      collections_visible: false,
      trophies: null,
      identity: null,
    });
  });

  it('followUser posts to the sub-scoped follow endpoint with no body', () => {
    service.followUser(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubFollow(otherSub));
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush(null);
  });

  it('unfollowUser deletes the sub-scoped follow endpoint', () => {
    service.unfollowUser(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubFollow(otherSub));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getFollowers sends limit/offset params, defaulting to 50/0', () => {
    service.getFollowers(otherSub).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === CuratorApi.usersBySubFollowers(otherSub),
    );
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(environment.followListPageSize));
    expect(Number(req.request.params.get(CuratorQueryParams.offset))).toBe(0);
    req.flush({ entries: [], total: 0 });
  });

  it('getFollowers forwards explicit limit/offset params', () => {
    service.getFollowers(otherSub, limit, offset).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === CuratorApi.usersBySubFollowers(otherSub),
    );
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(limit));
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String(offset));
    req.flush({ entries: [], total: 0 });
  });

  it('getFollowing sends limit/offset params, defaulting to 50/0', () => {
    service.getFollowing(otherSub).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === CuratorApi.usersBySubFollowing(otherSub),
    );
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(environment.followListPageSize));
    expect(Number(req.request.params.get(CuratorQueryParams.offset))).toBe(0);
    req.flush({ entries: [], total: 0 });
  });

  it('getUserLibrary gets the sub-scoped read-only library, with no params by default', () => {
    service.getUserLibrary(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubLibrary(otherSub));
    expect(req.request.method).toBe(HttpMethods.get);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ games: [], total: 0 });
  });

  it('getUserLibrary forwards the provided query params', () => {
    service.getUserLibrary(otherSub, { q: searchTerm, limit }).subscribe();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.usersBySubLibrary(otherSub));
    expect(req.request.params.get(CuratorQueryParams.q)).toBe(searchTerm);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(limit));
    req.flush({ games: [], total: 0 });
  });

  it('getUserLibraryGenres gets the sub-scoped genre list', () => {
    service.getUserLibraryGenres(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubLibraryGenres(otherSub));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ genres: [] });
  });

  it('getUserCollections gets the sub-scoped read-only collections', () => {
    service.getUserCollections(otherSub).subscribe();

    const req = httpMock.expectOne(CuratorApi.usersBySubCollections(otherSub));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush([]);
  });

  it('listFollowedCollections gets the followed list', () => {
    service.listFollowedCollections().subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsFollowed);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush([]);
  });

  it('getDefinition gets the definition-scoped detail (with items)', () => {
    service.getDefinition(definitionId).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionId(definitionId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(null);
  });

  it('updateDefinition patches the definition', () => {
    const body = { name: newText() };
    service.updateDefinition(definitionId, body).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionId(definitionId));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('deleteDefinition deletes the definition', () => {
    service.deleteDefinition(definitionId).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionId(definitionId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('setDefinitionVisibility puts the visibility body', () => {
    service.setDefinitionVisibility(definitionId, CollectionVisibilities.public).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionIdVisibility(definitionId));
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ visibility: CollectionVisibilities.public });
    req.flush(null);
  });

  it('followDefinition posts to the follow endpoint with no body', () => {
    service.followDefinition(definitionId).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionIdFollow(definitionId));
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush(null);
  });

  it('unfollowDefinition deletes the follow endpoint', () => {
    service.unfollowDefinition(definitionId).subscribe();

    const req = httpMock.expectOne(CuratorApi.collectionsByDefinitionIdFollow(definitionId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getPublicCollection gets the anonymous share-slug route', () => {
    service.getPublicCollection(shareSlug).subscribe();

    const req = httpMock.expectOne(CuratorApi.publicCollectionsByShareSlug(shareSlug));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(null);
  });

  it('createConsole posts the console body', () => {
    const body = { name: newDisplayName(), platform: ConsolePlatforms.ps5 };
    service.createConsole(body).subscribe();

    const req = httpMock.expectOne(CuratorApi.consoles);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('listConsoles gets the caller\'s consoles', () => {
    service.listConsoles().subscribe();

    const req = httpMock.expectOne(CuratorApi.consoles);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush([]);
  });

  it('getConsole gets one console', () => {
    service.getConsole(consoleId).subscribe();

    const req = httpMock.expectOne(CuratorApi.consolesByConsoleId(consoleId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(null);
  });

  it('updateConsole patches the console', () => {
    const body = { name: newDisplayName() };
    service.updateConsole(consoleId, body).subscribe();

    const req = httpMock.expectOne(CuratorApi.consolesByConsoleId(consoleId));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('deleteConsole deletes the console', () => {
    service.deleteConsole(consoleId).subscribe();

    const req = httpMock.expectOne(CuratorApi.consolesByConsoleId(consoleId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getConsoleInstalls gets the console-scoped install worklist', () => {
    service.getConsoleInstalls(consoleId).subscribe();

    const req = httpMock.expectOne(CuratorApi.consolesByConsoleIdInstalls(consoleId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ game_ids: [] });
  });

  it('createStorageDevice posts the device body', () => {
    const body = { name: newDisplayName(), kind: StorageKinds.m2, capacity_gb: newCount() };
    service.createStorageDevice(body).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevices);
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('listStorageDevices gets the caller\'s devices', () => {
    service.listStorageDevices().subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevices);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush([]);
  });

  it('getStorageDevice gets one device', () => {
    service.getStorageDevice(deviceId).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceId(deviceId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(null);
  });

  it('updateStorageDevice patches the device', () => {
    const body = { name: newDisplayName() };
    service.updateStorageDevice(deviceId, body).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceId(deviceId));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('deleteStorageDevice deletes the device', () => {
    service.deleteStorageDevice(deviceId).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceId(deviceId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('attachStorageDevice puts to the device/console attach route with no body', () => {
    service.attachStorageDevice(deviceId, consoleId).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceIdAttachByConsoleId(deviceId, consoleId));
    expect(req.request.method).toBe(HttpMethods.put);
    req.flush(null);
  });

  it('detachStorageDevice deletes the device attach route', () => {
    service.detachStorageDevice(deviceId).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceIdAttach(deviceId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null);
  });

  it('getStorageDeviceInstalls gets the device-scoped install worklist', () => {
    service.getStorageDeviceInstalls(deviceId).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceIdInstalls(deviceId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ game_ids: [] });
  });

  it('setStorageDeviceInstall puts the installed flag', () => {
    service.setStorageDeviceInstall(deviceId, gameId, true).subscribe();

    const req = httpMock.expectOne(CuratorApi.storageDevicesByDeviceIdInstallsByGameId(deviceId, gameId));
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ installed: true });
    req.flush({ device_id: deviceId, game_id: gameId, installed: true });
  });
});
