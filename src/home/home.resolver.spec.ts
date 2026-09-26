import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { homeSummaryResolver, HomeSummary } from './home.resolver';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';
import { CollectionKinds, CollectionVisibilities, DefinitionResponse, MeResponse } from '../curator/curator.models';
import { CuratorApi, CuratorQueryParams } from '../curator/curator-api';
import { newCount, newEmailAddress, newId } from '@crgolden/modules/testing';

const LIBRARY_TOTAL = newCount();
const FIRST_COLLECTION_ITEMS = newCount();
const SECOND_COLLECTION_ITEMS = newCount();

function definition(definitionId: string, itemCount: number): DefinitionResponse {
  return {
    definition_id: definitionId,
    name: definitionId,
    description: null,
    kind: CollectionKinds.filterList,
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    include_inactive: false,
    min_percent_completed: null,
    sort_order: null,
    exclude_installed_on: [],
    install_target_console_id: null,
    visibility: CollectionVisibilities.private,
    share_slug: null,
    item_count: itemCount,
  };
}

const TWO_COLLECTIONS = [definition(newId(), FIRST_COLLECTION_ITEMS), definition(newId(), SECOND_COLLECTION_ITEMS)];

const me: MeResponse = { sub: newId(), email: newEmailAddress(), linked: true, psn: null, is_admin: false };

function configure(isAuthenticated: boolean): HttpTestingController {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: signal(isAuthenticated), session: signal([]) } },
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

    httpMock.expectOne((request) => request.url === CuratorApi.library).flush({ games: [], total: LIBRARY_TOTAL });
    httpMock
      .expectOne(CuratorApi.collections)
      .flush(TWO_COLLECTIONS);
    httpMock.expectOne(CuratorApi.me).flush(me);

    expect(await resultPromise).toEqual({
      libraryTotal: LIBRARY_TOTAL,
      collectionCount: TWO_COLLECTIONS.length,
      collectionEntries: FIRST_COLLECTION_ITEMS + SECOND_COLLECTION_ITEMS,
      linked: true,
    });
    httpMock.verify();
  });

  it('counts memberships, so a title in two collections can push entries past the library total', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === CuratorApi.library).flush({ games: [], total: FIRST_COLLECTION_ITEMS });
    httpMock
      .expectOne(CuratorApi.collections)
      .flush(TWO_COLLECTIONS);
    httpMock.expectOne(CuratorApi.me).flush(me);

    expect(await resultPromise).toEqual({
      libraryTotal: FIRST_COLLECTION_ITEMS,
      collectionCount: TWO_COLLECTIONS.length,
      collectionEntries: FIRST_COLLECTION_ITEMS + SECOND_COLLECTION_ITEMS,
      linked: true,
    });
    httpMock.verify();
  });

  it('asks the library endpoint for a single row, since only the total is used', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    const request = httpMock.expectOne((candidate) => candidate.url === CuratorApi.library);
    expect(request.request.params.get(CuratorQueryParams.limit)).toBe('1');

    request.flush({ games: [], total: 0 });
    httpMock.expectOne(CuratorApi.collections).flush([]);
    httpMock.expectOne(CuratorApi.me).flush(me);
    await resultPromise;
    httpMock.verify();
  });

  it('degrades to null when a totals call fails, rather than throwing', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock
      .expectOne((request) => request.url === CuratorApi.library)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(await resultPromise).toBeNull();
  });

  it('still reports both totals when only the profile call fails, marking linked unknown', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === CuratorApi.library).flush({ games: [], total: LIBRARY_TOTAL });
    httpMock.expectOne(CuratorApi.collections).flush([definition(newId(), FIRST_COLLECTION_ITEMS)]);
    httpMock.expectOne(CuratorApi.me).flush(null, { status: HttpStatusCode.ServiceUnavailable, statusText: HttpStatusCode[HttpStatusCode.ServiceUnavailable] });

    expect(await resultPromise).toEqual({
      libraryTotal: LIBRARY_TOTAL,
      collectionCount: 1,
      collectionEntries: FIRST_COLLECTION_ITEMS,
      linked: null,
    });
    httpMock.verify();
  });

  it('issues the only GET /me — admin status costs no request of its own', async () => {
    const httpMock = configure(true);
    const resultPromise = firstValueFrom(resolve());

    httpMock.expectOne((request) => request.url === CuratorApi.library).flush({ games: [], total: 0 });
    httpMock.expectOne(CuratorApi.collections).flush([]);
    httpMock.expectOne(CuratorApi.me).flush(me);
    await resultPromise;

    TestBed.inject(AdminService).isAdmin();

    httpMock.expectNone(CuratorApi.me);
    httpMock.verify();
  });
});
