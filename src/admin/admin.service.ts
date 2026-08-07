import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, map, of, shareReplay, switchMap, take } from 'rxjs';
import { CuratorService } from '../curator/curator.service';

/** Whether the signed-in caller holds the `curator.admin` claim, resolved via a live `GET /curator/api/me`
 * call rather than the BFF's own `bff/user` claims array -- that channel is ID-token/userinfo-derived and
 * unconfirmed to ever carry an admin claim at all, a separate and less authoritative source than the
 * actual Curator access token `require_admin` checks server-side.
 *
 * Lazily triggered (`ensureLoaded()`), not wired into `provideAppInitializer` like `AuthService` --
 * `auth.service.spec.ts` asserts exactly one `bff/user` request per test via `httpMock.verify()`, an
 * app-initializer fetch here would pay Curator's `require_verified_caller` cost (a possible PSN re-verify
 * round-trip) for every user regardless of whether they'll ever see admin UI, and guarded routes are
 * deliberately client-rendered so this fits the same guard/nav-time timing as everything else. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly curator = inject(CuratorService);
  private readonly _refresh$ = new Subject<void>();
  private loaded = false;

  private readonly _isAdmin$ = this._refresh$.pipe(
    switchMap(() =>
      this.curator.getMe().pipe(
        map((me) => me.is_admin),
        catchError(() => of(false)),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public readonly isAdmin: Signal<boolean> = toSignal(this._isAdmin$, { initialValue: false });

  /** Triggers the first (cached) `GET /me` fetch if one hasn't already happened this session, and
   * returns an Observable of the resolved admin status. Idempotent -- safe to call from both the nav
   * bar and `adminGuard` without duplicating the request. */
  public ensureLoaded(): Observable<boolean> {
    if (!this.loaded) {
      this.loaded = true;
      this._refresh$.next();
    }
    return this._isAdmin$.pipe(take(1));
  }
}
