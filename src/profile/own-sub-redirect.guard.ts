import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { RouteParams } from '../app/app-paths';

export function ownSubRedirectGuard(barePath: string[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const sub = route.paramMap.get(RouteParams.sub);
    if (sub !== null && sub === auth.sub()) {
      return router.createUrlTree(barePath);
    }
    return true;
  };
}
