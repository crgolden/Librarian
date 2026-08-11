import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';

/**
 * A share link that has been revoked is a different outcome from a share link that failed to load, and
 * the page says different things for each. A bare `null` would flatten them, so this resolves a tagged
 * result instead.
 */
export type ResolvedPublicCollection =
  | { status: 'ok'; collection: PublicCollectionResponse }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * Resolves a shared collection before /c/:slug activates.
 *
 * This is the one route an anonymous visitor reaches from outside the app, so resolving matters more
 * here than elsewhere: the server-rendered HTML carries the collection's real title and contents rather
 * than an empty shell that fills in after hydration.
 */
export const publicCollectionResolver: ResolveFn<ResolvedPublicCollection> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const slug = route.paramMap.get('slug');
  if (!slug) {
    return of<ResolvedPublicCollection>({ status: 'not-found' });
  }

  return curator.getPublicCollection(slug).pipe(
    map((collection): ResolvedPublicCollection => ({ status: 'ok', collection })),
    catchError((err: HttpErrorResponse) =>
      of<ResolvedPublicCollection>(err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
};
