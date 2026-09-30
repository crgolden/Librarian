import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  CollectionsModes,
  NO_INSTALLS,
  ResolvedCollections,
  installConsoleIdFor,
  ownerCollectionsResolver,
  viewerCollectionsResolver,
} from './collections.resolver';
import { CuratorService } from '../curator/curator.service';
import {
  CollectionKinds,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
  StorageDeviceResponse,
} from '../curator/curator.models';
import { RouteParams } from '../app/app-paths';
import { newId } from '@crgolden/modules/testing';

const CONSOLE_ID = newId();
const DEVICE_ID = newId();
const INSTALLED_GAME_ID = newId();
const DEVICE_GAME_ID = newId();
const DEFINITION_ID = newId();
const VIEWER_DEFINITION_ID = newId();
const OTHER_SUB = newId();

const CONSOLES = [{ console_id: CONSOLE_ID }] as unknown as ConsoleResponse[];
const DEFINITIONS = [{ definition_id: DEFINITION_ID }] as unknown as DefinitionResponse[];
const DETAIL = { definition_id: DEFINITION_ID } as unknown as DefinitionDetailResponse;
const VIEWER_DEFINITIONS = [{ definition_id: VIEWER_DEFINITION_ID }] as unknown as ProfileDefinitionResponse[];
const FOLLOWED = [{ definition_id: VIEWER_DEFINITION_ID }] as unknown as DefinitionResponse[];

const ATTACHED_DEVICE = {
  device_id: DEVICE_ID,
  console_id: CONSOLE_ID,
} as unknown as StorageDeviceResponse;

function detailTargeting(consoleId: string): DefinitionDetailResponse {
  return { definition_id: DEFINITION_ID, install_target_console_id: consoleId } as unknown as DefinitionDetailResponse;
}

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

const fails = () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.InternalServerError }));

describe('ownerCollectionsResolver', () => {
  it('resolves the saved-definition list when the url names no definition', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: () => of(DEFINITIONS), listConsoles: () => of(CONSOLES) },
      {},
    );

    expect(result).toEqual({ mode: CollectionsModes.list, definitions: DEFINITIONS, consoles: CONSOLES });
  });

  it('resolves a deep-linked definition when the url names one', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { getDefinition: () => of(DETAIL), listConsoles: () => of(CONSOLES) },
      { [RouteParams.definitionId]: DEFINITION_ID },
    );

    expect(result).toEqual({ mode: CollectionsModes.detail, definition: DETAIL, consoles: CONSOLES, installs: NO_INSTALLS });
  });

  it('spends no install lookups on a collection that names no console to show them for', async () => {
    let asked = false;
    const result = await run(
      ownerCollectionsResolver,
      {
        getDefinition: () => of(DETAIL),
        listConsoles: () => of(CONSOLES),
        getConsoleInstallMap: () => {
          asked = true;
          return of({ game_ids: [], attached_devices: [] });
        },
      },
      { [RouteParams.definitionId]: DEFINITION_ID },
    );

    expect(result).toMatchObject({ installs: NO_INSTALLS });
    expect(asked).toBe(false);
  });

  it('resolves the install state for the targeted console from the one install-map request and nothing else', async () => {
    const askedFor: string[] = [];
    const result = await run(
      ownerCollectionsResolver,
      {
        getDefinition: () => of(detailTargeting(CONSOLE_ID)),
        listConsoles: () => of(CONSOLES),
        getConsoleInstallMap: (consoleId: string) => {
          askedFor.push(consoleId);
          return of({
            game_ids: [INSTALLED_GAME_ID],
            attached_devices: [{ device: ATTACHED_DEVICE, game_ids: [DEVICE_GAME_ID] }],
          });
        },
      },
      { [RouteParams.definitionId]: DEFINITION_ID },
    );

    expect(askedFor).toEqual([CONSOLE_ID]);
    expect(result).toMatchObject({
      installs: {
        installedGameIds: [INSTALLED_GAME_ID],
        attachedDevices: [ATTACHED_DEVICE],
        deviceInstalls: [{ deviceId: DEVICE_ID, gameIds: [DEVICE_GAME_ID] }],
      },
    });
  });

  it('renders the detail view with empty install state rather than failing when the lookup fails', async () => {
    const result = await run(
      ownerCollectionsResolver,
      {
        getDefinition: () => of(detailTargeting(CONSOLE_ID)),
        listConsoles: () => of(CONSOLES),
        getConsoleInstallMap: fails,
      },
      { [RouteParams.definitionId]: DEFINITION_ID },
    );

    expect(result).toMatchObject({ mode: CollectionsModes.detail, installs: NO_INSTALLS });
  });

  it('reports list-error but still returns consoles when the list call fails', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: fails, listConsoles: () => of(CONSOLES) },
      {},
    );

    expect(result).toEqual({ mode: CollectionsModes.listError, consoles: CONSOLES });
  });

  it('reports detail-error but still returns consoles when the definition call fails', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { getDefinition: fails, listConsoles: () => of(CONSOLES) },
      { [RouteParams.definitionId]: DEFINITION_ID },
    );

    expect(result).toEqual({ mode: CollectionsModes.detailError, consoles: CONSOLES });
  });

  it('treats consoles as best-effort, yielding an empty list rather than failing the route', async () => {
    const result = await run(
      ownerCollectionsResolver,
      { listDefinitions: () => of(DEFINITIONS), listConsoles: fails },
      {},
    );

    expect(result).toEqual({ mode: CollectionsModes.list, definitions: DEFINITIONS, consoles: [] });
  });
});

