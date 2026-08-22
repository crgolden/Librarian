import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService, ADMIN_CLAIM_TYPE } from './admin.service';
import { AuthService } from '../auth/auth.service';

function configure(): { service: AdminService; httpMock: HttpTestingController; auth: AuthService } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
  });
  return {
    service: TestBed.inject(AdminService),
    httpMock: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
  };
}

function signIn(auth: AuthService, httpMock: HttpTestingController, claims: { type: string; value: string }[]): void {
  auth.initialize().subscribe();
  httpMock.expectOne('bff/user').flush(claims);
}

describe('AdminService', () => {
  it('reports isAdmin false before the session has resolved', () => {
    const { service, httpMock } = configure();

    expect(service.isAdmin()).toBe(false);
    httpMock.expectNone('/curator/api/me');
  });

  it('derives isAdmin from the session claim, with no request of its own', () => {
    const { service, httpMock, auth } = configure();

    signIn(auth, httpMock, [
      { type: 'sub', value: 'user-1' },
      { type: ADMIN_CLAIM_TYPE, value: 'true' },
    ]);

    expect(service.isAdmin()).toBe(true);
    httpMock.expectNone('/curator/api/me');
    httpMock.verify();
  });

  it('reports isAdmin false for a signed-in user whose session carries no admin claim', () => {
    const { service, httpMock, auth } = configure();

    signIn(auth, httpMock, [{ type: 'sub', value: 'user-1' }]);

    expect(service.isAdmin()).toBe(false);
    httpMock.verify();
  });

  it('treats a false-valued admin claim as not an admin, rather than as claim-present', () => {
    const { service, httpMock, auth } = configure();

    signIn(auth, httpMock, [
      { type: 'sub', value: 'user-1' },
      { type: ADMIN_CLAIM_TYPE, value: 'false' },
    ]);

    expect(service.isAdmin()).toBe(false);
    httpMock.verify();
  });

  it('accepts the claim however Identity cases it', () => {
    const { service, httpMock, auth } = configure();

    signIn(auth, httpMock, [
      { type: 'sub', value: 'user-1' },
      { type: ADMIN_CLAIM_TYPE, value: 'True' },
    ]);

    expect(service.isAdmin()).toBe(true);
    httpMock.verify();
  });

  it('settles with the session in one step, never flipping after a later request', () => {
    const { service, httpMock, auth } = configure();

    expect(service.isAdmin()).toBe(false);
    signIn(auth, httpMock, [
      { type: 'sub', value: 'user-1' },
      { type: ADMIN_CLAIM_TYPE, value: 'true' },
    ]);

    expect(service.isAdmin()).toBe(true);
    httpMock.expectNone('/curator/api/me');
    httpMock.verify();
  });

  it('reports isAdmin false when the session fetch fails', () => {
    const { service, httpMock, auth } = configure();

    auth.initialize().subscribe();
    httpMock.expectOne('bff/user').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAdmin()).toBe(false);
    httpMock.verify();
  });
});
