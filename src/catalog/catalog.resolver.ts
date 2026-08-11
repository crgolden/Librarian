import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { CatalogGamesResponse } from '../curator/curator.models';

export const CATALOG_PAGE_SIZE = 50;

/**
 * Resolves the catalog's first page before /catalog activates, so the route never renders an empty
 * table that fills in a moment later. Only the first page: paging and filtering stay in the component,
 * where `<app-loading-overlay>` blocks interaction instead.
 *
 * Resolves to `null` on failure rather than redirecting, matching `psnStatusResolver` -- the component
 * renders its own error state and there is nowhere better to send the caller.
 */
export const catalogResolver: ResolveFn<CatalogGamesResponse | null> = () => {
  const curator = inject(CuratorService);

  return curator
    .listCatalogGames({ limit: CATALOG_PAGE_SIZE, offset: 0 })
    .pipe(catchError(() => of(null)));
};
