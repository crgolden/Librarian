import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ownerCollectionsResolver, viewerCollectionsResolver, ResolvedCollections } from './collections.resolver';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';

const CONSOLES = [{ console_id: 'c1' }] as unknown as ConsoleResponse[];
const DEFINITIONS = [{ definition_id: 'd1' }] as unknown as DefinitionResponse[];
const DETAIL = { definition_id: 'd1' } as unknown as DefinitionDetailResponse;
const VIEWER_DEFINITIONS = [{ definition_id: 'd9' }] as unknown as ProfileDefinitionResponse[];

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

    expect(result).toEqual({ mode: 'detail', definition: DETAIL, consoles: CONSOLES });
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

describe('viewerCollectionsResolver', () => {
  it("resolves another user's public collections", async () => {
    const result = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => of(VIEWER_DEFINITIONS) },
      { sub: 'u1' },
    );

    expect(result).toEqual({ mode: 'viewer', definitions: VIEWER_DEFINITIONS });
  });

  it('distinguishes a private profile from a failed load', async () => {
    const forbidden = await run(
      viewerCollectionsResolver,
      { getUserCollections: () => throwError(() => new HttpErrorResponse({ status: 403 })) },
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
