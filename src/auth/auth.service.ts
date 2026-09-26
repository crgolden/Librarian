import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, of, shareReplay, Subject, switchMap, take } from 'rxjs';
import { Claim } from './claim';
import { FETCHES_SESSION_ON_STARTUP } from './session-fetch';
import { BFF_USER_RELATIVE_PATH, BffPaths, ClaimTypes } from '../shared/bff-contract';

export type { Claim } from './claim';
export type Session = Claim[];

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly fetchesSessionOnStartup = inject(FETCHES_SESSION_ON_STARTUP);
  private readonly _refresh$ = new Subject<void>();

  private readonly _fetchResult$ = this._refresh$.pipe(
    switchMap(() =>
      this.http.get<Claim[] | null>(BFF_USER_RELATIVE_PATH).pipe(
        catchError(() => of(null))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly _fetchResult = toSignal(this._fetchResult$, {
    initialValue: null as Claim[] | null
  });

  public readonly isAuthenticated: Signal<boolean> = computed(() => this._fetchResult() !== null);
  public readonly isAnonymous: Signal<boolean> = computed(() => this._fetchResult() === null);
  public readonly session: Signal<Session> = computed(() => this._fetchResult() ?? []);
  public readonly sub: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === ClaimTypes.sub)?.value ?? null
  );
  public readonly username: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === ClaimTypes.name)?.value ?? null
  );
  public readonly email: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === ClaimTypes.email)?.value ?? null
  );
  public readonly picture: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === ClaimTypes.picture)?.value ?? null
  );
  public readonly logoutUrl: Signal<string | null> = computed(() => {
    const s = this._fetchResult();
    if (!s) return null;
    return s.find(x => x.type === ClaimTypes.logoutUrl)?.value ?? null;
  });

  public readonly silentLoginUrl: string = BffPaths.silentLogin;
  public readonly loginUrl: string = BffPaths.login;

  public initialize(): Observable<Session> {
    if (!this.fetchesSessionOnStartup) {
      return of([]);
    }
    this._refresh$.next();
    return this._fetchResult$.pipe(
      map(s => s ?? []),
      take(1)
    );
  }

  public refresh(): void {
    this._refresh$.next();
  }
}
