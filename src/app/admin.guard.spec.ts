import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter, Router } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AdminService } from '../admin/admin.service';

describe('adminGuard', () => {
  function configure(isAdmin: boolean): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: { ensureLoaded: () => of(isAdmin) } },
      ],
    });
  }

  async function run(): Promise<boolean | UrlTree> {
    // adminGuard's declared CanActivateFn return type is broader (Observable<GuardResult>, where
    // GuardResult also allows RedirectCommand/Promise) than what the real implementation ever produces
    // -- it always returns Observable<boolean | UrlTree> (see admin.guard.ts's own doc comment). Narrow
    // to that actual shape right after the call instead of fighting the wider union at every use below.
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never)) as
      | Observable<boolean | UrlTree>
      | boolean
      | UrlTree;
    return isObservable(result) ? firstValueFrom(result) : result;
  }

  it('allows navigation when the caller is an admin', async () => {
    configure(true);

    expect(await run()).toBe(true);
  });

  it('resolves to a UrlTree redirect to / when the caller is authenticated but not an admin', async () => {
    configure(false);
    const router = TestBed.inject(Router);

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
