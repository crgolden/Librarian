import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CuratorService } from './curator.service';

describe('CuratorService', () => {
  let service: CuratorService;
  let httpMock: HttpTestingController;

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
    service.listCatalogGames({ franchise: 'Uncharted', limit: 25 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/curator/api/catalog/games',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('franchise')).toBe('Uncharted');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('genre')).toBe(false);
    expect(req.request.params.has('aaaTier')).toBe(false);
    req.flush({ games: [] });
  });

  it('listCatalogGames sends no params when no filters given', () => {
    service.listCatalogGames({}).subscribe();

    const req = httpMock.expectOne('/curator/api/catalog/games');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ games: [] });
  });

  it('previewCollection posts the spec', () => {
    const spec = { kind: 'filter_list', genre_filter: ['RPG'] };
    service.previewCollection(spec).subscribe();

    const req = httpMock.expectOne('/curator/api/collections/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(spec);
    req.flush({ included: [], excluded: [], used_gb: null });
  });

  it('saveDefinition posts the named spec', () => {
    const body = { name: 'Weekend picks', kind: 'filter_list', genre_filter: [] };
    service.saveDefinition(body).subscribe();

    const req = httpMock.expectOne('/curator/api/collections');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({
      definition_id: 'd1',
      name: 'Weekend picks',
      kind: 'filter_list',
      console_id: null,
      genre_filter: [],
      min_score: null,
      aaa_tier_filter: null,
    });
  });

  it('listDefinitions gets the saved definitions', () => {
    service.listDefinitions().subscribe();

    const req = httpMock.expectOne('/curator/api/collections');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('runDefinition posts to the definition-scoped runs endpoint', () => {
    service.runDefinition('d1').subscribe();

    const req = httpMock.expectOne('/curator/api/collections/d1/runs');
    expect(req.request.method).toBe('POST');
    req.flush({ run_id: 'r1', included: [], excluded: [], used_gb: null });
  });

  it('setConsoleInstall puts the installed flag', () => {
    service.setConsoleInstall('c1', 'g1', true).subscribe();

    const req = httpMock.expectOne('/curator/api/consoles/c1/installs/g1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ installed: true });
    req.flush({ console_id: 'c1', game_id: 'g1', installed: true });
  });

  it('refreshLibrary posts with no body', () => {
    service.refreshLibrary().subscribe();

    const req = httpMock.expectOne('/curator/api/library/refresh');
    expect(req.request.method).toBe('POST');
    req.flush({ run_id: 'r1' });
  });

  it('getLibraryRefreshStatus gets the run-scoped status', () => {
    service.getLibraryRefreshStatus('r1').subscribe();

    const req = httpMock.expectOne('/curator/api/library/refresh/r1');
    expect(req.request.method).toBe('GET');
    req.flush({ run_id: 'r1', status: 'queued', error: null, result_summary: null });
  });

  it('getLibrary sends no params by default', () => {
    service.getLibrary().subscribe();

    const req = httpMock.expectOne('/curator/api/library');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ games: [], total: 0 });
  });

  it('getLibrary sends only the provided query params', () => {
    service.getLibrary({ q: 'ring', category: 'RPG', sort: 'psn_rating', sortDir: 'desc', limit: 10, offset: 20 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/library');
    expect(req.request.params.get('q')).toBe('ring');
    expect(req.request.params.get('category')).toBe('RPG');
    expect(req.request.params.get('sort')).toBe('psn_rating');
    expect(req.request.params.get('sortDir')).toBe('desc');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('20');
    req.flush({ games: [], total: 0 });
  });

  it('getLibraryCategories gets the caller\'s own category list', () => {
    service.getLibraryCategories().subscribe();

    const req = httpMock.expectOne('/curator/api/library/categories');
    expect(req.request.method).toBe('GET');
    req.flush({ categories: [] });
  });

  it('getEnrichmentKeyStatus gets the key status', () => {
    service.getEnrichmentKeyStatus().subscribe();

    const req = httpMock.expectOne('/curator/api/me/enrichment-keys');
    expect(req.request.method).toBe('GET');
    req.flush({ rawg_configured: false, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
  });

  it('setRawgKey puts the api_key body', () => {
    service.setRawgKey('my-key').subscribe();

    const req = httpMock.expectOne('/curator/api/me/enrichment-keys/rawg');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ api_key: 'my-key' });
    req.flush(null);
  });

  it('deleteRawgKey deletes the rawg key', () => {
    service.deleteRawgKey().subscribe();

    const req = httpMock.expectOne('/curator/api/me/enrichment-keys/rawg');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('setOpenCriticKey puts the api_key body', () => {
    service.setOpenCriticKey('my-key').subscribe();

    const req = httpMock.expectOne('/curator/api/me/enrichment-keys/opencritic');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ api_key: 'my-key' });
    req.flush(null);
  });

  it('deleteOpenCriticKey deletes the opencritic key', () => {
    service.deleteOpenCriticKey().subscribe();

    const req = httpMock.expectOne('/curator/api/me/enrichment-keys/opencritic');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ── Social profile / follow ──────────────────────────────────────────────

  it('getProfileSettings gets the caller\'s own profile settings', () => {
    service.getProfileSettings().subscribe();

    const req = httpMock.expectOne('/curator/api/me/profile-settings');
    expect(req.request.method).toBe('GET');
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

    const req = httpMock.expectOne('/curator/api/me/profile-settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush(body);
  });

  it('getUserProfile gets the sub-scoped profile', () => {
    service.getUserProfile('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/profile');
    expect(req.request.method).toBe('GET');
    req.flush({
      sub: 'other-sub',
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
    service.followUser('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('unfollowUser deletes the sub-scoped follow endpoint', () => {
    service.unfollowUser('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/follow');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getFollowers sends limit/offset params, defaulting to 50/0', () => {
    service.getFollowers('other-sub').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/curator/api/users/other-sub/followers',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ entries: [], total: 0 });
  });

  it('getFollowers forwards explicit limit/offset params', () => {
    service.getFollowers('other-sub', 10, 20).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/curator/api/users/other-sub/followers',
    );
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('20');
    req.flush({ entries: [], total: 0 });
  });

  it('getFollowing sends limit/offset params, defaulting to 50/0', () => {
    service.getFollowing('other-sub').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/curator/api/users/other-sub/following',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ entries: [], total: 0 });
  });

  it('getUserLibrary gets the sub-scoped read-only library, with no params by default', () => {
    service.getUserLibrary('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/library');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ games: [], total: 0 });
  });

  it('getUserLibrary forwards the provided query params', () => {
    service.getUserLibrary('other-sub', { q: 'ring', limit: 5 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/users/other-sub/library');
    expect(req.request.params.get('q')).toBe('ring');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ games: [], total: 0 });
  });

  it('getUserLibraryCategories gets the sub-scoped category list', () => {
    service.getUserLibraryCategories('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/library/categories');
    expect(req.request.method).toBe('GET');
    req.flush({ categories: [] });
  });

  it('getUserCollections gets the sub-scoped read-only collections', () => {
    service.getUserCollections('other-sub').subscribe();

    const req = httpMock.expectOne('/curator/api/users/other-sub/collections');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
