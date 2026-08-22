import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { ProfileLinkResponse, ProfileLinkSiteResponse, ProfileSettingsResponse } from '../curator/curator.models';

export type ResolvedProfileSettings =
  | {
      status: 'ok';
      settings: ProfileSettingsResponse;
      sites: ProfileLinkSiteResponse[];
      links: ProfileLinkResponse[];
    }
  | { status: 'error' };

/** Resolves everything `/profile/settings` renders — the visibility toggles, the allowlisted profile-link
 * sites, and the links already declared — before the route activates.
 *
 * Degrades to a tagged result rather than redirecting: a failed navigation loses the URL the user was
 * trying to reach, and there is no better page to send them to than the one they asked for showing its
 * own error. */
export const profileSettingsResolver: ResolveFn<ResolvedProfileSettings> = () => {
  const curator = inject(CuratorService);
  return forkJoin({
    settings: curator.getProfileSettings(),
    sites: curator.listProfileLinkSites(),
    links: curator.getProfileLinks(),
  }).pipe(
    map((resolved): ResolvedProfileSettings => ({ status: 'ok', ...resolved })),
    catchError(() => of<ResolvedProfileSettings>({ status: 'error' })),
  );
};
