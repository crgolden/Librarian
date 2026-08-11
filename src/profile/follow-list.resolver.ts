import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { FollowListEntryResponse } from '../curator/curator.models';

export type ResolvedFollowList =
  | { status: 'ok'; entries: FollowListEntryResponse[]; total: number }
  | { status: 'no-user' }
  | { status: 'error' };

/**
 * Resolves a followers or following list for the `:sub` param when present, otherwise the signed-in user.
 *
 * @param kind Which list to fetch.
 */
export function followListResolver(kind: 'followers' | 'following'): ResolveFn<ResolvedFollowList> {
  return (route: ActivatedRouteSnapshot) => {
    const curator = inject(CuratorService);
    const auth = inject(AuthService);

    const sub = route.paramMap.get('sub') ?? auth.sub();
    if (sub === null) {
      return of<ResolvedFollowList>({ status: 'no-user' });
    }

    const request = kind === 'followers' ? curator.getFollowers(sub) : curator.getFollowing(sub);
    return request.pipe(
      map((response): ResolvedFollowList => ({ status: 'ok', entries: response.entries, total: response.total })),
      catchError(() => of<ResolvedFollowList>({ status: 'error' })),
    );
  };
}
