import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { PsnSettingsComponent } from './psn-settings.component';
import { PsnStatus, ResolvedPsnStatus } from './psn-status.resolver';
import {
  AccountActionOutcomes,
  ConsolePlatforms,
  PsnPreferenceKeys,
  PsnPreferencesResponse,
  RefreshCadences,
  SchedulePausedReasons,
} from '../curator/curator.models';
import { MeService } from '../curator/me.service';
import { CuratorApi } from '../curator/curator-api';
import {
  ACCOUNT_DELETE_ERROR,
  CHAT_WRITES_DISCLOSURE,
  DEVICE_LINK_CONSOLE_REQUIRED_ERROR,
  DEVICE_LINK_PLACEHOLDER,
  FRIEND_WRITES_DISCLOSURE,
  ACCOUNT_CHANGES_MESSAGE,
  RAWG_KEY_SAVE_ERROR,
  REFRESH_CADENCE_LABELS,
  SCHEDULE_COST_MESSAGE,
  SCHEDULE_PAUSED_LABELS,
  ACTION_HISTORY_LOAD_ERROR,
  GENERIC_LINK_ERROR_MESSAGE,
  LINK_ERROR_MESSAGES,
  LINK_STATUS_LOAD_ERROR,
  NPSSO_LENGTH,
  NPSSO_REQUIRED_ERROR,
  PsnLinkErrorCodes,
  RAWG_KEY_REQUIRED_ERROR,
  npssoLengthError,
  PREFERENCE_UPDATE_ERROR,
  PSN_LINKED_MESSAGE,
  PSN_UNLINKED_MESSAGE,
  PSN_UNLINK_ERROR,
} from './psn-settings.messages';
import { PageTitles } from '../shared/page-title';
import { HttpMethods } from '../bff/http-headers';
import { ProviderNames } from '../shared/provider-names';
import { lowercaseToken, newCount, newEmailAddress, newId, newPercent, newText, newUtcInstant } from '@crgolden/modules/testing';

const SUB = newId();
const EMAIL = newEmailAddress();
const ACCOUNT_ID = newId();
const ONLINE_ID = newText();
const REGION = lowercaseToken(8);
const PRESENCE_STATUS = newText();
const DEVICE_ID = newId();
const CONSOLE_ID = newId();
const REQUESTER_ONLINE_ID = newText();
const REQUESTER_ACCOUNT_ID = newId();
const RAWG_KEY = newText();
const OPENCRITIC_KEY = newText();
const SECRET_KEY = newText();
const ACTION_NAME = newText();

type MeResponse = PsnStatus;

const HARVEST_CATEGORY_KEYS = [
  PsnPreferenceKeys.harvestTrophies,
  PsnPreferenceKeys.harvestIdentity,
  PsnPreferenceKeys.harvestPresence,
  PsnPreferenceKeys.harvestDevices,
] as const;

function enabledHarvestCategoryCount(preferences: PsnPreferencesResponse): number {
  return HARVEST_CATEGORY_KEYS.filter((key) => preferences[key]).length;
}

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

const VALID_NPSSO = lowercaseToken(NPSSO_LENGTH);

function statusOf(status: HttpStatusCode): { status: HttpStatusCode; statusText: string } {
  return { status, statusText: HttpStatusCode[status] };
}

