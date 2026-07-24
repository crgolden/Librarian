import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { psnStatusResolver, PsnStatus } from './psn-status.resolver';

describe('psnStatusResolver', () => {
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

  it('resolves the PSN status when GET /curator/api/me succeeds', async () => {
    const status: PsnStatus = { sub: 'u1', email: 'chris@example.com', linked: true, psn: null };

    const result$ = TestBed.runInInjectionContext(() =>
      psnStatusResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<PsnStatus | null>;
    const resultPromise = firstValueFrom(result$);

    httpMock.expectOne('/curator/api/me').flush(status);

    expect(await resultPromise).toEqual(status);
  });

  it('resolves to null when the request fails, instead of throwing', async () => {
    const result$ = TestBed.runInInjectionContext(() =>
      psnStatusResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<PsnStatus | null>;
    const resultPromise = firstValueFrom(result$);

    httpMock.expectOne('/curator/api/me').flush(null, { status: 500, statusText: 'Server Error' });

    expect(await resultPromise).toBeNull();
  });
});
