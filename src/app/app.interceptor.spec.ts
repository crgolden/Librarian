import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUEST } from '@angular/core';
import { appInterceptor } from './app.interceptor';
import { CuratorApi } from '../curator/curator-api';
import { COOKIE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE } from '../shared/bff-contract';
import { ContentTypes } from '../shared/content-types';
import { HttpHeaderNames } from '../testing/http-header-constants';
import { newHostname, newPathSegment, newText } from '@crgolden/modules/testing';

const RENDER_HOST = newHostname();
const OTHER_HOST = newHostname();
const RELATIVE_PATH = `/${newPathSegment()}`;
const SESSION_COOKIE = `${newText()}=${newText()}`;

describe('appInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function configure(requestValue: Request | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([appInterceptor])),
        provideHttpClientTesting(),
        { provide: REQUEST, useValue: requestValue },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => configure(null));

  afterEach(() => {
    httpMock.verify();
  });

  it('adds the X-CSRF header and withCredentials to every outgoing request', () => {
    http.get(RELATIVE_PATH).subscribe();

    const req = httpMock.expectOne(RELATIVE_PATH);
    expect(req.request.headers.get(CSRF_HEADER)).toBe(CSRF_HEADER_VALUE);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('preserves existing headers alongside the added X-CSRF header', () => {
    http.get(RELATIVE_PATH, { headers: { [HttpHeaderNames.accept]: ContentTypes.json } }).subscribe();

    const req = httpMock.expectOne(RELATIVE_PATH);
    expect(req.request.headers.get(HttpHeaderNames.accept)).toBe(ContentTypes.json);
    expect(req.request.headers.get(CSRF_HEADER)).toBe(CSRF_HEADER_VALUE);
    req.flush({});
  });

  it('does not add a Cookie header when REQUEST is null (browser)', () => {
    http.get(RELATIVE_PATH).subscribe();

    const req = httpMock.expectOne(RELATIVE_PATH);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });

  it('forwards the incoming Cookie header from REQUEST during SSR', () => {
    const incoming = new Request(`https://${RENDER_HOST}/${newPathSegment()}`, {
      headers: { [HttpHeaderNames.cookie]: SESSION_COOKIE },
    });
    configure(incoming);

    http.get(RELATIVE_PATH).subscribe();

    const req = httpMock.expectOne(RELATIVE_PATH);
    expect(req.request.headers.get(COOKIE_HEADER)).toBe(SESSION_COOKIE);
    req.flush({});
  });

  it('does not add a Cookie header when REQUEST has no cookie header', () => {
    const incoming = new Request(`https://${RENDER_HOST}/${newPathSegment()}`);
    configure(incoming);

    http.get(RELATIVE_PATH).subscribe();

    const req = httpMock.expectOne(RELATIVE_PATH);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });

  it('forwards the cookie to an absolute URL on the render origin', () => {
    configure(
      new Request(`https://${RENDER_HOST}/${newPathSegment()}`, { headers: { [HttpHeaderNames.cookie]: SESSION_COOKIE } }),
    );

    http.get(`https://${RENDER_HOST}${CuratorApi.me}`).subscribe();

    const req = httpMock.expectOne(`https://${RENDER_HOST}${CuratorApi.me}`);
    expect(req.request.headers.get(COOKIE_HEADER)).toBe(SESSION_COOKIE);
    req.flush({});
  });

  it('withholds the cookie from any other origin', () => {
    configure(
      new Request(`https://${RENDER_HOST}/${newPathSegment()}`, { headers: { [HttpHeaderNames.cookie]: SESSION_COOKIE } }),
    );

    http.get(`https://${OTHER_HOST}${CuratorApi.me}`).subscribe();

    const req = httpMock.expectOne(`https://${OTHER_HOST}${CuratorApi.me}`);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });

  it('withholds the cookie from a host that merely starts with the render origin', () => {
    configure(
      new Request(`https://${RENDER_HOST}/${newPathSegment()}`, { headers: { [HttpHeaderNames.cookie]: SESSION_COOKIE } }),
    );

    http.get(`https://${RENDER_HOST}.${OTHER_HOST}${CuratorApi.me}`).subscribe();

    const req = httpMock.expectOne(`https://${RENDER_HOST}.${OTHER_HOST}${CuratorApi.me}`);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });

  it('withholds the cookie from a protocol-relative URL, which is not our origin', () => {
    configure(
      new Request(`https://${RENDER_HOST}/${newPathSegment()}`, { headers: { [HttpHeaderNames.cookie]: SESSION_COOKIE } }),
    );

    http.get(`//${OTHER_HOST}${CuratorApi.me}`).subscribe();

    const req = httpMock.expectOne(`//${OTHER_HOST}${CuratorApi.me}`);
    expect(req.request.headers.has(COOKIE_HEADER)).toBe(false);
    req.flush({});
  });
});
