import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject, map, shareReplay, switchMap, take, tap } from 'rxjs';
import { MeService } from '../curator/me.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly me = inject(MeService);
  private readonly _refresh$ = new Subject<void>();
  private loaded = false;

  private readonly _isAdmin$ = this._refresh$.pipe(
    switchMap(() => this.me.load()),
    tap((me) => {
      if (me === null) {
        this.loaded = false;
      }
    }),
    map((me) => me?.is_admin ?? false),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public readonly isAdmin: Signal<boolean> = toSignal(this._isAdmin$, { initialValue: false });

  public ensureLoaded(): Observable<boolean> {
    if (!this.loaded) {
      this.loaded = true;
      this._refresh$.next();
    }
    return this._isAdmin$.pipe(take(1));
  }
}
