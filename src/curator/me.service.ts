import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { CuratorService } from './curator.service';
import { MeResponse } from './curator.models';

@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly curator = inject(CuratorService);
  private cached$: Observable<MeResponse | null> | null = null;

  public load(): Observable<MeResponse | null> {
    this.cached$ ??= this.curator.getMe().pipe(
      catchError(() => {
        this.cached$ = null;
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached$;
  }

  public invalidate(): void {
    this.cached$ = null;
  }
}
