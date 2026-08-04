import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reports isAdmin false before ensureLoaded() has ever been called', () => {
    expect(service.isAdmin()).toBe(false);
  });

  it('resolves isAdmin true when GET /me returns is_admin: true', () => {
    let resolved: boolean | undefined;
    service.ensureLoaded().subscribe((value) => (resolved = value));

    const req = httpMock.expectOne('/curator/api/me');
    expect(req.request.method).toBe('GET');
    req.flush({ sub: 'user-1', email: null, linked: false, psn: null, is_admin: true });

    expect(service.isAdmin()).toBe(true);
    expect(resolved).toBe(true);
  });

  it('resolves isAdmin false when GET /me returns is_admin: false', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne('/curator/api/me').flush({ sub: 'user-1', email: null, linked: false, psn: null, is_admin: false });

    expect(service.isAdmin()).toBe(false);
  });

  it('resolves isAdmin false (not an error) when GET /me fails', () => {
    let resolved: boolean | undefined;
    service.ensureLoaded().subscribe((value) => (resolved = value));

    httpMock.expectOne('/curator/api/me').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(service.isAdmin()).toBe(false);
    expect(resolved).toBe(false);
  });

  it('ensureLoaded() only issues one GET /me request across multiple calls', () => {
    service.ensureLoaded().subscribe();
    httpMock.expectOne('/curator/api/me').flush({ sub: 'user-1', email: null, linked: false, psn: null, is_admin: true });

    let secondResolved: boolean | undefined;
    service.ensureLoaded().subscribe((value) => (secondResolved = value));

    httpMock.expectNone('/curator/api/me');
    expect(secondResolved).toBe(true);
  });
});
