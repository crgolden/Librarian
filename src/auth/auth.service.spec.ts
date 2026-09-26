import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import type { Claim } from './claim';
import { BFF_USER_RELATIVE_PATH, BffPaths, ClaimTypes, SID_QUERY_PARAMETER } from '../shared/bff-contract';
import { HttpMethods } from '../bff/http-headers';
import { newEmailAddress, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const SUB = newId();
const USERNAME = newText();
const EMAIL = newEmailAddress();
const PICTURE_URL = newHttpsAddress();
const PROVIDER_SID = newId();
const FIRST_NAME = newText();
const SECOND_NAME = newText();

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
      { type: ClaimTypes.sub, value: SUB },
      { type: ClaimTypes.name, value: USERNAME },
      { type: ClaimTypes.email, value: EMAIL },
      { type: ClaimTypes.picture, value: PICTURE_URL },
      { type: ClaimTypes.logoutUrl, value: `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${PROVIDER_SID}` },
    ];

    let resolved: Claim[] | undefined;
    service.initialize().subscribe((session) => (resolved = session));

    const req = httpMock.expectOne(BFF_USER_RELATIVE_PATH);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(claims);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.session()).toEqual(claims);
    expect(service.username()).toBe(USERNAME);
    expect(service.email()).toBe(EMAIL);
    expect(service.picture()).toBe(PICTURE_URL);
    expect(service.logoutUrl()).toBe(`${BffPaths.logout}?${SID_QUERY_PARAMETER}=${PROVIDER_SID}`);
    expect(resolved).toEqual(claims);
  });

  it('falls back to null for name/email/picture/logout claims that are absent', () => {
    service.initialize().subscribe();
    httpMock.expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: SUB }]);

    expect(service.username()).toBeNull();
    expect(service.email()).toBeNull();
    expect(service.picture()).toBeNull();
    expect(service.logoutUrl()).toBeNull();
  });

  it('reports anonymous state for the null body /bff/user answers a visitor with no session', () => {
    let resolved: Claim[] | undefined;
    service.initialize().subscribe((session) => (resolved = session));

    httpMock.expectOne(BFF_USER_RELATIVE_PATH).flush(null);

    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.session()).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it('reports anonymous state when /bff/user responds with an error (e.g. 401)', () => {
    let resolved: Claim[] | undefined;
    service.initialize().subscribe((session) => (resolved = session));

    httpMock.expectOne(BFF_USER_RELATIVE_PATH).flush(null, { status: HttpStatusCode.Unauthorized, statusText: HttpStatusCode[HttpStatusCode.Unauthorized] });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.session()).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it('refresh() re-fetches the session and updates every dependent signal', () => {
    service.initialize().subscribe();
    httpMock.expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.name, value: FIRST_NAME }]);
    expect(service.username()).toBe(FIRST_NAME);

    service.refresh();
    httpMock.expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.name, value: SECOND_NAME }]);
    expect(service.username()).toBe(SECOND_NAME);
  });
});
