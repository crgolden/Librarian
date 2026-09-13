import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DevicesResponse,
  EnrichmentKeyStatusResponse,
  FriendRequestResponse,
  IdentityResponse,
  PresenceResponse,
  PsnPreferencesResponse,
  RefreshScheduleResponse,
  TrophySummaryResponse,
} from '../curator/curator.models';

export interface PsnStatus {
  sub: string;
  email: string | null;
  linked: boolean;
  psn: { access_token_expires_at: string | null; refresh_token_expires_at: string | null } | null;
}

export interface ResolvedPsnStatus {
  status: PsnStatus | null;
  enrichmentKeys: EnrichmentKeyStatusResponse | null;
  schedule: RefreshScheduleResponse | null;
  preferences: PsnPreferencesResponse | null;
  trophySummary: TrophySummaryResponse | null;
  identity: IdentityResponse | null;
  friendRequests: FriendRequestResponse[] | null;
  presence: PresenceResponse | null;
  devices: DevicesResponse | null;
  consoles: ConsoleResponse[];
}

const NOTHING_LOADED: Omit<ResolvedPsnStatus, 'status' | 'enrichmentKeys' | 'schedule'> = {
  preferences: null,
  trophySummary: null,
  identity: null,
  friendRequests: null,
  presence: null,
  devices: null,
  consoles: [],
};

function categoriesFor(curator: CuratorService, preferences: PsnPreferencesResponse) {
  const absent = <T>() => of<T | null>(null);
  return forkJoin({
    preferences: of<PsnPreferencesResponse | null>(preferences),
    trophySummary: preferences.harvest_trophies
      ? curator.getTrophySummary().pipe(catchError(() => absent<TrophySummaryResponse>()))
      : absent<TrophySummaryResponse>(),
    identity: preferences.harvest_identity
      ? curator.getIdentity().pipe(catchError(() => absent<IdentityResponse>()))
      : absent<IdentityResponse>(),
    friendRequests: preferences.harvest_identity
      ? curator.getFriendRequests().pipe(
          map((response) => response.requests),
          catchError(() => absent<FriendRequestResponse[]>()),
        )
      : absent<FriendRequestResponse[]>(),
    presence: preferences.harvest_presence
      ? curator.getPresence().pipe(catchError(() => absent<PresenceResponse>()))
      : absent<PresenceResponse>(),
    devices: preferences.harvest_devices
      ? curator.getDevices().pipe(catchError(() => absent<DevicesResponse>()))
      : absent<DevicesResponse>(),
    consoles: preferences.harvest_devices
      ? curator.listConsoles().pipe(catchError(() => of<ConsoleResponse[]>([])))
      : of<ConsoleResponse[]>([]),
  });
}

export const psnStatusResolver: ResolveFn<ResolvedPsnStatus> = () => {
  const http = inject(HttpClient);
  const curator = inject(CuratorService);

  return http.get<PsnStatus>('/curator/api/me').pipe(
    switchMap((status) =>
      forkJoin({
        status: of<PsnStatus | null>(status),
        enrichmentKeys: curator.getEnrichmentKeyStatus().pipe(catchError(() => of(null))),
        schedule: curator.getRefreshSchedule().pipe(catchError(() => of(null))),
        categories: status.linked
          ? curator.getPsnPreferences().pipe(
              switchMap((preferences) => categoriesFor(curator, preferences)),
              catchError(() => of(NOTHING_LOADED)),
            )
          : of(NOTHING_LOADED),
      }),
    ),
    map(({ status, enrichmentKeys, schedule, categories }): ResolvedPsnStatus => ({
      status,
      enrichmentKeys,
      schedule,
      ...categories,
    })),
    catchError((_err: HttpErrorResponse) =>
      of<ResolvedPsnStatus>({
        status: null,
        enrichmentKeys: null,
        schedule: null,
        ...NOTHING_LOADED,
      }),
    ),
  );
};
