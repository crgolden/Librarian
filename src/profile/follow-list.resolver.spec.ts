import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { followListResolver, ResolvedFollowList } from './follow-list.resolver';
import { AuthService } from '../auth/auth.service';

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

function resolve(kind: 'followers' | 'following', params: Record<string, string>): Observable<ResolvedFollowList> {
  const snapshot = { paramMap: convertToParamMap(params) } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() =>
    followListResolver(kind)(snapshot, {} as RouterStateSnapshot),
  ) as Observable<ResolvedFollowList>;
}

const entries = [{ sub: 'u2', display_name: 'Someone', avatar_url: null }];

describe('followListResolver', () => {
  it('resolves the followers of the :sub named in the route', async () => {
    const httpMock = configure('u1');
    const resultPromise = firstValueFrom(resolve('followers', { sub: 'u2' }));

    const request = httpMock.expectOne((candidate) => candidate.url === '/curator/api/users/u2/followers');
    request.flush({ entries, total: 1 });

    expect(await resultPromise).toEqual({ status: 'ok', entries, total: 1 });
    httpMock.verify();
  });

  it('falls back to the signed-in user when the route carries no :sub', async () => {
    const httpMock = configure('u1');
    const resultPromise = firstValueFrom(resolve('followers', {}));

    httpMock.expectOne((candidate) => candidate.url === '/curator/api/users/u1/followers').flush({ entries: [], total: 0 });

    expect(await resultPromise).toEqual({ status: 'ok', entries: [], total: 0 });
    httpMock.verify();
  });

  it('asks the following endpoint, not followers, for the following kind', async () => {
    const httpMock = configure('u1');
    const resultPromise = firstValueFrom(resolve('following', {}));

    httpMock.expectOne((candidate) => candidate.url === '/curator/api/users/u1/following').flush({ entries: [], total: 0 });

    await resultPromise;
    httpMock.verify();
  });

  it('reports no-user, without a request, when there is neither a :sub nor a signed-in user', async () => {
    const httpMock = configure(null);

    expect(await firstValueFrom(resolve('followers', {}))).toEqual({ status: 'no-user' });
    httpMock.verify();
  });

  it('degrades to an error status rather than throwing when the request fails', async () => {
    const httpMock = configure('u1');
    const resultPromise = firstValueFrom(resolve('following', { sub: 'u2' }));

    httpMock
      .expectOne((candidate) => candidate.url === '/curator/api/users/u2/following')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(await resultPromise).toEqual({ status: 'error' });
  });
});
