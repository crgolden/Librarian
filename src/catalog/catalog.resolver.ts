import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { CatalogGamesResponse } from '../curator/curator.models';

export const CATALOG_PAGE_SIZE = 50;

/** Resolves the catalog's first page, or `null` if it could not be loaded. */
export const catalogResolver: ResolveFn<CatalogGamesResponse | null> = () => {
  const curator = inject(CuratorService);

  return curator
    .listCatalogGames({ limit: CATALOG_PAGE_SIZE, offset: 0 })
    .pipe(catchError(() => of(null)));
};
