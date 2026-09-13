import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { psnStatusResolver, PsnStatus, ResolvedPsnStatus } from './psn-status.resolver';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DevicesResponse,
  EnrichmentKeyStatusResponse,
  FriendRequestsResponse,
  IdentityResponse,
  PresenceResponse,
  PsnPreferencesResponse,
  RefreshScheduleResponse,
  TrophySummaryResponse,
} from '../curator/curator.models';

const LINKED: PsnStatus = { sub: 'u1', email: 'chris@example.com', linked: true, psn: null };
const UNLINKED: PsnStatus = { sub: 'u1', email: 'chris@example.com', linked: false, psn: null };

const ENRICHMENT_KEYS = { rawg_configured: true } as unknown as EnrichmentKeyStatusResponse;
const SCHEDULE = { cadence: 'weekly', ps_plus_watch: false } as unknown as RefreshScheduleResponse;
const TROPHY_SUMMARY = { level: 42 } as unknown as TrophySummaryResponse;
const IDENTITY = { online_id: 'chris' } as unknown as IdentityResponse;
const PRESENCE = { availability: 'availableToPlay' } as unknown as PresenceResponse;
const DEVICES = { devices: [] } as unknown as DevicesResponse;
const CONSOLES = [{ console_id: 'c1' }] as unknown as ConsoleResponse[];
const FRIEND_REQUEST = { online_id: 'someone', account_id: 'a1' };
const FRIEND_REQUESTS: FriendRequestsResponse = { requests: [FRIEND_REQUEST] };

const ALL_PREFERENCES_OFF: PsnPreferencesResponse = {
  harvest_trophies: false,
  harvest_identity: false,
  harvest_presence: false,
  harvest_devices: false,
  allow_friend_writes: false,
  allow_chat_writes: false,
};

const EVERY_PREFERENCE_ON: PsnPreferencesResponse = {
  harvest_trophies: true,
  harvest_identity: true,
  harvest_presence: true,
  harvest_devices: true,
  allow_friend_writes: true,
  allow_chat_writes: true,
};

const fails = () => throwError(() => new HttpErrorResponse({ status: 500 }));
const notFound = () => throwError(() => new HttpErrorResponse({ status: 404 }));

function stubs(overrides: Partial<CuratorService> = {}): Partial<CuratorService> {
  return {
    getEnrichmentKeyStatus: () => of(ENRICHMENT_KEYS),
    getRefreshSchedule: () => of(SCHEDULE),
    getPsnPreferences: () => of(ALL_PREFERENCES_OFF),
    getTrophySummary: () => of(TROPHY_SUMMARY),
    getIdentity: () => of(IDENTITY),
    getFriendRequests: () => of(FRIEND_REQUESTS),
    getPresence: () => of(PRESENCE),
    getDevices: () => of(DEVICES),
    listConsoles: () => of(CONSOLES),
    ...overrides,
  };
}

function run(me: PsnStatus | null, curator: Partial<CuratorService>): Promise<ResolvedPsnStatus> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      { provide: CuratorService, useValue: curator },
    ],
  });
  const httpMock = TestBed.inject(HttpTestingController);

  const resolved = new Promise<ResolvedPsnStatus>((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (psnStatusResolver({} as never, {} as never) as Observable<ResolvedPsnStatus>).subscribe(resolvePromise);
    });
  });

  const request = httpMock.expectOne('/curator/api/me');
  if (me === null) {
    request.flush(null, { status: 500, statusText: 'Server Error' });
  } else {
    request.flush(me);
  }
  httpMock.verify();

  return resolved;
}

