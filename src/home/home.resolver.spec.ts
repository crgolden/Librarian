import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { homeSummaryResolver, HomeSummary } from './home.resolver';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';
import { DefinitionResponse, MeResponse } from '../curator/curator.models';

function definition(definitionId: string, itemCount: number): DefinitionResponse {
  return {
    definition_id: definitionId,
    name: definitionId,
    description: null,
    kind: 'filter_list',
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    include_inactive: false,
    min_percent_completed: null,
    sort_order: null,
    exclude_installed_on: [],
    visibility: 'private',
    share_slug: null,
    item_count: itemCount,
  };
}

const me: MeResponse = { sub: 'u1', email: 'chris@example.com', linked: true, psn: null, is_admin: false };

function configure(isAuthenticated: boolean): HttpTestingController {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: signal(isAuthenticated) } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

function resolve(): Observable<HomeSummary | null> {
  return TestBed.runInInjectionContext(() =>
    homeSummaryResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Observable<HomeSummary | null>;
}

describe('homeSummaryResolver', () => {
  it('resolves to null for an anonymous visitor without issuing a single request', async () => {
    const httpMock = configure(false);

    const result = await firstValueFrom(resolve());

    expect(result).toBeNull();
    httpMock.verify();
  });

  it('reports the library total, the collection count, and the entries across those collections', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === '/curator/api/library').flush({ games: [], total: 412 });
    httpMock
      .expectOne('/curator/api/collections')
      .flush([definition('d1', 40), definition('d2', 23)]);
    httpMock.expectOne('/curator/api/me').flush(me);

    expect(await resultPromise).toEqual({
      libraryTotal: 412,
      collectionCount: 2,
      collectionEntries: 63,
      linked: true,
    });
    httpMock.verify();
  });

  it('counts memberships, so a title in two collections can push entries past the library total', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === '/curator/api/library').flush({ games: [], total: 2 });
    httpMock
      .expectOne('/curator/api/collections')
      .flush([definition('d1', 1), definition('d2', 2)]);
    httpMock.expectOne('/curator/api/me').flush(me);

    expect(await resultPromise).toEqual({
      libraryTotal: 2,
      collectionCount: 2,
      collectionEntries: 3,
      linked: true,
    });
    httpMock.verify();
  });

  it('asks the library endpoint for a single row, since only the total is used', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    const request = httpMock.expectOne((candidate) => candidate.url === '/curator/api/library');
    expect(request.request.params.get('limit')).toBe('1');

    request.flush({ games: [], total: 0 });
    httpMock.expectOne('/curator/api/collections').flush([]);
    httpMock.expectOne('/curator/api/me').flush(me);
    await resultPromise;
    httpMock.verify();
  });

  it('degrades to null when a totals call fails, rather than throwing', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock
      .expectOne((request) => request.url === '/curator/api/library')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(await resultPromise).toBeNull();
  });

  it('still reports both totals when only the profile call fails, marking linked unknown', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === '/curator/api/library').flush({ games: [], total: 412 });
    httpMock.expectOne('/curator/api/collections').flush([definition('d1', 63)]);
    httpMock.expectOne('/curator/api/me').flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(await resultPromise).toEqual({
      libraryTotal: 412,
      collectionCount: 1,
      collectionEntries: 63,
      linked: null,
    });
    httpMock.verify();
  });

  it('issues one GET /me for the resolver and the nav together', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === '/curator/api/library').flush({ games: [], total: 0 });
    httpMock.expectOne('/curator/api/collections').flush([]);
    httpMock.expectOne('/curator/api/me').flush(me);
    await resultPromise;

    TestBed.inject(AdminService).ensureLoaded().subscribe();

    httpMock.expectNone('/curator/api/me');
    httpMock.verify();
  });
});
