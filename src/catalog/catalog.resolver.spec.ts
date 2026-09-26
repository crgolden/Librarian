import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { CATALOG_PAGE_SIZE, catalogGenresResolver, catalogResolver } from './catalog.resolver';
import { CATALOG_PAGE_SIZE_CEILING, CatalogQueryParams } from './catalog.query';
import { CatalogGamesResponse, CatalogSortFields, ContentKinds, SortDirections } from '../curator/curator.models';
import { CuratorApi, CuratorQueryParams } from '../curator/curator-api';
import { newCount, newText, randomIntBetween } from '@crgolden/modules/testing';

function resolve(queryParams: Record<string, string | number> = {}): Observable<CatalogGamesResponse | null> {
  return TestBed.runInInjectionContext(
    () => catalogResolver({ queryParams } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Observable<CatalogGamesResponse | null>;
}

function resolveGenres(): Observable<string[]> {
  return TestBed.runInInjectionContext(
    () => catalogGenresResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Observable<string[]>;
}

describe('catalogResolver', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the first page when the URL names none', () => {
    let resolved: CatalogGamesResponse | null | undefined;
    resolve().subscribe((value) => (resolved = value));

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(CATALOG_PAGE_SIZE));
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe('0');
    const answered: CatalogGamesResponse = { games: [], total: 0, excluded_owned: 0 };
    req.flush(answered);

    expect(resolved).toEqual(answered);
  });

  it('server-renders the page the URL asks for, so a shared deep link is not page one', () => {
    const page = randomIntBetween(2, CATALOG_PAGE_SIZE_CEILING);
    const pageSize = randomIntBetween(1, CATALOG_PAGE_SIZE_CEILING + 1);
    const search = newText();
    resolve({
      [CatalogQueryParams.page]: page,
      [CatalogQueryParams.pageSize]: pageSize,
      [CatalogQueryParams.kind]: ContentKinds.mediaApp,
      [CatalogQueryParams.sort]: CatalogSortFields.price,
      [CatalogQueryParams.sortDir]: SortDirections.desc,
      [CatalogQueryParams.q]: search,
    }).subscribe();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(pageSize));
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String((page - 1) * pageSize));
    expect(req.request.params.get(CuratorQueryParams.kind)).toBe(ContentKinds.mediaApp);
    expect(req.request.params.get(CuratorQueryParams.sort)).toBe(CatalogSortFields.price);
    expect(req.request.params.get(CuratorQueryParams.sortDir)).toBe(SortDirections.desc);
    expect(req.request.params.get(CuratorQueryParams.q)).toBe(search);
    req.flush({ games: [], total: 0 });
  });

  it('ignores a page size above the ceiling rather than sending Curator a 422', () => {
    resolve({ [CatalogQueryParams.pageSize]: CATALOG_PAGE_SIZE_CEILING + newCount() }).subscribe();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.limit)).toBe(String(CATALOG_PAGE_SIZE_CEILING));
    req.flush({ games: [], total: 0 });
  });

  it('ignores a page that is not a positive whole number', () => {
    resolve({ [CatalogQueryParams.page]: -newCount() }).subscribe();

    const req = httpMock.expectOne((r) => r.url === CuratorApi.catalogGames);
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('resolves to null rather than failing the navigation when the request errors', () => {
    let resolved: CatalogGamesResponse | null | undefined;
    resolve().subscribe((value) => (resolved = value));

    httpMock
      .expectOne((r) => r.url === CuratorApi.catalogGames)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(resolved).toBeNull();
  });
});

describe('catalogGenresResolver', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('unwraps the response to the bare list of genre names', () => {
    let resolved: string[] | undefined;
    resolveGenres().subscribe((value) => (resolved = value));

    const genres = [newText(), newText()];
    httpMock
      .expectOne((r) => r.url === CuratorApi.catalogGenres)
      .flush({ genres });

    expect(resolved).toEqual(genres);
  });

  it('resolves to an empty list rather than taking the catalog page down with it', () => {
    let resolved: string[] | undefined;
    resolveGenres().subscribe((value) => (resolved = value));

    httpMock
      .expectOne((r) => r.url === CuratorApi.catalogGenres)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(resolved).toEqual([]);
  });
});
