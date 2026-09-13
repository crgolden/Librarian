import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { publicCollectionResolver, ResolvedPublicCollection } from './public-collection.resolver';
import { CuratorService } from '../curator/curator.service';
import { DefinitionResponse, PublicCollectionResponse } from '../curator/curator.models';

const COLLECTION = { name: 'Backlog', games: [], definition_id: 'd1' } as unknown as PublicCollectionResponse;

const followed = (...ids: string[]) => () =>
  of(ids.map((id) => ({ definition_id: id })) as unknown as DefinitionResponse[]);

function run(curator: Partial<CuratorService>, slug: string | null): Promise<ResolvedPublicCollection> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  const route = { paramMap: { get: () => slug } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (publicCollectionResolver(route, {} as never) as Observable<ResolvedPublicCollection>).subscribe(resolvePromise);
    });
  });
}

const fails = (status: number) => () => throwError(() => new HttpErrorResponse({ status }));

describe('publicCollectionResolver', () => {
  it('resolves the shared collection the slug names', async () => {
    const result = await run(
      { getPublicCollection: () => of(COLLECTION), listFollowedCollections: followed() },
      'slug1',
    );

    expect(result).toEqual({ status: 'ok', collection: COLLECTION, following: false });
  });

  it('resolves the follow state, so the component never fetches it', async () => {
    const result = await run(
      { getPublicCollection: () => of(COLLECTION), listFollowedCollections: followed('d1') },
      'slug1',
    );

    expect(result).toEqual({ status: 'ok', collection: COLLECTION, following: true });
  });

  it('still renders the collection for a signed-out viewer, whose follow lookup is refused', async () => {
    const result = await run(
      { getPublicCollection: () => of(COLLECTION), listFollowedCollections: fails(401) },
      'slug1',
    );

    expect(result).toEqual({ status: 'ok', collection: COLLECTION, following: false });
  });

  it('reports not-found for a revoked or unknown slug, never an error page', async () => {
    const result = await run({ getPublicCollection: fails(404) }, 'slug1');

    expect(result).toEqual({ status: 'not-found' });
  });

  it('distinguishes a failed load from a revoked link', async () => {
    const result = await run({ getPublicCollection: fails(500) }, 'slug1');

    expect(result).toEqual({ status: 'error' });
  });

  it('treats an empty slug as not-found without calling the api', async () => {
    let called = false;
    const result = await run(
      {
        getPublicCollection: () => {
          called = true;
          return of(COLLECTION);
        },
      },
      null,
    );

    expect(result).toEqual({ status: 'not-found' });
    expect(called).toBe(false);
  });
});
