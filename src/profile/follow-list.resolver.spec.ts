import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { followListResolver, ResolvedFollowList } from './follow-list.resolver';
import { AuthService } from '../auth/auth.service';
import { CuratorApi } from '../curator/curator-api';
import { type FollowListKind, FollowListKinds, RouteParams } from '../app/app-paths';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newId, newText } from '@crgolden/modules/testing';

const VIEWER_SUB = newId();
const OTHER_SUB = newId();

function configure(sub: string | null): HttpTestingController {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { sub: signal(sub) } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

function resolve(kind: FollowListKind, params: Record<string, string>): Observable<ResolvedFollowList> {
  const snapshot = { paramMap: convertToParamMap(params) } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() =>
    followListResolver(kind)(snapshot, {} as RouterStateSnapshot),
  ) as Observable<ResolvedFollowList>;
}

const entries = [{ sub: newId(), display_name: newText(), avatar_url: null }];

describe('followListResolver', () => {
  it('resolves the followers of the :sub named in the route', async () => {
    const httpMock = configure(VIEWER_SUB);
    const resultPromise = firstValueFrom(resolve(FollowListKinds.followers, { [RouteParams.sub]: OTHER_SUB }));

    const request = httpMock.expectOne((candidate) => candidate.url === CuratorApi.usersBySubFollowers(OTHER_SUB));
    request.flush({ entries, total: entries.length });

    expect(await resultPromise).toEqual({ status: ResolvedStatuses.ok, entries, total: entries.length });
    httpMock.verify();
  });

  it('falls back to the signed-in user when the route carries no :sub', async () => {
    const httpMock = configure(VIEWER_SUB);
    const resultPromise = firstValueFrom(resolve(FollowListKinds.followers, {}));

    httpMock.expectOne((candidate) => candidate.url === CuratorApi.usersBySubFollowers(VIEWER_SUB)).flush({ entries: [], total: 0 });

    expect(await resultPromise).toEqual({ status: ResolvedStatuses.ok, entries: [], total: 0 });
    httpMock.verify();
  });

  it('asks the following endpoint, not followers, for the following kind', async () => {
    const httpMock = configure(VIEWER_SUB);
    const resultPromise = firstValueFrom(resolve(FollowListKinds.following, {}));

    httpMock.expectOne((candidate) => candidate.url === CuratorApi.usersBySubFollowing(VIEWER_SUB)).flush({ entries, total: entries.length });

    expect(await resultPromise).toEqual({ status: ResolvedStatuses.ok, entries, total: entries.length });
    httpMock.verify();
  });

  it('reports no-user, without a request, when there is neither a :sub nor a signed-in user', async () => {
    const httpMock = configure(null);

    expect(await firstValueFrom(resolve(FollowListKinds.followers, {}))).toEqual({ status: ResolvedStatuses.noUser });
    httpMock.verify();
  });

  it('degrades to an error status rather than throwing when the request fails', async () => {
    const httpMock = configure(VIEWER_SUB);
    const resultPromise = firstValueFrom(resolve(FollowListKinds.following, { [RouteParams.sub]: OTHER_SUB }));

    httpMock
      .expectOne((candidate) => candidate.url === CuratorApi.usersBySubFollowing(OTHER_SUB))
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(await resultPromise).toEqual({ status: ResolvedStatuses.error });
  });
});
