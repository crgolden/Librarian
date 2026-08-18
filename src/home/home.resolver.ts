import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { MeService } from '../curator/me.service';

export interface HomeSummary {
  libraryTotal: number;
  collectionCount: number;
  collectionEntries: number;
  linked: boolean | null;
}

export const homeSummaryResolver: ResolveFn<HomeSummary | null> = () => {
  const auth = inject(AuthService);
  const curator = inject(CuratorService);
  const me = inject(MeService);

  if (!auth.isAuthenticated()) {
    return of(null);
  }

  return forkJoin({
    library: curator.getLibrary({ limit: 1 }),
    definitions: curator.listDefinitions(),
    me: me.load(),
  }).pipe(
    map(({ library, definitions, me: profile }) => ({
      libraryTotal: library.total,
      collectionCount: definitions.length,
      collectionEntries: definitions.reduce((running, definition) => running + definition.item_count, 0),
      linked: profile?.linked ?? null,
    })),
    catchError(() => of(null)),
  );
};
