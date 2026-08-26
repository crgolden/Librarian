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

export const psnStatusResolver: ResolveFn<PsnStatus | null> = () => {
  const http = inject(HttpClient);

  return http
    .get<PsnStatus>('/curator/api/me')
    .pipe(catchError((_err: HttpErrorResponse) => of(null)));
};
