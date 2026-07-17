import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';

export interface PsnStatus {
  sub: string;
  email: string | null;
  linked: boolean;
  psn: { access_token_expires_at: string | null; refresh_token_expires_at: string | null } | null;
}

/**
 * Resolves the caller's PSN link status before the /psn route activates, so the page never
 * server-renders (or client-renders) a "Loading link status..." placeholder that immediately gets
 * replaced -- matching Inventory's productResolver/catalogResolver pattern for the same problem.
 *
 * Resolves to `null` on failure rather than redirecting away: PsnSettingsComponent already renders its
 * own inline error state for this case (see its `error` signal), and there is no other page to send the
 * user to.
 */
export const psnStatusResolver: ResolveFn<PsnStatus | null> = () => {
  const http = inject(HttpClient);

  return http
    .get<PsnStatus>('/curator/api/me')
    .pipe(catchError((_err: HttpErrorResponse) => of(null)));
};
