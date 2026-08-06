import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminService } from '../admin/admin.service';

/** This app's first *async* guard (authGuard is synchronous) -- resolves against a live `GET /me` call.
 * Composed as `canActivate: [authGuard, adminGuard]` (array-AND'd) so the synchronous authenticated check
 * always runs first and this live API call never happens for an anonymous visitor. A non-admin (but
 * authenticated) caller resolves to a UrlTree redirect home rather than authGuard's `/bff/login` redirect,
 * since they are authenticated, just not an admin. */
export const adminGuard: CanActivateFn = () => {
  const admin = inject(AdminService);
  const router = inject(Router);

  return admin.ensureLoaded().pipe(map((isAdmin) => isAdmin || router.parseUrl('/')));
};
