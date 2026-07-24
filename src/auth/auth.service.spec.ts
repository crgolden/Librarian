import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import type { Claim } from './claim';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reports anonymous state before initialize() has ever been called', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.session()).toEqual([]);
    expect(service.username()).toBeNull();
    expect(service.email()).toBeNull();
    expect(service.picture()).toBeNull();
    expect(service.logoutUrl()).toBeNull();
  });

  it('populates every claim signal after a successful /bff/user fetch', () => {
    const claims: Claim[] = [
      { type: 'sub', value: 'user-1' },
      { type: 'name', value: 'chris' },
      { type: 'email', value: 'chris@example.com' },
      { type: 'picture', value: 'https://example.com/avatar.png' },
      { type: 'bff:logout_url', value: '/bff/logout?sid=abc' },
    ];

    let resolved: Claim[] | undefined;
    service.initialize().subscribe((session) => (resolved = session));

    const req = httpMock.expectOne('bff/user');
    expect(req.request.method).toBe('GET');
    req.flush(claims);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.session()).toEqual(claims);
    expect(service.username()).toBe('chris');
    expect(service.email()).toBe('chris@example.com');
    expect(service.picture()).toBe('https://example.com/avatar.png');
    expect(service.logoutUrl()).toBe('/bff/logout?sid=abc');
    expect(resolved).toEqual(claims);
  });

  it('falls back to null for name/email/picture/logout claims that are absent', () => {
    service.initialize().subscribe();
    httpMock.expectOne('bff/user').flush([{ type: 'sub', value: 'user-1' }]);

    expect(service.username()).toBeNull();
    expect(service.email()).toBeNull();
    expect(service.picture()).toBeNull();
    expect(service.logoutUrl()).toBeNull();
  });

  it('reports anonymous state when /bff/user responds with an error (e.g. 401)', () => {
    let resolved: Claim[] | undefined;
    service.initialize().subscribe((session) => (resolved = session));

    httpMock.expectOne('bff/user').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.session()).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it('refresh() re-fetches the session and updates every dependent signal', () => {
    service.initialize().subscribe();
    httpMock.expectOne('bff/user').flush([{ type: 'name', value: 'first' }]);
    expect(service.username()).toBe('first');

    service.refresh();
    httpMock.expectOne('bff/user').flush([{ type: 'name', value: 'second' }]);
    expect(service.username()).toBe('second');
  });
});
