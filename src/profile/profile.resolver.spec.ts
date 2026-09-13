import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { profileResolver, ResolvedProfile } from './profile.resolver';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PsnPreferencesResponse, PublicProfileResponse } from '../curator/curator.models';

const PROFILE = { is_public: true, viewer_is_owner: false } as unknown as PublicProfileResponse;
const OWN_PROFILE = { is_public: true, viewer_is_owner: true } as unknown as PublicProfileResponse;
const VIEWER_PREFERENCES = { allow_friend_writes: true } as unknown as PsnPreferencesResponse;

function run(
  curator: Partial<CuratorService>,
  routeSub: string | null,
  signedInSub: string | null,
): Promise<ResolvedProfile> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CuratorService, useValue: curator },
      { provide: AuthService, useValue: { sub: signal(signedInSub) } },
    ],
  });

  const route = { paramMap: { get: () => routeSub } } as unknown as ActivatedRouteSnapshot;

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (profileResolver(route, {} as never) as Observable<ResolvedProfile>).subscribe(resolvePromise);
    });
  });
}

describe('profileResolver', () => {
  it('resolves the profile the route names, in preference to the signed-in user', async () => {
    const asked: string[] = [];
    const result = await run(
      {
        getUserProfile: (sub: string) => {
          asked.push(sub);
          return of(PROFILE);
        },
        getPsnPreferences: () => of(VIEWER_PREFERENCES),
      },
      'other-user',
      'me',
    );

    expect(asked).toEqual(['other-user']);
    expect(result).toEqual({ status: 'ok', profile: PROFILE, viewerPreferences: VIEWER_PREFERENCES });
  });

  it('falls back to the signed-in user when the route names nobody', async () => {
    const asked: string[] = [];
    await run(
      {
        getUserProfile: (sub: string) => {
          asked.push(sub);
          return of(OWN_PROFILE);
        },
      },
      null,
      'me',
    );

    expect(asked).toEqual(['me']);
  });

  it("never asks for the viewer's own PSN preferences on their own profile", async () => {
    let askedForPreferences = false;
    const result = await run(
      {
        getUserProfile: () => of(OWN_PROFILE),
        getPsnPreferences: () => {
          askedForPreferences = true;
          return of(VIEWER_PREFERENCES);
        },
      },
      null,
      'me',
    );

    expect(askedForPreferences).toBe(false);
    expect(result).toEqual({ status: 'ok', profile: OWN_PROFILE, viewerPreferences: null });
  });

  it("degrades the viewer's preferences to null rather than failing another user's profile", async () => {
    const result = await run(
      {
        getUserProfile: () => of(PROFILE),
        getPsnPreferences: () => throwError(() => new Error('boom')),
      },
      'other-user',
      'me',
    );

    expect(result).toEqual({ status: 'ok', profile: PROFILE, viewerPreferences: null });
  });

  it('reports no-user when nobody is named and nobody is signed in', async () => {
    let called = false;
    const result = await run(
      {
        getUserProfile: () => {
          called = true;
          return of(PROFILE);
        },
      },
      null,
      null,
    );

    expect(result).toEqual({ status: 'no-user' });
    expect(called).toBe(false);
  });

  it('resolves to an error rather than throwing when the profile cannot be loaded', async () => {
    const result = await run({ getUserProfile: () => throwError(() => new Error('boom')) }, 'u1', null);

    expect(result).toEqual({ status: 'error' });
  });
});
