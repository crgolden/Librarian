import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Canonicalizes a `:sub`-keyed route to its bare-path equivalent whenever `:sub` names the signed-in
 * user's own sub. The bare paths (`/profile`, `/library`, `/collections`, ...) are always owner mode;
 * a `:sub`-keyed URL only "sticks" in the address bar when it names someone else.
 *
 * Callers must check the return value first and skip fetch/render entirely when it's `true` — a
 * navigation is already in flight.
 */
export function redirectIfOwnSub(
  route: ActivatedRoute,
  router: Router,
  auth: AuthService,
  barePath: string[],
): boolean {
  const sub = route.snapshot.paramMap.get('sub');
  if (sub !== null && sub === auth.sub()) {
    void router.navigate(barePath, { replaceUrl: true });
    return true;
  }
  return false;
}
