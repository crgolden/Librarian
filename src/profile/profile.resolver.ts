import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PublicProfileResponse } from '../curator/curator.models';

export type ResolvedProfile =
  | { status: 'ok'; profile: PublicProfileResponse }
  | { status: 'no-user' }
  | { status: 'error' };

/** Resolves the profile for the `:sub` param when present, otherwise the signed-in user. */
export const profileResolver: ResolveFn<ResolvedProfile> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const auth = inject(AuthService);

  const sub = route.paramMap.get('sub') ?? auth.sub();
  if (sub === null) {
    return of<ResolvedProfile>({ status: 'no-user' });
  }

  return curator.getUserProfile(sub).pipe(
    map((profile): ResolvedProfile => ({ status: 'ok', profile })),
    catchError(() => of<ResolvedProfile>({ status: 'error' })),
  );
};
