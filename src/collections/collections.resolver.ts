import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
  StorageDeviceResponse,
} from '../curator/curator.models';

export interface ResolvedInstalls {
  installedGameIds: string[];
  attachedDevices: StorageDeviceResponse[];
  deviceInstalls: { deviceId: string; gameIds: string[] }[];
}

export const NO_INSTALLS: ResolvedInstalls = {
  installedGameIds: [],
  attachedDevices: [],
  deviceInstalls: [],
};

export type ResolvedCollections =
  | { mode: 'list'; definitions: DefinitionResponse[]; consoles: ConsoleResponse[] }
  | { mode: 'list-error'; consoles: ConsoleResponse[] }
  | {
      mode: 'detail';
      definition: DefinitionDetailResponse;
      consoles: ConsoleResponse[];
      installs: ResolvedInstalls;
    }
  | { mode: 'detail-error'; consoles: ConsoleResponse[] }
  | { mode: 'viewer'; definitions: ProfileDefinitionResponse[]; followedIds: string[] }
  | { mode: 'viewer-forbidden' }
  | { mode: 'viewer-error' };

type Attempt<T> = { ok: true; value: T } | { ok: false };

function attempt<T>(source: Observable<T>): Observable<Attempt<T>> {
  return source.pipe(
    map((value): Attempt<T> => ({ ok: true, value })),
    catchError(() => of<Attempt<T>>({ ok: false })),
  );
}

function consolesBestEffort(curator: CuratorService): Observable<ConsoleResponse[]> {
  return curator.listConsoles().pipe(catchError(() => of<ConsoleResponse[]>([])));
}

export function installConsoleIdFor(definition: DefinitionDetailResponse | null): string | null {
  if (definition === null) {
    return null;
  }
  const target = definition.install_target_console_id ?? null;
  if (target !== null) {
    return target;
  }
  return definition.kind === 'capacity_fill' ? (definition.console_id ?? null) : null;
}

function installsFor(curator: CuratorService, consoleId: string): Observable<ResolvedInstalls> {
  return forkJoin({
    installedGameIds: curator
      .getConsoleInstalls(consoleId)
      .pipe(map((response) => response.game_ids), catchError(() => of<string[]>([]))),
    attachedDevices: curator.listStorageDevices().pipe(
      map((devices) => devices.filter((device) => device.console_id === consoleId)),
      catchError(() => of<StorageDeviceResponse[]>([])),
    ),
  }).pipe(
    switchMap(({ installedGameIds, attachedDevices }) =>
      (attachedDevices.length === 0
        ? of<{ deviceId: string; gameIds: string[] }[]>([])
        : forkJoin(
            attachedDevices.map((device) =>
              curator.getStorageDeviceInstalls(device.device_id).pipe(
                map((response) => ({ deviceId: device.device_id, gameIds: response.game_ids })),
                catchError(() => of({ deviceId: device.device_id, gameIds: [] as string[] })),
              ),
            ),
          )
      ).pipe(map((deviceInstalls) => ({ installedGameIds, attachedDevices, deviceInstalls }))),
    ),
  );
}

export const ownerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const definitionId = route.paramMap.get('definitionId');

  if (definitionId !== null) {
    return forkJoin({
      definition: attempt(curator.getDefinition(definitionId)),
      consoles: consolesBestEffort(curator),
    }).pipe(
      switchMap(({ definition, consoles }) => {
        if (!definition.ok) {
          return of<ResolvedCollections>({ mode: 'detail-error', consoles });
        }
        const consoleId = installConsoleIdFor(definition.value);
        const installs = consoleId === null ? of(NO_INSTALLS) : installsFor(curator, consoleId);
        return installs.pipe(
          map((resolvedInstalls): ResolvedCollections => ({
            mode: 'detail',
            definition: definition.value,
            consoles,
            installs: resolvedInstalls,
          })),
        );
      }),
    );
  }

  return forkJoin({
    definitions: attempt(curator.listDefinitions()),
    consoles: consolesBestEffort(curator),
  }).pipe(
    map(({ definitions, consoles }): ResolvedCollections =>
      definitions.ok ? { mode: 'list', definitions: definitions.value, consoles } : { mode: 'list-error', consoles },
    ),
  );
};

export const viewerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get('sub');
  if (sub === null) {
    return of<ResolvedCollections>({ mode: 'viewer-error' });
  }

  return curator.getUserCollections(sub).pipe(
    switchMap((definitions) =>
      curator.listFollowedCollections().pipe(
        catchError(() => of([])),
        map((followed): ResolvedCollections => ({
          mode: 'viewer',
          definitions,
          followedIds: followed.map((definition) => definition.definition_id),
        })),
      ),
    ),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCollections>(err.status === 403 ? { mode: 'viewer-forbidden' } : { mode: 'viewer-error' }),
    ),
  );
};
