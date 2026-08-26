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
