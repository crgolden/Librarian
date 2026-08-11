import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Canonicalizes a `:sub`-keyed route to its bare-path equivalent whenever `:sub` names the signed-in
 * user's own sub. The bare paths (`/profile`, `/library`, `/collections`, ...) are always owner mode;
 * a `:sub`-keyed URL only "sticks" in the address bar when it names someone else.
 *
 * This is a guard rather than the `ngOnInit` check it replaces because the router runs
 * `canActivate` *before* `resolve`. Left in `ngOnInit`, the route's resolvers would fetch a whole
 * page of viewer-mode data for a URL that is already redirecting -- a wasted round trip, and one that
 * asks the API for another user's data using your own sub.
 *
 * Returning a `UrlTree` rather than navigating imperatively lets the router treat the redirect as part
 * of the same navigation, so no partially-activated route is ever rendered.
 *
 * @param barePath The owner-mode path this route canonicalizes to.
 */
export function ownSubRedirectGuard(barePath: string[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const sub = route.paramMap.get('sub');
    if (sub !== null && sub === auth.sub()) {
      return router.createUrlTree(barePath);
    }
    return true;
  };
}