describe('PsnSettingsComponent', () => {
  let httpMock: HttpTestingController;
  let routeSnapshotData: { status: ResolvedPsnStatus };
  let invalidateMe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routeSnapshotData = { status: resolved() };
    invalidateMe = vi.fn();
    TestBed.configureTestingModule({
      imports: [PsnSettingsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeSnapshotData } } },
        { provide: MeService, useValue: { invalidate: invalidateMe } },
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
    allow_friend_writes: false,
    allow_chat_writes: false,
  };

  const NO_ENRICHMENT_KEYS = {
    rawg_configured: false,
    opencritic_configured: false,
    rawg_added_at: null,
    opencritic_added_at: null,
    rawg_key_rejected_at: null,
    opencritic_key_rejected_at: null,
  };

  const NO_FRIEND_REQUESTS: { requests: { online_id: string | null; account_id: string }[] } = { requests: [] };

  const IDENTITY_ONLY = {
    harvest_trophies: false,
    harvest_identity: true,
    harvest_presence: false,
    harvest_devices: false,
    allow_friend_writes: false,
    allow_chat_writes: false,
  };

  const PSN_IDENTITY = { account_id: ACCOUNT_ID, online_id: ONLINE_ID, region: REGION };
  const PSN_PRESENCE = { online_status: PRESENCE_STATUS, platform: ConsolePlatforms.ps5, last_online_date: null, game_title: null };
  const NO_DEVICES = { devices: [] };

  function resolved(overrides: Partial<ResolvedPsnStatus> = {}): ResolvedPsnStatus {
    return {
      status: { sub: SUB, email: null, linked: false, psn: null },
      enrichmentKeys: NO_ENRICHMENT_KEYS,
      schedule: null,
      preferences: null,
      trophySummary: null,
      identity: null,
      friendRequests: null,
      presence: null,
      devices: null,
      consoles: [],
      ...overrides,
    };
  }

  function createWith(overrides: Partial<ResolvedPsnStatus> = {}): ComponentFixture<PsnSettingsComponent> {
    routeSnapshotData.status = resolved(overrides);
    const fixture = TestBed.createComponent(PsnSettingsComponent);
    fixture.detectChanges();
    return fixture;
  }

  function createAndLoad(response: MeResponse | null): ComponentFixture<PsnSettingsComponent> {
    if (response === null) {
      return createWith({ status: null });
    }
    return createWith({ status: response, preferences: response.linked ? ALL_PREFS_OFF : null });
  }

  it('treats a 404 refresh-schedule as "not opted in yet", not as an error on the page', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: true, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#schedule-none')).not.toBeNull();
    expect(compiled.querySelector('#schedule-error')).toBeNull();
  });

  it('offers the schedule and enrichment-key controls with no PSN account linked', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#schedule-save')).not.toBeNull();
    expect(compiled.querySelector('#psn-enrichment-keys-card')).not.toBeNull();
  });

  it('offers every cadence RefreshCadence declares, in ascending interval order', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    const select = (fixture.nativeElement as HTMLElement).querySelector('#schedule-cadence');
    const options = Array.from(select?.querySelectorAll('option') ?? []);

    expect(options.map((option) => option.getAttribute('value'))).toEqual([RefreshCadences.daily, RefreshCadences.weekly, RefreshCadences.monthly]);
    expect(options.map((option) => option.textContent?.trim())).toEqual(Object.values(RefreshCadences).map((cadence) => REFRESH_CADENCE_LABELS[cadence]));
  });

  it('states what a scheduled run spends, at the point of scheduling', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    const cost = (fixture.nativeElement as HTMLElement).querySelector('#schedule-cost')?.textContent;

    expect(cost).toBe(SCHEDULE_COST_MESSAGE);
    expect(cost).toContain(ProviderNames.openCritic);
    expect(cost).toContain(ProviderNames.rawg);
  });

  it('still gates the harvest preferences behind a PSN link', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    expect((fixture.nativeElement as HTMLElement).querySelector('#pref-trophies')).toBeNull();
  });

  it('shows the stored cadence and next run, and offers a cancel, once a schedule exists', () => {
    const fixture = createWith({
      status: { sub: SUB, email: null, linked: true, psn: null },
      preferences: ALL_PREFS_OFF,
      schedule: {
        cadence: RefreshCadences.monthly,
        ps_plus_watch: true,
        next_run_at: newUtcInstant(),
        last_run_at: newUtcInstant(),
        consecutive_failures: 0,
        paused_reason: null,
      },
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#schedule-next-run')).not.toBeNull();
    expect(compiled.querySelector('#schedule-last-run')).not.toBeNull();
    expect(compiled.querySelector('#schedule-cancel')).not.toBeNull();
    expect(compiled.querySelector('#schedule-none')).toBeNull();
  });

  it('explains a paused chain in terms of the remedy, rather than echoing the stored reason', () => {
    const fixture = createWith({
      status: { sub: SUB, email: null, linked: true, psn: null },
      preferences: ALL_PREFS_OFF,
      schedule: {
        cadence: RefreshCadences.weekly,
        ps_plus_watch: false,
        next_run_at: newUtcInstant(),
        last_run_at: null,
        consecutive_failures: newCount(),
        paused_reason: SchedulePausedReasons.psnLinkExpired,
      },
    });

    const paused = (fixture.nativeElement as HTMLElement).querySelector('#schedule-paused');
    expect(paused?.textContent).toContain(SCHEDULE_PAUSED_LABELS[SchedulePausedReasons.psnLinkExpired]);
    expect(paused?.textContent).not.toContain(SchedulePausedReasons.psnLinkExpired);
  });

  it('shows the link form once loaded when no PSN account is linked', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#npsso')).not.toBeNull();
    expect(compiled.querySelector('#psn-link-submit')).not.toBeNull();
  });

  it('shows linked status with re-authentication metadata when linked', () => {
    const fixture = createAndLoad({
      sub: SUB,
      email: EMAIL,
      linked: true,
      psn: { access_token_expires_at: newUtcInstant(), refresh_token_expires_at: newUtcInstant() },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-linked-badge')).not.toBeNull();
    expect(compiled.querySelector('#psn-link-renewal')).not.toBeNull();
    expect(compiled.querySelector('#psn-unlink')).not.toBeNull();
  });

  it('shows linked status without re-authentication metadata when no expiry is known', () => {
    const fixture = createAndLoad({
      sub: SUB,
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-linked-badge')).not.toBeNull();
    expect(compiled.querySelector('#psn-link-renewal')).toBeNull();
  });

  it('shows a no-refresh-token warning with the access token expiry when PSN issued no refresh token', () => {
    const fixture = createAndLoad({
      sub: SUB,
      email: EMAIL,
      linked: true,
      psn: { access_token_expires_at: newUtcInstant(), refresh_token_expires_at: null },
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-linked-badge')).not.toBeNull();
    expect(compiled.querySelector('#psn-link-renewal')).toBeNull();
    expect(compiled.querySelector('#psn-no-refresh-token-warning')).not.toBeNull();
  });

  it('shows an error and still falls back to the link form when the resolver could not load status', () => {
    const fixture = createAndLoad(null);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#npsso')).not.toBeNull();
    expect(compiled.textContent).toContain(LINK_STATUS_LOAD_ERROR);
  });

  it('link() shows a validation error and makes no request when the NPSSO field is empty', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    harness(fixture).link();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(NPSSO_REQUIRED_ERROR);
    httpMock.expectNone(CuratorApi.psnLink);
  });

  it('link() posts the trimmed NPSSO token, clears it, reloads status, and drops the shared /me cache on success', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(`  ${VALID_NPSSO}  `);

    h.link();
    fixture.detectChanges();

    const linkReq = httpMock.expectOne(CuratorApi.psnLink);
    expect(linkReq.request.method).toBe(HttpMethods.post);
    expect(linkReq.request.body).toEqual({ npsso: VALID_NPSSO });
    linkReq.flush({});

    const reloadReq = httpMock.expectOne(CuratorApi.me);
    reloadReq.flush({ sub: SUB, email: null, linked: true, psn: null });
    fixture.detectChanges();

    httpMock.expectOne(CuratorApi.mePsnPreferences).flush(ALL_PREFS_OFF);
    httpMock.expectNone(CuratorApi.meEnrichmentKeys);
    httpMock.expectNone(CuratorApi.meRefreshSchedule);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(PSN_LINKED_MESSAGE);
    expect(compiled.querySelector('#psn-linked-badge')).not.toBeNull();
    expect(invalidateMe).toHaveBeenCalled();
  });

  it('link() surfaces a generic error message when the request fails with no known error code', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(VALID_NPSSO);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(null, statusOf(HttpStatusCode.Unauthorized));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain(GENERIC_LINK_ERROR_MESSAGE);
    expect(invalidateMe).not.toHaveBeenCalled();
  });

  it('link() rejects a token that is not exactly 64 characters without making a request', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(lowercaseToken(NPSSO_LENGTH - 1));

    h.link();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      npssoLengthError(NPSSO_LENGTH - 1),
    );
    httpMock.expectNone(CuratorApi.psnLink);
  });

  it('link() sends a JSON-blob npsso through without applying the length check', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    const blob = `{"npsso":"${VALID_NPSSO}"}`;
    h.npsso.set(blob);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    expect(req.request.body).toEqual({ npsso: blob });
  });

  it('link() surfaces a token-rejected message when PSN refuses the NPSSO token', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(VALID_NPSSO);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(
      { detail: { error: PsnLinkErrorCodes.authFailed, message: newText() } },
      statusOf(HttpStatusCode.Unauthorized),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      LINK_ERROR_MESSAGES[PsnLinkErrorCodes.authFailed],
    );
  });

  it('link() surfaces a malformed-token message when Curator cannot parse the NPSSO input', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(`{"npsso":${newText()}}`);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(
      { detail: { error: PsnLinkErrorCodes.invalidNpsso, message: newText() } },
      statusOf(HttpStatusCode.BadRequest),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      LINK_ERROR_MESSAGES[PsnLinkErrorCodes.invalidNpsso],
    );
  });

  it('link() surfaces an email-mismatch message when the account emails do not match', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(VALID_NPSSO);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(
      { detail: { error: PsnLinkErrorCodes.mismatch, message: newText() } },
      statusOf(HttpStatusCode.Conflict),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(LINK_ERROR_MESSAGES[PsnLinkErrorCodes.mismatch]);
  });

  it('link() surfaces an unverified-email message when the PSN account email is not verified', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(VALID_NPSSO);

    h.link();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(
      { detail: { error: PsnLinkErrorCodes.unverified, message: newText() } },
      statusOf(HttpStatusCode.Conflict),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(LINK_ERROR_MESSAGES[PsnLinkErrorCodes.unverified]);
  });

  it('unlink() deletes the PSN link, reloads status, and drops the shared /me cache on success', () => {
    const fixture = createAndLoad({
      sub: SUB,
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });

    harness(fixture).unlink();
    fixture.detectChanges();

    const unlinkReq = httpMock.expectOne(CuratorApi.psnLink);
    expect(unlinkReq.request.method).toBe(HttpMethods.delete);
    unlinkReq.flush({});

    const reloadReq = httpMock.expectOne(CuratorApi.me);
    reloadReq.flush({ sub: SUB, email: null, linked: false, psn: null });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(PSN_UNLINKED_MESSAGE);
    expect(compiled.querySelector('#npsso')).not.toBeNull();
    expect(invalidateMe).toHaveBeenCalled();
  });

  it('unlink() surfaces an error message when the request fails', () => {
    const fixture = createAndLoad({
      sub: SUB,
      email: null,
      linked: true,
      psn: { access_token_expires_at: null, refresh_token_expires_at: null },
    });

    harness(fixture).unlink();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.psnLink);
    req.flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain(PSN_UNLINK_ERROR);
  });

  it('shows a "View my action history" button initially, with no request fired', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    expect((fixture.nativeElement as HTMLElement).querySelector('#psn-action-history-load')).not.toBeNull();
    httpMock.expectNone(CuratorApi.meActions);
  });

  it('loads and renders the action history on click', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne(CuratorApi.meActions);
    req.flush({
      actions: [{ action: ACTION_NAME, detail: null, occurred_at: newUtcInstant(), outcome: AccountActionOutcomes.failed }],
    });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(ACTION_NAME);
    expect(compiled.querySelector('#psn-action-history-outcome-0')?.textContent?.trim()).toBe(AccountActionOutcomes.failed);
    expect(compiled.querySelector('#psn-action-history-download')).not.toBeNull();
  });

  it('shows a message when there is no history yet', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne(CuratorApi.meActions);
    req.flush({ actions: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#psn-action-history-empty')).not.toBeNull();
  });

  it('surfaces an error message when loading the action history fails', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });

    harness(fixture).loadMyActions();
    const req = httpMock.expectOne(CuratorApi.meActions);
    req.flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain(ACTION_HISTORY_LOAD_ERROR);
  });

  it(`shows a "Delete my data" button that requires confirmation before calling DELETE ${CuratorApi.me}`, () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-delete-request')).not.toBeNull();
    httpMock.expectNone(CuratorApi.me);

    harness(fixture).requestDeleteMyData();
    fixture.detectChanges();

    expect(compiled.querySelector('#psn-delete-confirm-prompt')).not.toBeNull();
    httpMock.expectNone(CuratorApi.me);
  });

  it('cancelDeleteMyData() backs out of the confirmation without deleting anything', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    fixture.detectChanges();
    h.cancelDeleteMyData();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#psn-delete-confirm-prompt')).toBeNull();
    httpMock.expectNone(CuratorApi.me);
  });

  it('confirmDeleteMyData() deletes the account, shows a confirmation message, and drops the shared /me cache', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    h.confirmDeleteMyData();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.me);
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null, statusOf(HttpStatusCode.NoContent));
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#psn-deleted-notice')).not.toBeNull();
    expect(invalidateMe).toHaveBeenCalled();
  });

  it('confirmDeleteMyData() surfaces an error message when the request fails', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);

    h.requestDeleteMyData();
    h.confirmDeleteMyData();
    fixture.detectChanges();

    const req = httpMock.expectOne(CuratorApi.me);
    req.flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain(ACCOUNT_DELETE_ERROR);
  });

  const LINKED_STATUS: MeResponse = {
    sub: SUB,
    email: null,
    linked: true,
    psn: { access_token_expires_at: null, refresh_token_expires_at: null },
  };

  const TROPHY_SUMMARY = {
    level: newCount(),
    progress: newPercent(),
    tier: newCount(),
    earned: { bronze: newCount(), silver: newCount(), gold: newCount(), platinum: newCount() },
    account_id: ACCOUNT_ID,
  };

  function createLinkedWithPreferences(
    prefs: Record<keyof PsnPreferencesResponse, boolean>,
    friendRequests: { requests: { online_id: string | null; account_id: string }[] } = NO_FRIEND_REQUESTS,
  ): ComponentFixture<PsnSettingsComponent> {
    return createWith({
      status: LINKED_STATUS,
      preferences: prefs,
      trophySummary: prefs.harvest_trophies ? TROPHY_SUMMARY : null,
      identity: prefs.harvest_identity ? PSN_IDENTITY : null,
      friendRequests: prefs.harvest_identity ? friendRequests.requests : null,
      presence: prefs.harvest_presence ? PSN_PRESENCE : null,
      devices: prefs.harvest_devices ? NO_DEVICES : null,
    });
  }

  it('renders the harvest panel with no category card when every flag is off', () => {
    const fixture = createAndLoad(LINKED_STATUS);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-data-sharing-card')).not.toBeNull();
    expect(compiled.querySelectorAll('[id^="psn-card-"], #friend-requests').length).toBe(0);
  });

  it('shows the profile-settings cross-reference copy near the harvest toggles, linking to /profile/settings', () => {
    const fixture = createAndLoad(LINKED_STATUS);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-public-profile-note')).not.toBeNull();
    const link = compiled.querySelector('#psn-profile-settings-link');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain(PageTitles.profileSettings);
  });

  it('never renders a region field anywhere on the page, including the PSN Identity card', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#psn-card-identity')?.textContent).toContain(ONLINE_ID);
    expect(compiled.textContent).not.toContain(REGION);
  });

  it('renders a card for each category the resolver supplied, and none for the rest', () => {
    const preferences: PsnPreferencesResponse = {
      harvest_trophies: true,
      harvest_identity: false,
      harvest_presence: true,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    };
    const fixture = createLinkedWithPreferences(preferences);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelectorAll('[id^="psn-card-"], #friend-requests').length).toBe(enabledHarvestCategoryCount(preferences));
    expect(compiled.textContent).toContain(`Level ${TROPHY_SUMMARY.level}`);
    expect(compiled.textContent).toContain(PRESENCE_STATUS);
  });

  it('onToggle sends a PUT with all current preference flags, not just the one being changed', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: true,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });

    harness(fixture).onToggle(PsnPreferenceKeys.harvestTrophies, true);

    const req = httpMock.expectOne(CuratorApi.mePsnPreferences);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({
      harvest_trophies: true,
      harvest_identity: true,
      harvest_presence: false,
      harvest_devices: true,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    req.flush(null, statusOf(HttpStatusCode.NoContent));
    httpMock.expectOne(CuratorApi.trophiesSummary).flush(TROPHY_SUMMARY);
  });

  it('renders the friend-writes and chat-writes toggles unchecked by default, with disclosure copy', () => {
    const fixture = createAndLoad(LINKED_STATUS);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector<HTMLInputElement>('#pref-friend-writes')?.checked).toBe(false);
    expect(compiled.querySelector<HTMLInputElement>('#pref-chat-writes')?.checked).toBe(false);
    expect(compiled.querySelector('#pref-friend-writes-disclosure')?.textContent).toBe(FRIEND_WRITES_DISCLOSURE);
    expect(compiled.querySelector('#pref-chat-writes-disclosure')?.textContent).toBe(CHAT_WRITES_DISCLOSURE);
    expect(compiled.querySelector('#psn-account-changes-note')?.textContent).toBe(ACCOUNT_CHANGES_MESSAGE);
  });

  it('onToggle for allow_friend_writes sends a PUT with all current flags and triggers no per-category GET', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });

    harness(fixture).onToggle(PsnPreferenceKeys.allowFriendWrites, true);

    const req = httpMock.expectOne(CuratorApi.mePsnPreferences);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: true,
      allow_chat_writes: false,
    });
    req.flush(null, statusOf(HttpStatusCode.NoContent));
    httpMock.expectNone(CuratorApi.trophiesSummary);
    httpMock.expectNone(CuratorApi.identity);
    httpMock.expectNone(CuratorApi.presence);
    httpMock.expectNone(CuratorApi.devices);
  });

  describe('the device-link select, the one control on the page with no ngModel', () => {
    const UNLINKED_DEVICE = {
      device_id: DEVICE_ID,
      device_type: ConsolePlatforms.ps5,
      device_name: newText(),
      activation_type: newText(),
      activation_date: null,
      deactivation_date: null,
      linked_console_id: null,
    };
    const CONSOLE = {
      console_id: CONSOLE_ID,
      name: newText(),
      platform: ConsolePlatforms.ps5,
      raw_capacity_gb: newCount(),
      model: null,
      update_buffer_gb: 0,
      effective_capacity_gb: newCount(),
      routing_genres: [],
      fill_order: 1,
      capacity_is_default: false,
      device_link: null,
    };

    function createWithAnUnlinkedDevice(): ComponentFixture<PsnSettingsComponent> {
      return createWith({
        status: LINKED_STATUS,
        preferences: {
          harvest_trophies: false,
          harvest_identity: false,
          harvest_presence: false,
          harvest_devices: true,
          allow_friend_writes: false,
          allow_chat_writes: false,
        },
        devices: { devices: [UNLINKED_DEVICE] },
        consoles: [CONSOLE],
      });
    }

    function press(fixture: ComponentFixture<PsnSettingsComponent>, selector: string): void {
      fixture.nativeElement.querySelector(selector).click();
      fixture.detectChanges();
    }

    function choose(fixture: ComponentFixture<PsnSettingsComponent>, consoleId: string): void {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#device-link-select-0');
      select.value = consoleId;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('offers a Link control rather than a bare select, so choosing an option cannot act on its own', () => {
      const fixture = createWithAnUnlinkedDevice();
      const compiled: HTMLElement = fixture.nativeElement;

      expect(
        compiled.querySelector('#device-link-select-0'),
        'The select must stay closed until asked for. A select that links on (change) fires a server mutation from a keyboard arrow press, and the success path then flips the @if branch and removes the control the reader was operating.',
      ).toBeNull();
      expect(compiled.querySelector('#device-link-start-0')).not.toBeNull();
    });

    it('binds the unchosen option to null, not to an empty string', async () => {
      const fixture = createWithAnUnlinkedDevice();
      press(fixture, '#device-link-start-0');
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('#device-link-select-0');

      expect(select.options[0].value, 'CODE-STYLE rule 1: absence is null, and [ngValue] is what carries it').not.toBe('');
      expect(select.options[0].textContent).toBe(DEVICE_LINK_PLACEHOLDER);
      expect(select.value).toBe(select.options[0].value);
    });

    it('sends nothing and says why when Link is pressed with no console chosen', () => {
      const fixture = createWithAnUnlinkedDevice();
      press(fixture, '#device-link-start-0');

      press(fixture, '#device-link-confirm-0');

      httpMock.expectNone(CuratorApi.consolesByConsoleIdDeviceLink(CONSOLE_ID));
      expect(fixture.nativeElement.textContent).toContain(DEVICE_LINK_CONSOLE_REQUIRED_ERROR);
    });

    it('sends nothing when the reader cancels, and closes the control', () => {
      const fixture = createWithAnUnlinkedDevice();
      press(fixture, '#device-link-start-0');
      choose(fixture, CONSOLE_ID);

      press(fixture, '#device-link-cancel-0');

      httpMock.expectNone(CuratorApi.consolesByConsoleIdDeviceLink(CONSOLE_ID));
      expect(fixture.nativeElement.querySelector('#device-link-select-0')).toBeNull();
    });

    it('links the device only once the reader presses Link', () => {
      const fixture = createWithAnUnlinkedDevice();
      press(fixture, '#device-link-start-0');

      choose(fixture, CONSOLE_ID);
      httpMock.expectNone(CuratorApi.consolesByConsoleIdDeviceLink(CONSOLE_ID));

      press(fixture, '#device-link-confirm-0');

      const request = httpMock.expectOne(CuratorApi.consolesByConsoleIdDeviceLink(CONSOLE_ID));
      expect(request.request.method).toBe(HttpMethods.put);
      expect(request.request.body).toEqual({ device_id: DEVICE_ID });
      request.flush(null, statusOf(HttpStatusCode.NoContent));
      flushBothHalvesOfTheDeviceCardReload();
    });

    function flushBothHalvesOfTheDeviceCardReload(): void {
      httpMock.expectOne(CuratorApi.devices).flush({ devices: [UNLINKED_DEVICE] });
      httpMock.expectOne(CuratorApi.consoles).flush([CONSOLE]);
    }
  });

  it('onToggle for allow_chat_writes checks the box optimistically and reverts it if the PUT fails', async () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle(PsnPreferenceKeys.allowChatWrites, true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLInputElement>('#pref-chat-writes')?.checked).toBe(true);

    const putReq = httpMock.expectOne(CuratorApi.mePsnPreferences);
    putReq.flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#pref-chat-writes')?.checked).toBe(false);
    expect(compiled.textContent).toContain(PREFERENCE_UPDATE_ERROR);
  });

  it('toggling a category on optimistically checks the box, fires its GET, and renders its card on success', async () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const h = harness(fixture);

    h.onToggle(PsnPreferenceKeys.harvestTrophies, true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.disabled).toBe(true);

    const putReq = httpMock.expectOne(CuratorApi.mePsnPreferences);
    putReq.flush(null, statusOf(HttpStatusCode.NoContent));
    fixture.detectChanges();

    const getReq = httpMock.expectOne(CuratorApi.trophiesSummary);
    getReq.flush(TROPHY_SUMMARY);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(compiled.querySelector('#psn-card-trophies')).not.toBeNull();
    expect(compiled.textContent).toContain(`Level ${TROPHY_SUMMARY.level}`);
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.disabled).toBe(false);
  });

  it('toggling a category off clears its data and hides the card without a new GET', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: true,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#psn-card-trophies')).not.toBeNull();

    h.onToggle(PsnPreferenceKeys.harvestTrophies, false);
    fixture.detectChanges();

    const putReq = httpMock.expectOne(CuratorApi.mePsnPreferences);
    putReq.flush(null, statusOf(HttpStatusCode.NoContent));
    fixture.detectChanges();

    expect(compiled.querySelector('[id^="psn-card-"], #friend-requests')).toBeNull();
    httpMock.expectNone(CuratorApi.trophiesSummary);
  });

  it('reverts the optimistic toggle and shows an error when the PUT fails', async () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle(PsnPreferenceKeys.harvestTrophies, true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(true);

    const putReq = httpMock.expectOne(CuratorApi.mePsnPreferences);
    putReq.flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#pref-trophies')?.checked).toBe(false);
    expect(compiled.textContent).toContain(PREFERENCE_UPDATE_ERROR);
    expect(compiled.querySelector('[id^="psn-card-"], #friend-requests')).toBeNull();
    httpMock.expectNone(CuratorApi.trophiesSummary);
  });

  it('renders no friend-requests list while identity harvesting is off', () => {
    const fixture = createAndLoad(LINKED_STATUS);

    expect((fixture.nativeElement as HTMLElement).querySelector('#friend-requests')).toBeNull();
  });

  it('says nobody is waiting rather than rendering an empty list', () => {
    const fixture = createLinkedWithPreferences(IDENTITY_ONLY);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#friend-requests')).not.toBeNull();
    expect(compiled.querySelector('#friend-requests-empty')).not.toBeNull();
    expect(compiled.querySelector('#friend-request-accept-0')).toBeNull();
  });

  it('names a requester by their online id, falling back to the account id PSN disclosed', () => {
    const fixture = createLinkedWithPreferences(IDENTITY_ONLY, {
      requests: [
        { online_id: REQUESTER_ONLINE_ID, account_id: newId() },
        { online_id: null, account_id: REQUESTER_ACCOUNT_ID },
      ],
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#friend-request-0')?.textContent).toContain(REQUESTER_ONLINE_ID);
    expect(compiled.querySelector('#friend-request-1')?.textContent).toContain(REQUESTER_ACCOUNT_ID);
    expect(
      compiled.querySelector('#friend-request-accept-1'),
      'PSN takes an online id to accept, so a request with none has nothing to send and must offer no button',
    ).toBeNull();
  });

  it('withholds the accept control until the friend-writes consent is given', () => {
    const fixture = createLinkedWithPreferences(IDENTITY_ONLY, {
      requests: [{ online_id: REQUESTER_ONLINE_ID, account_id: newId() }],
    });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector<HTMLButtonElement>('#friend-request-accept-0')?.disabled).toBe(true);
    expect(compiled.querySelector('#friend-requests-consent')).not.toBeNull();
  });

  it('accepts a request through the friends route and drops it from the list', () => {
    const fixture = createLinkedWithPreferences(
      { ...IDENTITY_ONLY, allow_friend_writes: true },
      { requests: [{ online_id: REQUESTER_ONLINE_ID, account_id: newId() }] },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#friend-request-accept-0')?.click();
    fixture.detectChanges();

    const accept = httpMock.expectOne(CuratorApi.meFriendsByOnlineId(REQUESTER_ONLINE_ID));
    expect(accept.request.method).toBe(HttpMethods.put);
    accept.flush(null, statusOf(HttpStatusCode.NoContent));
    fixture.detectChanges();

    expect(compiled.querySelector('#friend-request-accepted')?.textContent).toContain(REQUESTER_ONLINE_ID);
    expect(compiled.querySelector('#friend-request-accept-0')).toBeNull();
    expect(compiled.querySelector('#friend-requests-empty')).not.toBeNull();
  });

  it('keeps a request that could not be accepted, and says which one failed', () => {
    const fixture = createLinkedWithPreferences(
      { ...IDENTITY_ONLY, allow_friend_writes: true },
      { requests: [{ online_id: REQUESTER_ONLINE_ID, account_id: newId() }] },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    compiled.querySelector<HTMLButtonElement>('#friend-request-accept-0')?.click();
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.meFriendsByOnlineId(REQUESTER_ONLINE_ID)).flush(null, statusOf(HttpStatusCode.InternalServerError));
    fixture.detectChanges();

    expect(compiled.querySelector('#friend-requests-error')?.textContent).toContain(REQUESTER_ONLINE_ID);
    expect(compiled.querySelector('#friend-request-accept-0')).not.toBeNull();
  });

  it('the post-link card states what each data-sharing toggle is currently set to', () => {
    const fixture = createAndLoad({ sub: SUB, email: null, linked: false, psn: null });
    const h = harness(fixture);
    h.npsso.set(VALID_NPSSO);

    h.link();
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.psnLink).flush({});
    httpMock.expectOne(CuratorApi.me).flush({ sub: SUB, email: null, linked: true, psn: null });
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.mePsnPreferences).flush({ ...ALL_PREFS_OFF, harvest_trophies: true });
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.trophiesSummary).flush(TROPHY_SUMMARY);
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('#psn-link-success');
    expect(
      card,
      'linking reads nothing on its own, so the success card is where a new user learns that every '
        + 'harvest is still off and where it is turned on',
    ).not.toBeNull();
    expect(card?.querySelector('#psn-link-success-trophies')?.getAttribute('data-enabled')).toBe(String(true));
    expect(card?.querySelector('#psn-link-success-identity')?.getAttribute('data-enabled')).toBe(String(false));
    expect(card?.querySelector('#psn-link-success-devices')?.getAttribute('data-enabled')).toBe(String(false));
  });

  it('the loading overlay is visible during linking, unlinking, and a preference save, and hidden otherwise', () => {
    const fixture = createLinkedWithPreferences({
      harvest_trophies: false,
      harvest_identity: false,
      harvest_presence: false,
      harvest_devices: false,
      allow_friend_writes: false,
      allow_chat_writes: false,
    });
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#loading-overlay')).toBeNull();

    h.onToggle(PsnPreferenceKeys.harvestTrophies, true);
    fixture.detectChanges();
    expect(compiled.querySelector('#loading-overlay')).not.toBeNull();

    const putReq = httpMock.expectOne(CuratorApi.mePsnPreferences);
    putReq.flush(null, statusOf(HttpStatusCode.NoContent));
    fixture.detectChanges();
    httpMock.expectOne(CuratorApi.trophiesSummary).flush(TROPHY_SUMMARY);
    fixture.detectChanges();

    expect(compiled.querySelector('#loading-overlay')).toBeNull();

    h.unlink();
    fixture.detectChanges();
    expect(compiled.querySelector('#loading-overlay')).not.toBeNull();

    const unlinkReq = httpMock.expectOne(CuratorApi.psnLink);
    unlinkReq.flush({});
    const reloadReq = httpMock.expectOne(CuratorApi.me);
    reloadReq.flush({ sub: SUB, email: null, linked: false, psn: null });
    fixture.detectChanges();

    expect(compiled.querySelector('#loading-overlay')).toBeNull();
  });

  describe('enrichment API keys', () => {
    function createLinkedWithEnrichmentKeys(
      status: Partial<{
        rawg_configured: boolean;
        opencritic_configured: boolean;
        rawg_key_rejected_at: string | null;
        opencritic_key_rejected_at: string | null;
      }>,
    ): ComponentFixture<PsnSettingsComponent> {
      return createWith({
        status: LINKED_STATUS,
        preferences: ALL_PREFS_OFF,
        enrichmentKeys: {
          rawg_configured: false,
          opencritic_configured: false,
          rawg_added_at: null,
          opencritic_added_at: null,
          rawg_key_rejected_at: null,
          opencritic_key_rejected_at: null,
          ...status,
        },
      });
    }

    it('shows both providers as not configured, with input forms, when neither key is set', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#rawg-key')).not.toBeNull();
      expect(compiled.querySelector('#opencritic-key')).not.toBeNull();
      expect(compiled.querySelector('#psn-rawg-key-get')).not.toBeNull();
      expect(compiled.querySelector('#psn-opencritic-key-get')).not.toBeNull();
    });

    it('shows a configured provider with a remove button, not an input, and hides the get-a-key link', () => {
      const fixture = createLinkedWithEnrichmentKeys({ rawg_configured: true });
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#rawg-key')).toBeNull();
      expect(compiled.querySelector('#psn-rawg-key-configured')).not.toBeNull();
      expect(compiled.querySelector('#psn-rawg-key-get')).toBeNull();
      expect(compiled.querySelector('#opencritic-key')).not.toBeNull();
      expect(compiled.querySelector('#psn-opencritic-key-get')).not.toBeNull();
    });

    it('shows a "stopped working" warning and a re-enter input when a configured RAWG key was rejected', () => {
      const fixture = createLinkedWithEnrichmentKeys({
        rawg_configured: true,
        rawg_key_rejected_at: newUtcInstant(),
      });
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#psn-rawg-key-rejected')).not.toBeNull();
      expect(compiled.querySelector('#psn-rawg-key-configured')).not.toBeNull();
      expect(compiled.querySelector('#rawg-key')).not.toBeNull();
      expect(compiled.querySelector('#psn-rawg-key-reenter')).not.toBeNull();
      expect(compiled.querySelector('#psn-opencritic-key-rejected')).toBeNull();
    });

    it('a configured, non-rejected key shows no "stopped working" warning', () => {
      const fixture = createLinkedWithEnrichmentKeys({ rawg_configured: true, opencritic_configured: true });
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#psn-rawg-key-rejected')).toBeNull();
      expect(compiled.querySelector('#psn-opencritic-key-rejected')).toBeNull();
    });

    it('setRawgKey() shows a validation error and makes no request when the field is empty', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      harness(fixture).setRawgKey();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(RAWG_KEY_REQUIRED_ERROR);
      httpMock.expectNone(CuratorApi.meEnrichmentKeysRawg);
    });

    it('setRawgKey() PUTs the key, clears the input, and refreshes status on success', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set(`  ${RAWG_KEY}  `);

      h.setRawgKey();
      fixture.detectChanges();

      const putReq = httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg);
      expect(putReq.request.method).toBe(HttpMethods.put);
      expect(putReq.request.body).toEqual({ api_key: RAWG_KEY });
      putReq.flush(null, statusOf(HttpStatusCode.NoContent));

      httpMock
        .expectOne(CuratorApi.meEnrichmentKeys)
        .flush({ rawg_configured: true, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('#psn-rawg-key-configured')).not.toBeNull();
    });

    it('setRawgKey() surfaces an error and leaves the input state on failure', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set(newText());

      h.setRawgKey();
      fixture.detectChanges();

      httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg).flush(null, statusOf(HttpStatusCode.InternalServerError));
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(RAWG_KEY_SAVE_ERROR);
    });

    it('deleteRawgKey() DELETEs and refreshes status, leaving OpenCritic untouched', () => {
      const fixture = createLinkedWithEnrichmentKeys({ rawg_configured: true, opencritic_configured: true });
      harness(fixture).deleteRawgKey();
      fixture.detectChanges();

      const deleteReq = httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg);
      expect(deleteReq.request.method).toBe(HttpMethods.delete);
      deleteReq.flush(null, statusOf(HttpStatusCode.NoContent));

      httpMock.expectOne(CuratorApi.meEnrichmentKeys).flush({
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
      h.opencriticKeyInput.set(OPENCRITIC_KEY);

      h.setOpenCriticKey();
      fixture.detectChanges();

      const putReq = httpMock.expectOne(CuratorApi.meEnrichmentKeysOpencritic);
      expect(putReq.request.method).toBe(HttpMethods.put);
      expect(putReq.request.body).toEqual({ api_key: OPENCRITIC_KEY });
      putReq.flush(null, statusOf(HttpStatusCode.NoContent));

      httpMock
        .expectOne(CuratorApi.meEnrichmentKeys)
        .flush({ rawg_configured: false, opencritic_configured: true, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('#psn-opencritic-key-configured')).not.toBeNull();
    });

    it('the key value is never rendered in the DOM, before or after saving', () => {
      const fixture = createLinkedWithEnrichmentKeys({});
      const h = harness(fixture);
      h.rawgKeyInput.set(SECRET_KEY);

      h.setRawgKey();
      fixture.detectChanges();

      httpMock.expectOne(CuratorApi.meEnrichmentKeysRawg).flush(null, statusOf(HttpStatusCode.NoContent));
      httpMock
        .expectOne(CuratorApi.meEnrichmentKeys)
        .flush({ rawg_configured: true, opencritic_configured: false, rawg_added_at: null, opencritic_added_at: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(SECRET_KEY);
    });
  });
});
