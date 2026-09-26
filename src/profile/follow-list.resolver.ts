import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { FollowListEntryResponse } from '../curator/curator.models';
import { FollowListKinds, RouteParams, type FollowListKind } from '../app/app-paths';
import { ResolvedStatuses } from '../shared/resolved-status';

export type ResolvedFollowList =
  | { status: typeof ResolvedStatuses.ok; entries: FollowListEntryResponse[]; total: number }
  | { status: typeof ResolvedStatuses.noUser }
  | { status: typeof ResolvedStatuses.error };

export function followListResolver(kind: FollowListKind): ResolveFn<ResolvedFollowList> {
  return (route: ActivatedRouteSnapshot) => {
    const curator = inject(CuratorService);
    const auth = inject(AuthService);

    const sub = route.paramMap.get(RouteParams.sub) ?? auth.sub();
    if (sub === null) {
      return of<ResolvedFollowList>({ status: ResolvedStatuses.noUser });
    }

    const request = kind === FollowListKinds.followers ? curator.getFollowers(sub) : curator.getFollowing(sub);
    return request.pipe(
      map((response): ResolvedFollowList => ({ status: ResolvedStatuses.ok, entries: response.entries, total: response.total })),
      catchError(() => of<ResolvedFollowList>({ status: ResolvedStatuses.error })),
    );
  };
}
