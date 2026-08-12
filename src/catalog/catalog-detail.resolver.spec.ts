import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { throwError, of } from 'rxjs';
import { catalogDetailResolver, ResolvedCatalogGame } from './catalog-detail.resolver';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse } from '../curator/curator.models';

const GAME: GameSummaryResponse = {
  game_id: 'g1',
  canonical_title: 'Bloodborne',
  franchise: null,
  genre: 'RPG',
  aaa_tier: 'AAA',
  cover_image_url: null,
  store_product_id: null,
  critical_score: null,
  oc_score: null,
  psn_rating: null,
};

function resolve(curator: Partial<CuratorService>, gameId: string | null): Promise<ResolvedCatalogGame> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CuratorService, useValue: curator }] });

  const route = { paramMap: { get: () => gameId } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      const result = catalogDetailResolver(route, {} as never);
      (result as ReturnType<typeof of<ResolvedCatalogGame>>).subscribe(resolvePromise);
    });
  });
}

describe('catalogDetailResolver', () => {
  it('resolves the game the route asked for', async () => {
    const result = await resolve({ getCatalogGame: () => of(GAME) }, 'g1');

    expect(result).toEqual({ status: 'ok', game: GAME });
  });

  it('reports not-found for a 404 rather than surfacing an error page', async () => {
    const curator = {
      getCatalogGame: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    };

    const result = await resolve(curator, 'missing');

    expect(result).toEqual({ status: 'not-found' });
  });

  it('distinguishes a failed load from an unknown id', async () => {
    const curator = {
      getCatalogGame: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    };

    const result = await resolve(curator, 'g1');

    expect(result).toEqual({ status: 'error' });
  });

  it('treats a route with no game id as not-found without calling the api', async () => {
    let called = false;
    const curator = {
      getCatalogGame: () => {
        called = true;
        return of(GAME);
      },
    };

    const result = await resolve(curator, null);

    expect(result).toEqual({ status: 'not-found' });
    expect(called).toBe(false);
  });
});
