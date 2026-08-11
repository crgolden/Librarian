import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import {
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';

export type ResolvedCollections =
  | { mode: 'list'; definitions: DefinitionResponse[]; consoles: ConsoleResponse[] }
  | { mode: 'list-error'; consoles: ConsoleResponse[] }
  | { mode: 'detail'; definition: DefinitionDetailResponse; consoles: ConsoleResponse[] }
  | { mode: 'detail-error'; consoles: ConsoleResponse[] }
  | { mode: 'viewer'; definitions: ProfileDefinitionResponse[] }
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

/**
 * Resolves `/collections` (the saved-definition list) or `/collections/d/:definitionId` (a deep-linked
 * definition), whichever the URL names. `consoles` is best-effort: a failure yields an empty list.
 */
export const ownerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const definitionId = route.paramMap.get('definitionId');

  if (definitionId !== null) {
    return forkJoin({
      definition: attempt(curator.getDefinition(definitionId)),
      consoles: consolesBestEffort(curator),
    }).pipe(
      map(({ definition, consoles }): ResolvedCollections =>
        definition.ok ? { mode: 'detail', definition: definition.value, consoles } : { mode: 'detail-error', consoles },
      ),
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

/** Resolves `/collections/:sub` — another user's public collections. */
export const viewerCollectionsResolver: ResolveFn<ResolvedCollections> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const sub = route.paramMap.get('sub');
  if (sub === null) {
    return of<ResolvedCollections>({ mode: 'viewer-error' });
  }

  return curator.getUserCollections(sub).pipe(
    map((definitions): ResolvedCollections => ({ mode: 'viewer', definitions })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedCollections>(err.status === 403 ? { mode: 'viewer-forbidden' } : { mode: 'viewer-error' }),
    ),
  );
};
