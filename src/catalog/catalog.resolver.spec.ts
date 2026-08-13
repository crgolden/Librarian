import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { CATALOG_PAGE_SIZE, catalogGenresResolver, catalogResolver } from './catalog.resolver';
import { CatalogGamesResponse } from '../curator/curator.models';

function resolve(): Observable<CatalogGamesResponse | null> {
  return TestBed.runInInjectionContext(
    () => catalogResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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

  it('requests only the first page', () => {
    let resolved: CatalogGamesResponse | null | undefined;
    resolve().subscribe((value) => (resolved = value));

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('limit')).toBe(String(CATALOG_PAGE_SIZE));
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ games: [], total: 0 });

    expect(resolved).toEqual({ games: [], total: 0 });
  });

  it('resolves to null rather than failing the navigation when the request errors', () => {
    let resolved: CatalogGamesResponse | null | undefined;
    resolve().subscribe((value) => (resolved = value));

    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/games')
      .flush(null, { status: 500, statusText: 'Error' });

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

    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/genres')
      .flush({ genres: ['Shooter', 'RPG'] });

    expect(resolved).toEqual(['Shooter', 'RPG']);
  });

  it('resolves to an empty list rather than taking the catalog page down with it', () => {
    let resolved: string[] | undefined;
    resolveGenres().subscribe((value) => (resolved = value));

    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/genres')
      .flush(null, { status: 500, statusText: 'Error' });

    expect(resolved).toEqual([]);
  });
});
