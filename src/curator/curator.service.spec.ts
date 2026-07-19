import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CuratorService } from './curator.service';

describe('CuratorService', () => {
  let service: CuratorService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

  it('getLibrary gets the caller\'s own library', () => {
    service.getLibrary().subscribe();

    const req = httpMock.expectOne('/curator/api/library');
    expect(req.request.method).toBe('GET');
    req.flush([]);
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
});
