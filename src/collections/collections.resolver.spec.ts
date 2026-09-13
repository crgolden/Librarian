import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  installConsoleIdFor,
  NO_INSTALLS,
  ownerCollectionsResolver,
  viewerCollectionsResolver,
  ResolvedCollections,
} from './collections.resolver';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
  StorageDeviceResponse,
} from '../curator/curator.models';

const CONSOLE_ID = 'c1';
const DEVICE_ID = 'sd1';
const INSTALLED_GAME_ID = 'g-installed';
const DEVICE_GAME_ID = 'g-on-device';

const CONSOLES = [{ console_id: CONSOLE_ID }] as unknown as ConsoleResponse[];
const DEFINITIONS = [{ definition_id: 'd1' }] as unknown as DefinitionResponse[];
const DETAIL = { definition_id: 'd1' } as unknown as DefinitionDetailResponse;
const VIEWER_DEFINITIONS = [{ definition_id: 'd9' }] as unknown as ProfileDefinitionResponse[];
const FOLLOWED = [{ definition_id: 'd9' }] as unknown as DefinitionResponse[];

const ATTACHED_DEVICE = {
  device_id: DEVICE_ID,
  console_id: CONSOLE_ID,
} as unknown as StorageDeviceResponse;

const OTHER_CONSOLES_DEVICE = {
  device_id: 'sd-elsewhere',
  console_id: 'c-other',
} as unknown as StorageDeviceResponse;

function detailTargeting(consoleId: string): DefinitionDetailResponse {
  return { definition_id: 'd1', install_target_console_id: consoleId } as unknown as DefinitionDetailResponse;
}

const INSTALL_STUBS: Partial<CuratorService> = {
  getConsoleInstalls: () => of({ game_ids: [INSTALLED_GAME_ID] }),
  listStorageDevices: () => of([ATTACHED_DEVICE, OTHER_CONSOLES_DEVICE]),
  getStorageDeviceInstalls: () => of({ game_ids: [DEVICE_GAME_ID] }),
};

function run(
  resolver: ResolveFn<ResolvedCollections>,
  curator: Partial<CuratorService>,
  params: Record<string, string | null>,
): Promise<ResolvedCollections> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  const route = {
    paramMap: { get: (name: string) => params[name] ?? null },
  } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = resolver(route, {} as never) as Observable<ResolvedCollections>;
      result.subscribe(resolvePromise);
    });
  });
}

const fails = () => throwError(() => new HttpErrorResponse({ status: 500 }));

describe('ownerCollectionsResolver', () => {
  it('resolves the saved-definition list when the url names no definition', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: () => of(DEFINITIONS), listConsoles: () => of(CONSOLES) },
      {},
    );

    expect(result).toEqual({ mode: 'list', definitions: DEFINITIONS, consoles: CONSOLES });
  });

  it('resolves a deep-linked definition when the url names one', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { getDefinition: () => of(DETAIL), listConsoles: () => of(CONSOLES) },
      { definitionId: 'd1' },
    );

    expect(result).toEqual({ mode: 'detail', definition: DETAIL, consoles: CONSOLES, installs: NO_INSTALLS });
  });

  it('spends no install lookups on a collection that names no console to show them for', async () => {
    let asked = false;
    const result = await run(
      ownerCollectionsResolver,
      {
        getDefinition: () => of(DETAIL),
        listConsoles: () => of(CONSOLES),
        getConsoleInstalls: () => {
          asked = true;
          return of({ game_ids: [] });
        },
      },
      { definitionId: 'd1' },
    );

    expect(result).toMatchObject({ installs: NO_INSTALLS });
    expect(asked).toBe(false);
  });

  it('resolves the install state the detail view opens with, for the console the collection targets', async () => {
    const result = await run(
      ownerCollectionsResolver,
      {
        ...INSTALL_STUBS,
        getDefinition: () => of(detailTargeting(CONSOLE_ID)),
        listConsoles: () => of(CONSOLES),
      },
      { definitionId: 'd1' },
    );

    expect(result).toMatchObject({
      installs: {
        installedGameIds: [INSTALLED_GAME_ID],
        attachedDevices: [ATTACHED_DEVICE],
        deviceInstalls: [{ deviceId: DEVICE_ID, gameIds: [DEVICE_GAME_ID] }],
      },
    });
  });

  it('offers only the storage devices attached to that console, not every device the user owns', async () => {
    const result = await run(
      ownerCollectionsResolver,
      {
        ...INSTALL_STUBS,
        getDefinition: () => of(detailTargeting(CONSOLE_ID)),
        listConsoles: () => of(CONSOLES),
      },
      { definitionId: 'd1' },
    );

    const devices = result.mode === 'detail' ? result.installs.attachedDevices : [];

    expect(devices.map((device) => device.device_id)).toEqual([DEVICE_ID]);
  });

  it('renders the detail view with empty install state rather than failing when the lookups fail', async () => {
    const result = await run(
      ownerCollectionsResolver,
      {
        getDefinition: () => of(detailTargeting(CONSOLE_ID)),
        listConsoles: () => of(CONSOLES),
        getConsoleInstalls: fails,
        listStorageDevices: fails,
      },
      { definitionId: 'd1' },
    );

    expect(result).toMatchObject({ mode: 'detail', installs: NO_INSTALLS });
  });

  it('reports list-error but still returns consoles when the list call fails', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: fails, listConsoles: () => of(CONSOLES) },
      {},
    );

    expect(result).toEqual({ mode: 'list-error', consoles: CONSOLES });
  });

  it('reports detail-error but still returns consoles when the definition call fails', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { getDefinition: fails, listConsoles: () => of(CONSOLES) },
      { definitionId: 'd1' },
    );

    expect(result).toEqual({ mode: 'detail-error', consoles: CONSOLES });
  });

  it('treats consoles as best-effort, yielding an empty list rather than failing the route', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: () => of(DEFINITIONS), listConsoles: fails },
      {},
    );

    expect(result).toEqual({ mode: 'list', definitions: DEFINITIONS, consoles: [] });
  });
});

