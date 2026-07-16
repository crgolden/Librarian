import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PsnSettingsComponent } from './psn-settings.component';

interface MeResponse {
  sub: string;
  email: string | null;
  linked: boolean;
  psn: { access_token_expires_at: string | null; refresh_token_expires_at: string | null } | null;
}

// Internal signals/methods are `protected`, not part of the component's public API — but driving
// link()/unlink() through simulated ngModel/DOM events is brittle for a password-type input, so
// tests call the protected members directly and assert on rendered output instead.
interface PsnSettingsHarness {
  npsso: { set(value: string): void };
  link(): void;
  unlink(): void;
}

function harness(fixture: ComponentFixture<PsnSettingsComponent>): PsnSettingsHarness {
  return fixture.componentInstance as unknown as PsnSettingsHarness;
}

describe('PsnSettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PsnSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(
    response: MeResponse | null,
    errorStatus?: number,
  ): ComponentFixture<PsnSettingsComponent> {
    const fixture = TestBed.createComponent(PsnSettingsComponent);
    fixture.detectChanges(); // ngOnInit -> GET /curator/api/me

    const req = httpMock.expectOne('/curator/api/me');
    expect(req.request.method).toBe('GET');
    if (errorStatus) {
      req.flush(null, { status: errorStatus, statusText: 'Error' });
    } else {
      req.flush(response);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('shows the link form once loaded when no PSN account is linked', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.textContent).not.toContain('Loading link status');
    expect(compiled.querySelector('#npsso')).not.toBeNull();
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain('Link account');
  });

  it('shows linked status with re-authentication metadata when linked', () => {
    const fixture = createAndLoad({
      sub: 'u1',
      email: 'chris@example.com',
      linked: true,
      psn: { access_token_expires_at: '2026-01-01T00:00:00Z', refresh_token_expires_at: '2026-02-01T00:00:00Z' },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.psn-badge')?.textContent).toContain('PSN account linked');
    expect(compiled.textContent).toContain("We'll keep this linked until");
    expect(compiled.textContent).toContain('new NPSSO token');
    expect(compiled.querySelector('button')?.textContent).toContain('Unlink');
  });

  it('shows linked status without re-authentication metadata when no expiry is known', () => {
    const fixture = createAndLoad({
      sub: 'u1',
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.psn-badge')?.textContent).toContain('PSN account linked');
    expect(compiled.textContent).not.toContain("We'll keep this linked until");
  });

  it('shows a no-refresh-token warning with the access token expiry when PSN issued no refresh token', () => {
    const fixture = createAndLoad({
      sub: 'u1',
      email: 'chris@example.com',
      linked: true,
      psn: { access_token_expires_at: '2026-01-01T00:00:00Z', refresh_token_expires_at: null },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.psn-badge')?.textContent).toContain('PSN account linked');
    expect(compiled.textContent).not.toContain('Re-authentication required after');
    const warning = compiled.querySelector('.text-warning');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain("PSN didn't issue a renewable session");
    expect(warning?.textContent).toContain('new');
    expect(warning?.textContent).toContain('NPSSO');
  });

  it('shows an error and still falls back to the link form when the status request fails', () => {
    const fixture = createAndLoad(null, 500);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#npsso')).not.toBeNull();
    expect(compiled.textContent).toContain('Unable to load PSN link status.');
  });

  it('link() shows a validation error and makes no request when the NPSSO field is empty', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });

    harness(fixture).link();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter your NPSSO token.');
    httpMock.expectNone('/curator/api/psn/link');
  });

  it('link() posts the trimmed NPSSO token, clears it, and reloads status on success', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set('  a-real-token  ');

    h.link();
    fixture.detectChanges();

    const linkReq = httpMock.expectOne('/curator/api/psn/link');
    expect(linkReq.request.method).toBe('POST');
    expect(linkReq.request.body).toEqual({ npsso: 'a-real-token' });
    linkReq.flush({});

    const reloadReq = httpMock.expectOne('/curator/api/me');
    reloadReq.flush({ sub: 'u1', email: null, linked: true, psn: null });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('PlayStation Network account linked.');
    expect(compiled.querySelector('.psn-badge')).not.toBeNull();
  });

  it('link() surfaces a generic error message when the request fails with no known error code', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set('bad-token');

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/psn/link');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Failed to link PlayStation Network account.');
  });

  it('link() surfaces an email-mismatch message when the account emails do not match', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set('good-token');

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/psn/link');
    req.flush(
      { detail: { error: 'mismatch', message: 'emails do not match' } },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("doesn't match your account email");
  });

  it('link() surfaces an unverified-email message when the PSN account email is not verified', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set('good-token');

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/psn/link');
    req.flush(
      { detail: { error: 'unverified', message: 'PSN email is not verified' } },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("isn't verified");
  });

  it('unlink() deletes the PSN link and reloads status on success', () => {
    const fixture = createAndLoad({
      sub: 'u1',
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });

    harness(fixture).unlink();
    fixture.detectChanges();

    const unlinkReq = httpMock.expectOne('/curator/api/psn/link');
    expect(unlinkReq.request.method).toBe('DELETE');
    unlinkReq.flush({});

    const reloadReq = httpMock.expectOne('/curator/api/me');
    reloadReq.flush({ sub: 'u1', email: null, linked: false, psn: null });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('PlayStation Network account unlinked.');
    expect(compiled.querySelector('#npsso')).not.toBeNull();
  });

  it('unlink() surfaces an error message when the request fails', () => {
    const fixture = createAndLoad({
      sub: 'u1',
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });

    harness(fixture).unlink();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/psn/link');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Failed to unlink PlayStation Network account.');
  });
});