describe('psnStatusResolver', () => {
  it('resolves the account, its enrichment keys and its schedule in one payload', async () => {
    const result = await run(LINKED, stubs());

    expect(result.status).toEqual(LINKED);
    expect(result.enrichmentKeys).toBe(ENRICHMENT_KEYS);
    expect(result.schedule).toBe(SCHEDULE);
  });

  it('spends no PSN category call on an account that is not linked', async () => {
    const asked: string[] = [];
    const result = await run(
      UNLINKED,
      stubs({
        getPsnPreferences: () => {
          asked.push('preferences');
          return of(ALL_PREFERENCES_OFF);
        },
        getTrophySummary: () => {
          asked.push('trophies');
          return of(TROPHY_SUMMARY);
        },
      }),
    );

    expect(asked).toEqual([]);
    expect(result.preferences).toBeNull();
    expect(result.trophySummary).toBeNull();
    expect(result.status).toEqual(UNLINKED);
  });

  it('spends no PSN category call on a category the user has switched off', async () => {
    const asked: string[] = [];
    const result = await run(
      LINKED,
      stubs({
        getTrophySummary: () => {
          asked.push('trophies');
          return of(TROPHY_SUMMARY);
        },
        getIdentity: () => {
          asked.push('identity');
          return of(IDENTITY);
        },
        getPresence: () => {
          asked.push('presence');
          return of(PRESENCE);
        },
        getDevices: () => {
          asked.push('devices');
          return of(DEVICES);
        },
      }),
    );

    expect(asked).toEqual([]);
    expect(result.preferences).toBe(ALL_PREFERENCES_OFF);
    expect(result.identity).toBeNull();
    expect(result.presence).toBeNull();
    expect(result.devices).toBeNull();
  });

  it('resolves every category whose harvest toggle is on', async () => {
    const result = await run(LINKED, stubs({ getPsnPreferences: () => of(EVERY_PREFERENCE_ON) }));

    expect(result.trophySummary).toBe(TROPHY_SUMMARY);
    expect(result.identity).toBe(IDENTITY);
    expect(result.presence).toBe(PRESENCE);
    expect(result.devices).toBe(DEVICES);
  });

  it('unwraps the friend requests to the list the page renders, not the envelope', async () => {
    const result = await run(LINKED, stubs({ getPsnPreferences: () => of(EVERY_PREFERENCE_ON) }));

    expect(result.friendRequests).toEqual([FRIEND_REQUEST]);
  });

  it('asks for no friend requests while identity harvesting is off', async () => {
    let asked = false;
    const result = await run(
      LINKED,
      stubs({
        getFriendRequests: () => {
          asked = true;
          return of(FRIEND_REQUESTS);
        },
      }),
    );

    expect(asked).toBe(false);
    expect(result.friendRequests).toBeNull();
  });

  it('resolves the console list with the devices, so a linked device is named rather than shown as an id', async () => {
    const result = await run(LINKED, stubs({ getPsnPreferences: () => of(EVERY_PREFERENCE_ON) }));

    expect(result.consoles).toBe(CONSOLES);
  });

  it('leaves the console list empty while device harvesting is off', async () => {
    const result = await run(LINKED, stubs());

    expect(result.consoles).toEqual([]);
  });

  it('degrades one failed category to null and still resolves the rest', async () => {
    const result = await run(
      LINKED,
      stubs({ getPsnPreferences: () => of(EVERY_PREFERENCE_ON), getIdentity: fails }),
    );

    expect(result.identity).toBeNull();
    expect(result.trophySummary).toBe(TROPHY_SUMMARY);
    expect(result.presence).toBe(PRESENCE);
  });

  it('reads a 404 refresh schedule as "not opted in yet" rather than an error', async () => {
    const result = await run(LINKED, stubs({ getRefreshSchedule: notFound }));

    expect(result.schedule).toBeNull();
    expect(result.status).toEqual(LINKED);
  });

  it('keeps the rest of the page when the preference lookup itself fails', async () => {
    const result = await run(LINKED, stubs({ getPsnPreferences: fails }));

    expect(result.preferences).toBeNull();
    expect(result.status).toEqual(LINKED);
    expect(result.enrichmentKeys).toBe(ENRICHMENT_KEYS);
  });

  it('degrades every field to null when the account lookup fails, instead of throwing', async () => {
    const result = await run(null, stubs());

    expect(result).toEqual({
      status: null,
      enrichmentKeys: null,
      schedule: null,
      preferences: null,
      trophySummary: null,
      identity: null,
      friendRequests: null,
      presence: null,
      devices: null,
      consoles: [],
    });
  });
});