describe('installConsoleIdFor', () => {
  it('shows installs for the console a collection explicitly targets', () => {
    expect(installConsoleIdFor(detailTargeting(CONSOLE_ID))).toBe(CONSOLE_ID);
  });

  it('falls back to the console a capacity fill was generated for', () => {
    const generated = { kind: 'capacity_fill', console_id: CONSOLE_ID } as unknown as DefinitionDetailResponse;

    expect(installConsoleIdFor(generated)).toBe(CONSOLE_ID);
  });

  it('names no console for any other collection, which is what withholds the install controls', () => {
    const manual = { kind: 'manual', console_id: CONSOLE_ID } as unknown as DefinitionDetailResponse;

    expect(installConsoleIdFor(manual)).toBeNull();
    expect(installConsoleIdFor(null)).toBeNull();
  });
});

describe('viewerCollectionsResolver', () => {
  it("resolves another user's public collections", async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: () => of([]) },
      { sub: 'u1' },
    );

    expect(result).toEqual({ mode: 'viewer', definitions: VIEWER_DEFINITIONS, followedIds: [] });
  });

  it('resolves which of them the viewer already follows, so the toggle opens in the right state', async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: () => of(FOLLOWED) },
      { sub: 'u1' },
    );

    expect(result).toEqual({
      mode: 'viewer',
      definitions: VIEWER_DEFINITIONS,
      followedIds: FOLLOWED.map((definition) => definition.definition_id),
    });
  });

  it('still lists the collections when the follow lookup fails, rather than losing the page to it', async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: fails },
      { sub: 'u1' },
    );

    expect(result).toEqual({ mode: 'viewer', definitions: VIEWER_DEFINITIONS, followedIds: [] });
  });

  it('distinguishes a private profile from a failed load', async () => {
    const forbidden = await run(
      viewerCollectionsResolver,
      {
        getUserCollections: () => throwError(() => new HttpErrorResponse({ status: 403 })),
        listFollowedCollections: () => of([]),
      },
      { sub: 'u1' },
    );
    const failed = await run(viewerCollectionsResolver, { getUserCollections: fails }, { sub: 'u1' });

    expect(forbidden).toEqual({ mode: 'viewer-forbidden' });
    expect(failed).toEqual({ mode: 'viewer-error' });
  });

  it('reports an error for a route with no sub without calling the api', async () => {
    let called = false;
    const result = await run(
      viewerCollectionsResolver,
      {
        getUserCollections: () => {
          called = true;
          return of(VIEWER_DEFINITIONS);
        },
      },
      {},
    );

    expect(result).toEqual({ mode: 'viewer-error' });
    expect(called).toBe(false);
  });
});
