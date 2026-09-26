import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, throwError, of } from 'rxjs';
import { catalogDetailResolver, ResolvedCatalogGame } from './catalog-detail.resolver';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse, PublicCollectionSummaryResponse } from '../curator/curator.models';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newCount, newId, newText, newUtcInstant } from '@crgolden/modules/testing';

const GAME_ID = newId();

const PUBLIC_COLLECTION: PublicCollectionSummaryResponse = {
  definition_id: newId(),
  name: newText(),
  share_slug: newId(),
  item_count: newCount(),
  updated_at: newUtcInstant(),
};

const GAME: GameSummaryResponse = {
  game_id: GAME_ID,
  canonical_title: newText(),
  franchise: null,
  genre: newText(),
  aaa_tier: newText(),
  cover_image_url: null,
  store_product_id: null,
  critical_score: null,
  oc_score: null,
  psn_rating: null,
  percent_completed: null,
  content_kind: null,
  price: null,
};

function resolve(curator: Partial<CuratorService>, gameId: string | null): Promise<ResolvedCatalogGame> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  const route = { paramMap: { get: () => gameId } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = catalogDetailResolver(route, {} as never);
      (result as Observable<ResolvedCatalogGame>).subscribe(resolvePromise);
    });
  });
}

describe('catalogDetailResolver', () => {
  const publicCollections = () => of({ collections: [PUBLIC_COLLECTION], total: 1 });

  it('resolves the game the route asked for, with the public collections that hold it', async () => {
    const result = await resolve({ getCatalogGame: () => of(GAME), getCatalogGameCollections: publicCollections }, GAME_ID);

    expect(result).toEqual({ status: ResolvedStatuses.ok, game: GAME, collections: [PUBLIC_COLLECTION] });
  });

  it('degrades a failed collections lookup to none rather than failing the game page', async () => {
    const result = await resolve(
      {
        getCatalogGame: () => of(GAME),
        getCatalogGameCollections: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.InternalServerError })),
      },
      GAME_ID,
    );

    expect(result).toEqual({ status: ResolvedStatuses.ok, game: GAME, collections: [] });
  });

  it('reports not-found for a 404 rather than surfacing an error page', async () => {
    const curator = {
      getCatalogGame: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.NotFound })),
      getCatalogGameCollections: publicCollections,
    };

    const result = await resolve(curator, newId());

    expect(result).toEqual({ status: ResolvedStatuses.notFound });
  });

  it('distinguishes a failed load from an unknown id', async () => {
    const curator = {
      getCatalogGame: () => throwError(() => new HttpErrorResponse({ status: HttpStatusCode.InternalServerError })),
      getCatalogGameCollections: publicCollections,
    };

    const result = await resolve(curator, GAME_ID);

    expect(result).toEqual({ status: ResolvedStatuses.error });
  });

  it('treats a route with no game id as not-found without calling the api', async () => {
    let called = false;
    const curator = {
      getCatalogGame: () => {
        called = true;
        return of(GAME);
      },
      getCatalogGameCollections: publicCollections,
    };

    const result = await resolve(curator, null);

    expect(result).toEqual({ status: ResolvedStatuses.notFound });
    expect(called).toBe(false);
  });
});
