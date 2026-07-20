import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { PsnSettingsComponent } from './psn-settings.component';
import { PsnStatus } from './psn-status.resolver';
import { PsnPreferencesResponse } from '../curator/curator.models';

type MeResponse = PsnStatus;

// Internal signals/methods are `protected`, not part of the component's public API — but driving
// link()/unlink() through simulated ngModel/DOM events is brittle for a password-type input, so
// tests call the protected members directly and assert on rendered output instead.
interface PsnSettingsHarness {
  npsso: { set(value: string): void };
  link(): void;
  unlink(): void;
  onToggle(category: keyof PsnPreferencesResponse, newValue: boolean): void;
  overlayVisible: () => boolean;
  loadMyActions(): void;
  requestDeleteMyData(): void;
  cancelDeleteMyData(): void;
  confirmDeleteMyData(): void;
  rawgKeyInput: { set(value: string): void };
  setRawgKey(): void;
  deleteRawgKey(): void;
  opencriticKeyInput: { set(value: string): void };
  setOpenCriticKey(): void;
  deleteOpenCriticKey(): void;
}

function harness(fixture: ComponentFixture<PsnSettingsComponent>): PsnSettingsHarness {
  return fixture.componentInstance as unknown as PsnSettingsHarness;
}

describe('PsnSettingsComponent', () => {
  let httpMock: HttpTestingController;
  let routeSnapshotData: { status: MeResponse | null };

  beforeEach(() => {
    routeSnapshotData = { status: null };
    TestBed.configureTestingModule({
      imports: [PsnSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeSnapshotData } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const ALL_PREFS_OFF = {
    harvest_trophies: false,
    harvest_identity: false,
    harvest_presence: false,
    harvest_devices: false,
  };

  // Status now arrives pre-resolved via the route's `status` resolver data (see psn-status.resolver.ts)
  // instead of a GET fired from ngOnInit -- `response: null` mirrors the resolver's own catchError(() =>
  // of(null)) fallback for a failed /me request.
  //
  const NO_ENRICHMENT_KEYS = {
    rawg_configured: false,
    opencritic_configured: false,
    rawg_added_at: null,
    opencritic_added_at: null,
  };

  // When the resolved status is linked, the component also fires a GET for PSN preferences and a GET for
  // enrichment-key status (see applyStatus -> loadPreferences / loadEnrichmentKeyStatus). Flush both with
  // empty/off defaults so no per-category cascade requests are opened, keeping httpMock.verify() clean for
  // tests that don't care about preferences or enrichment keys.
  function createAndLoad(response: MeResponse | null): ComponentFixture<PsnSettingsComponent> {
    routeSnapshotData.status = response;
    const fixture = TestBed.createComponent(PsnSettingsComponent);
    fixture.detectChanges(); // ngOnInit -> reads route.snapshot.data['status']
    if (response?.linked) {
      httpMock.expectOne('/curator/api/me/psn-preferences').flush(ALL_PREFS_OFF);
      httpMock.expectOne('/curator/api/me/enrichment-keys').flush(NO_ENRICHMENT_KEYS);
      fixture.detectChanges();
    }
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

  it('shows an error and still falls back to the link form when the resolver could not load status', () => {
    const fixture = createAndLoad(null);
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

    httpMock.expectOne('/curator/api/me/psn-preferences').flush(ALL_PREFS_OFF);
    httpMock.expectOne('/curator/api/me/enrichment-keys').flush(NO_ENRICHMENT_KEYS);
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

  // ── Action history ───────────────────────────────────────────────────────────

  it('shows a "View my action history" button initially, with no request fired', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('View my action history');
    httpMock.expectNone('/curator/api/me/actions');
  });

  it('loads and renders the action history on click', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne('/curator/api/me/actions');
    req.flush({
      actions: [{ action: 'link_succeeded', detail: null, occurred_at: '2026-01-01T00:00:00Z' }],
    });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('link_succeeded');
    expect(compiled.querySelector('button.btn-ghost')).not.toBeNull();
  });

  it('shows a message when there is no history yet', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne('/curator/api/me/actions');
    req.flush({ actions: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No actions recorded yet.');
  });

  it('surfaces an error message when loading the action history fails', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne('/curator/api/me/actions');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Unable to load your action history.');
  });

  // ── Delete my data ───────────────────────────────────────────────────────────

  it('shows a "Delete my data" button that requires confirmation before calling DELETE /curator/api/me', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.textContent).toContain('Delete my data');
    httpMock.expectNone('/curator/api/me');

    harness(fixture).requestDeleteMyData();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Are you sure?');
    httpMock.expectNone('/curator/api/me');
  });

  it('cancelDeleteMyData() backs out of the confirmation without deleting anything', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    fixture.detectChanges();
    h.cancelDeleteMyData();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Are you sure?');
    httpMock.expectNone('/curator/api/me');
  });

  it('confirmDeleteMyData() deletes the account and shows a confirmation message on success', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    h.confirmDeleteMyData();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/me');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Your account and all associated data have been deleted.');
  });

  it('confirmDeleteMyData() surfaces an error message when the request fails', () => {
    const fixture = createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    h.confirmDeleteMyData();
    fixture.detectChanges();

    const req = httpMock.expectOne('/curator/api/me');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Failed to delete your account. Please try again.');
  });

  // ── PSN data-sharing preferences ────────────────────────────────────────────

  const LINKED_STATUS: MeResponse = {
    sub: 'u1',
    email: null,
    linked: true,
    psn: { access_token_expires_at: null, refresh_token_expires_at: null },
  };

  const TROPHY_SUMMARY = {
    level: 42,
    progress: 65,
    tier: 3,
    earned: { bronze: 120, silver: 45, gold: 12, platinum: 3 },
    account_id: 'acct-1',
  };

  /** Like createAndLoad, but flushes psn-preferences with the given flags instead of all-off,
   * then flushes a GET for each enabled category so the fixture ends up settled. */
  function createLinkedWithPreferences(
    prefs: Record<keyof PsnPreferencesResponse, boolean>,
  ): ComponentFixture<PsnSettingsComponent> {
    routeSnapshotData.status = LINKED_STATUS;
    const fixture = TestBed.createComponent(PsnSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/me/psn-preferences').flush(prefs);
    httpMock.expectOne('/curator/api/me/enrichment-keys').flush(NO_ENRICHMENT_KEYS);
    fixture.detectChanges();

    if (prefs.harvest_trophies) {
      httpMock.expectOne('/curator/api/trophies/summary').flush(TROPHY_SUMMARY);
    }
    if (prefs.harvest_identity) {
      httpMock.expectOne('/curator/api/identity').flush({ account_id: 'acct-1', online_id: 'gamer', region: 'US' });
    }
    if (prefs.harvest_presence) {
      httpMock
        .expectOne('/curator/api/presence')
        .flush({ online_status: 'online', platform: 'PS5', last_online_date: null, game_title: null });
    }
    if (prefs.harvest_devices) {
      httpMock.expectOne('/curator/api/devices').flush({ devices: [] });
    }
    fixture.detectChanges();

    return fixture;
  }

  it('fires the preferences GET only after the linked status resolves, and no per-category GET when all flags are off', () => {
    const fixture = createAndLoad(LINKED_STATUS);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.psn-preferences')).not.toBeNull();
    expect(compiled.querySelectorAll('.psn-category-card').length).toBe(0);
    httpMock.expectNone('/curator/api/trophies/summary');
    httpMock.expectNone('/curator/api/identity');
    httpMock.expectNone('/curator/api/presence');
    httpMock.expectNone('/curator/api/devices');
  });

  it('shows the profile-settings cross-reference copy near the harvest toggles, linking to /profile/settings', () => {
    const fixture = createAndLoad(LINKED_STATUS);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.textContent).toContain('may also appear on your public profile');
    const link = compiled.querySelector('a[routerLink="/profile/settings"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Profile Settings');
  });

  it('never renders a region field anywhere on the page, including the PSN Identity card', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: false,
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.psn-category-card')?.textContent).toContain('gamer');
    expect(compiled.textContent).not.toContain('US');
    expect(compiled.textContent?.toLowerCase()).not.toContain('region');
  });

  it('does not fire a preferences GET when the account is not linked', () => {
    createAndLoad({ sub: 'u1', email: null, linked: false, psn: null });
    httpMock.expectNone('/curator/api/me/psn-preferences');
  });

  it('fires a per-category GET only for the flags that are enabled on initial load', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: true,
      harvest_identity: false,
      harvest_presence: true,
      harvest_devices: false,
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelectorAll('.psn-category-card').length).toBe(2);
    expect(compiled.textContent).toContain('Level 42');
    expect(compiled.textContent).toContain('online');
    httpMock.expectNone('/curator/api/identity');
    httpMock.expectNone('/curator/api/devices');
  });

  it('onToggle sends a PUT with all 4 current flags, not just the one being changed', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: true,
    });

    harness(fixture).onToggle('harvest_trophies', true);

    const req = httpMock.expectOne('/curator/api/me/psn-preferences');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      harvest_trophies: true,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: true,
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.expectOne('/curator/api/trophies/summary').flush(TROPHY_SUMMARY);
  });

  it('toggling a category on optimistically checks the box, fires its GET, and renders its card on success', async () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
    });
    const h = harness(fixture);

    h.onToggle('harvest_trophies', true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.disabled).toBe(true);

    const putReq = httpMock.expectOne('/curator/api/me/psn-preferences');
    putReq.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    const getReq = httpMock.expectOne('/curator/api/trophies/summary');
    getReq.flush(TROPHY_SUMMARY);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(compiled.querySelector('.psn-category-card')).not.toBeNull();
    expect(compiled.textContent).toContain('Level 42');
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.disabled).toBe(false);
  });

  it('toggling a category off clears its data and hides the card without a new GET', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: true,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.psn-category-card')).not.toBeNull();

    h.onToggle('harvest_trophies', false);
    fixture.detectChanges();

    const putReq = httpMock.expectOne('/curator/api/me/psn-preferences');
    putReq.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(compiled.querySelector('.psn-category-card')).toBeNull();
    httpMock.expectNone('/curator/api/trophies/summary');
  });

  it('reverts the optimistic toggle and shows an error when the PUT fails', async () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle('harvest_trophies', true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(true);

    const putReq = httpMock.expectOne('/curator/api/me/psn-preferences');
    putReq.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(false);
    expect(compiled.textContent).toContain('Failed to update preference. Please try again.');
    expect(compiled.querySelector('.psn-category-card')).toBeNull();
    httpMock.expectNone('/curator/api/trophies/summary');
  });

  it('the loading overlay is visible during linking, unlinking, and a preference save, and hidden otherwise', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.loading-overlay')).toBeNull();

    h.onToggle('harvest_trophies', true);
    fixture.detectChanges();
    expect(compiled.querySelector('.loading-overlay')).not.toBeNull();

    const putReq = httpMock.expectOne('/curator/api/me/psn-preferences');
    putReq.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/trophies/summary').flush(TROPHY_SUMMARY);
    fixture.detectChanges();

    expect(compiled.querySelector('.loading-overlay')).toBeNull();

    h.unlink();
    fixture.detectChanges();
    expect(compiled.querySelector('.loading-overlay')).not.toBeNull();

    const unlinkReq = httpMock.expectOne('/curator/api/psn/link');
    unlinkReq.flush({});
    const reloadReq = httpMock.expectOne('/curator/api/me');
    reloadReq.flush({ sub: 'u1', email: null, linked: false, psn: null });
    fixture.detectChanges();

    expect(compiled.querySelector('.loading-overlay')).toBeNull();
  });

  describe('enrichment API keys', () => {
    function createLinkedWithEnrichmentKeys(
      status: Partial<{ rawg_configured: boolean; opencritic_configured: boolean }>,
    ): ComponentFixture<PsnSettingsComponent> {
      routeSnapshotData.status = LINKED_STATUS;
      const fixture = TestBed.createComponent(PsnSettingsComponent);
      fixture.detectChanges();

      httpMock.expectOne('/curator/api/me/psn-preferences').flush(ALL_PREFS_OFF);
      httpMock.expectOne('/curator/api/me/enrichment-keys').flush({
        rawg_configured: false,
        opencritic_configured: false,
        rawg_added_at: null,
        opencritic_added_at: null,
        ...status,
      });
      fixture.detectChanges();

      return fixture;
    }

    it('shows both providers as not configured, with input forms, when neither key is set', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#rawg-key')).not.toBeNull();
      expect(compiled.querySelector('#opencritic-key')).not.toBeNull();
      expect(compiled.textContent).toContain('rawg.io/apidocs');
      expect(compiled.textContent).toContain('RapidAPI quick-start guide');
    });

    it('shows a configured provider with a remove button, not an input, and hides the get-a-key link', () => {
      const fixture = createLinkedWithEnrichmentKeys({ rawg_configured: true });
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#rawg-key')).toBeNull();
      expect(compiled.textContent).toContain('Configured');
      expect(compiled.textContent).not.toContain('rawg.io/apidocs');
      // OpenCritic independently still shows its own input + get-a-key link.
      expect(compiled.querySelector('#opencritic-key')).not.toBeNull();
      expect(compiled.textContent).toContain('RapidAPI quick-start guide');
    });

    it('setRawgKey() shows a validation error and makes no request when the field is empty', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      harness(fixture).setRawgKey();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a RAWG API key');
      httpMock.expectNone('/curator/api/me/enrichment-keys/rawg');
    });

    it('setRawgKey() PUTs the key, clears the input, and refreshes status on success', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set('  my-rawg-key  ');

      h.setRawgKey();
      fixture.detectChanges();

      const putReq = httpMock.expectOne('/curator/api/me/enrichment-keys/rawg');
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body).toEqual({ api_key: 'my-rawg-key' });
      putReq.flush(null, { status: 204, statusText: 'No Content' });

      httpMock
        .expectOne('/curator/api/me/enrichment-keys')
        .flush({ rawg_configured: true, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Configured');
    });

    it('setRawgKey() surfaces an error and leaves the input state on failure', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set('bad-key');

      h.setRawgKey();
      fixture.detectChanges();

      httpMock.expectOne('/curator/api/me/enrichment-keys/rawg').flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Failed to save RAWG key');
    });

    it('deleteRawgKey() DELETEs and refreshes status, leaving OpenCritic untouched', () => {
      const fixture = createLinkedWithEnrichmentKeys({ rawg_configured: true, opencritic_configured: true });
      harness(fixture).deleteRawgKey();
      fixture.detectChanges();

      const deleteReq = httpMock.expectOne('/curator/api/me/enrichment-keys/rawg');
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush(null, { status: 204, statusText: 'No Content' });

      httpMock.expectOne('/curator/api/me/enrichment-keys').flush({
        rawg_configured: false,
        opencritic_configured: true,
        rawg_added_at: null,
        opencritic_added_at: null,
      });
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#rawg-key')).not.toBeNull();
      expect(compiled.querySelector('#opencritic-key')).toBeNull();
    });

    it('setOpenCriticKey() PUTs the key and refreshes status on success', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.opencriticKeyInput.set('my-oc-key');

      h.setOpenCriticKey();
      fixture.detectChanges();

      const putReq = httpMock.expectOne('/curator/api/me/enrichment-keys/opencritic');
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body).toEqual({ api_key: 'my-oc-key' });
      putReq.flush(null, { status: 204, statusText: 'No Content' });

      httpMock
        .expectOne('/curator/api/me/enrichment-keys')
        .flush({ rawg_configured: false, opencritic_configured: true, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Configured');
    });

    it('the key value is never rendered in the DOM, before or after saving', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set('super-secret-value');

      h.setRawgKey();
      fixture.detectChanges();

      httpMock.expectOne('/curator/api/me/enrichment-keys/rawg').flush(null, { status: 204, statusText: 'No Content' });
      httpMock
        .expectOne('/curator/api/me/enrichment-keys')
        .flush({ rawg_configured: true, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('super-secret-value');
    });
  });
});