describe('installConsoleIdFor', () => {
  it('shows installs for the console a collection explicitly targets', () => {
    expect(installConsoleIdFor(detailTargeting(CONSOLE_ID))).toBe(CONSOLE_ID);
  });

  it('falls back to the console a capacity fill was generated for', () => {
    const generated = { kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID } as unknown as DefinitionDetailResponse;

    expect(installConsoleIdFor(generated)).toBe(CONSOLE_ID);
  });

  it('names no console for any other collection, which is what withholds the install controls', () => {
    const manual = { kind: newId(), console_id: CONSOLE_ID } as unknown as DefinitionDetailResponse;

    expect(installConsoleIdFor(manual)).toBeNull();
    expect(installConsoleIdFor(null)).toBeNull();
  });
});

describe('viewerCollectionsResolver', () => {
  it("resolves another user's public collections", async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: () => of([]) },
      { [RouteParams.sub]: OTHER_SUB },
    );

    expect(result).toEqual({ mode: CollectionsModes.viewer, definitions: VIEWER_DEFINITIONS, followedIds: [] });
  });

  it('resolves which of them the viewer already follows, so the toggle opens in the right state', async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: () => of(FOLLOWED) },
      { [RouteParams.sub]: OTHER_SUB },
    );

    expect(result).toEqual({
      mode: CollectionsModes.viewer,
      definitions: VIEWER_DEFINITIONS,
      followedIds: FOLLOWED.map((definition) => definition.definition_id),
    });
  });

  it('asks for the followed list without waiting for the collections, since it needs nothing from them', async () => {
    const collections = new Subject<ProfileDefinitionResponse[]>();
    let followedAsked = false;
    const pending = run(
      viewerCollectionsResolver,
      {
        getUserCollections: () => collections,
        listFollowedCollections: () => {
          followedAsked = true;
          return of(FOLLOWED);
        },
      },
      { [RouteParams.sub]: OTHER_SUB },
    );

    expect(followedAsked).toBe(true);

    collections.next(VIEWER_DEFINITIONS);
    collections.complete();

    expect(await pending).toEqual({
      mode: CollectionsModes.viewer,
      definitions: VIEWER_DEFINITIONS,
      followedIds: FOLLOWED.map((definition) => definition.definition_id),
    });
  });

  it('still lists the collections when the follow lookup fails, rather than losing the page to it', async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS), listFollowedCollections: fails },
      { [RouteParams.sub]: OTHER_SUB },
    );

    expect(result).toEqual({ mode: CollectionsModes.viewer, definitions: VIEWER_DEFINITIONS, followedIds: [] });
  });

  it('distinguishes a private profile from a failed load', async () => {
    const forbidden = await run(
      viewerCollectionsResolver,
      {
        getUserCollections: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.Forbidden })),
        listFollowedCollections: () => of([]),
      },
      { [RouteParams.sub]: OTHER_SUB },
    );
    const failed = await run(
      viewerCollectionsResolver,
      { getUserCollections: fails, listFollowedCollections: () => of([]) },
      { [RouteParams.sub]: OTHER_SUB },
    );

    expect(forbidden).toEqual({ mode: CollectionsModes.viewerForbidden });
    expect(failed).toEqual({ mode: CollectionsModes.viewerError });
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

    expect(result).toEqual({ mode: CollectionsModes.viewerError });
    expect(called).toBe(false);
  });
});
