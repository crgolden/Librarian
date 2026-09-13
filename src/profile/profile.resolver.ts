import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PsnPreferencesResponse, PublicProfileResponse } from '../curator/curator.models';

export type ResolvedProfile =
  | { status: 'ok'; profile: PublicProfileResponse; viewerPreferences: PsnPreferencesResponse | null }
  | { status: 'no-user' }
  | { status: 'error' };

export const profileResolver: ResolveFn<ResolvedProfile> = (route: ActivatedRouteSnapshot) => {
  const curator = inject(CuratorService);
  const auth = inject(AuthService);

  const sub = route.paramMap.get('sub') ?? auth.sub();
  if (sub === null) {
    return of<ResolvedProfile>({ status: 'no-user' });
  }

  return curator.getUserProfile(sub).pipe(
    switchMap((profile) => {
      const viewerPreferences = profile.viewer_is_owner
        ? of<PsnPreferencesResponse | null>(null)
        : curator.getPsnPreferences().pipe(catchError(() => of<PsnPreferencesResponse | null>(null)));
      return viewerPreferences.pipe(
        map((prefs): ResolvedProfile => ({ status: 'ok', profile, viewerPreferences: prefs })),
      );
    }),
    catchError(() => of<ResolvedProfile>({ status: 'error' })),
  );
};
