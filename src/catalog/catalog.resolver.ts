import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { CatalogGamesResponse } from '../curator/curator.models';

export const CATALOG_PAGE_SIZE = 50;

export const catalogResolver: ResolveFn<CatalogGamesResponse | null> = () => {
  const curator = inject(CuratorService);

  return curator
    .listCatalogGames({ limit: CATALOG_PAGE_SIZE, offset: 0 })
    .pipe(catchError(() => of(null)));
};

export const catalogGenresResolver: ResolveFn<string[]> = () => {
  const curator = inject(CuratorService);

  return curator.getCatalogGenres().pipe(
    map((response) => response.genres),
    catchError(() => of<string[]>([])),
  );
};
