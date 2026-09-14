import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { CatalogGamesResponse } from '../curator/curator.models';
import { catalogQueryFromParams } from './catalog.query';

export { CATALOG_PAGE_SIZE } from './catalog.query';

export const catalogResolver: ResolveFn<CatalogGamesResponse | null> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);

  return curator.listCatalogGames(catalogQueryFromParams(route.queryParams)).pipe(catchError(() => of(null)));
};

export const catalogGenresResolver: ResolveFn<string[]> = () => {
  const curator = inject(CuratorService);

  return curator.getCatalogGenres().pipe(
    map((response) => response.genres),
    catchError(() => of<string[]>([])),
  );
};
