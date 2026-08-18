import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MeResponse } from './curator.models';
import { MeService } from './me.service';

const ME: MeResponse = { sub: 'user-1', email: null, linked: true, psn: null, is_admin: false };

describe('MeService', () => {
  let service: MeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(MeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('issues no request until load() is called', () => {
    httpMock.expectNone('/curator/api/me');
  });

  it('resolves the profile from GET /me', () => {
    let resolved: MeResponse | null | undefined;
    service.load().subscribe((value) => (resolved = value));

    const req = httpMock.expectOne('/curator/api/me');
    expect(req.request.method).toBe('GET');
    req.flush(ME);

    expect(resolved).toEqual(ME);
  });

  it('replays the cached profile to a subscriber that arrives after the first one completed', () => {
    service.load().subscribe();
    httpMock.expectOne('/curator/api/me').flush(ME);

    let replayed: MeResponse | null | undefined;
    service.load().subscribe((value) => (replayed = value));

    httpMock.expectNone('/curator/api/me');
    expect(replayed).toEqual(ME);
  });

  it('shares one request between two subscribers that overlap in flight', () => {
    const seen: (MeResponse | null)[] = [];
    service.load().subscribe((value) => seen.push(value));
    service.load().subscribe((value) => seen.push(value));

    httpMock.expectOne('/curator/api/me').flush(ME);

    expect(seen).toEqual([ME, ME]);
  });

  it('yields null rather than erroring when GET /me fails', () => {
    let resolved: MeResponse | null | undefined;
    service.load().subscribe((value) => (resolved = value));

    httpMock.expectOne('/curator/api/me').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(resolved).toBeNull();
  });

  it('retries on the next load() instead of pinning a transient failure for the session', () => {
    service.load().subscribe();
    httpMock.expectOne('/curator/api/me').flush(null, { status: 502, statusText: 'Bad Gateway' });

    let retried: MeResponse | null | undefined;
    service.load().subscribe((value) => (retried = value));

    httpMock.expectOne('/curator/api/me').flush(ME);
    expect(retried).toEqual(ME);
  });

  it('refetches after invalidate(), so a linked/unlinked change is not served from cache', () => {
    let before: MeResponse | null | undefined;
    service.load().subscribe((value) => (before = value));
    httpMock.expectOne('/curator/api/me').flush({ ...ME, linked: false });
    expect(before?.linked).toBe(false);

    service.invalidate();

    let after: MeResponse | null | undefined;
    service.load().subscribe((value) => (after = value));
    httpMock.expectOne('/curator/api/me').flush({ ...ME, linked: true });
    expect(after?.linked).toBe(true);
  });

  it('keeps serving the cache when invalidate() has not been called', () => {
    service.load().subscribe();
    httpMock.expectOne('/curator/api/me').flush(ME);

    service.load().subscribe();

    httpMock.expectNone('/curator/api/me');
  });
});
