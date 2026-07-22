import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUEST } from '@angular/core';
import { appInterceptor } from './app.interceptor';

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
    http.get('/api/thing').subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.get('X-CSRF')).toBe('1');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('preserves existing headers alongside the added X-CSRF header', () => {
    http.get('/api/thing', { headers: { Accept: 'application/json' } }).subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.headers.get('X-CSRF')).toBe('1');
    req.flush({});
  });

  it('does not add a Cookie header when REQUEST is null (browser)', () => {
    http.get('/api/thing').subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.has('Cookie')).toBe(false);
    req.flush({});
  });

  it('forwards the incoming Cookie header from REQUEST during SSR', () => {
    const incoming = new Request('https://example.com/library', {
      headers: { cookie: 'librarian.sid=s%3Aabc123' },
    });
    configure(incoming);

    http.get('/api/thing').subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.get('Cookie')).toBe('librarian.sid=s%3Aabc123');
    req.flush({});
  });

  it('does not add a Cookie header when REQUEST has no cookie header', () => {
    const incoming = new Request('https://example.com/library');
    configure(incoming);

    http.get('/api/thing').subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.headers.has('Cookie')).toBe(false);
    req.flush({});
  });
});
