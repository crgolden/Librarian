import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

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
