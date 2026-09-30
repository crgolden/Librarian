import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { CollectionKinds, ConsoleResponse, DefinitionDetailResponse, DefinitionResponse, ProfileDefinitionResponse, StorageDeviceResponse } from '../curator/curator.models';
import { RouteParams } from '../app/app-paths';
import { statusCodeOf } from '../shared/http-status';

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

export const CollectionsModes = {
  list: 'list',
  listError: 'list-error',
  detail: 'detail',
  detailError: 'detail-error',
  viewer: 'viewer',
  viewerForbidden: 'viewer-forbidden',
  viewerError: 'viewer-error',
} as const;

export type ResolvedCollections =
  | { mode: typeof CollectionsModes.list; definitions: DefinitionResponse[]; consoles: ConsoleResponse[] }
  | { mode: typeof CollectionsModes.listError; consoles: ConsoleResponse[] }
  | {
      mode: typeof CollectionsModes.detail;
      definition: DefinitionDetailResponse;
      consoles: ConsoleResponse[];
      installs: ResolvedInstalls;
    }
  | { mode: typeof CollectionsModes.detailError; consoles: ConsoleResponse[] }
  | { mode: typeof CollectionsModes.viewer; definitions: ProfileDefinitionResponse[]; followedIds: string[] }
  | { mode: typeof CollectionsModes.viewerForbidden }
  | { mode: typeof CollectionsModes.viewerError };

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
  return definition.kind === CollectionKinds.capacityFill ? (definition.console_id ?? null) : null;
}

function installsFor(curator: CuratorService, consoleId: string): Observable<ResolvedInstalls> {
  return curator.getConsoleInstallMap(consoleId).pipe(
    map(
      (installMap): ResolvedInstalls => ({
        installedGameIds: installMap.game_ids,
        attachedDevices: installMap.attached_devices.map((attached) => attached.device),
        deviceInstalls: installMap.attached_devices.map((attached) => ({
          deviceId: attached.device.device_id,
          gameIds: attached.game_ids,
        })),
      }),
    ),
    catchError(() => of(NO_INSTALLS)),
  );
}

export const ownerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const definitionId = route.paramMap.get(RouteParams.definitionId);

  if (definitionId !== null) {
    return forkJoin({
      definition: attempt(curator.getDefinition(definitionId)),
      consoles: consolesBestEffort(curator),
    }).pipe(
      switchMap(({ definition, consoles }) => {
        if (!definition.ok) {
          return of<ResolvedCollections>({ mode: CollectionsModes.detailError, consoles });
        }
        const consoleId = installConsoleIdFor(definition.value);
        const installs = consoleId === null ? of(NO_INSTALLS) : installsFor(curator, consoleId);
        return installs.pipe(
          map((resolvedInstalls): ResolvedCollections => ({
            mode: CollectionsModes.detail,
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
      definitions.ok ? { mode: CollectionsModes.list, definitions: definitions.value, consoles } : { mode: CollectionsModes.listError, consoles },
    ),
  );
};

export const viewerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get(RouteParams.sub);
  if (sub === null) {
    return of<ResolvedCollections>({ mode: CollectionsModes.viewerError });
  }

  return forkJoin({
    definitions: curator.getUserCollections(sub),
    followed: curator.listFollowedCollections().pipe(catchError(() => of<DefinitionResponse[]>([]))),
  }).pipe(
    map(
      ({ definitions, followed }): ResolvedCollections => ({
        mode: CollectionsModes.viewer,
        definitions,
        followedIds: followed.map((definition) => definition.definition_id),
      }),
    ),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCollections>(statusCodeOf(err) === HttpStatusCode.Forbidden ? { mode: CollectionsModes.viewerForbidden } : { mode: CollectionsModes.viewerError }),
    ),
  );
};
