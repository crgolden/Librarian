import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { appInterceptor } from './app.interceptor';

describe('appInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([appInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

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
});
