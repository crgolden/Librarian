import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { profileSettingsResolver, ResolvedProfileSettings } from './profile-settings.resolver';
import { ProfileLinkResponse, ProfileLinkSiteResponse, ProfileSettingsResponse } from '../curator/curator.models';

const ALL_OFF: ProfileSettingsResponse = {
  is_public: false,
  show_library: false,
  show_collections: false,
  show_trophies: false,
  show_identity: false,
};

const SITES: ProfileLinkSiteResponse[] = [{ site_key: 'psnprofiles', display_name: 'PSNProfiles' }];

const PSNPROFILES_LINK: ProfileLinkResponse = {
  site_key: 'psnprofiles',
  display_name: 'PSNProfiles',
  handle: 'curator_one',
  url: 'https://psnprofiles.com/curator_one',
};

function runResolver(): Promise<ResolvedProfileSettings> {
  return firstValueFrom(
    TestBed.runInInjectionContext(() =>
      profileSettingsResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<ResolvedProfileSettings>,
  );
}

describe('profileSettingsResolver', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('resolves the settings, the allowlisted sites and the declared links on success', async () => {
    const resolved = runResolver();
    httpMock.expectOne('/curator/api/me/profile-settings').flush({ ...ALL_OFF, is_public: true });
    httpMock.expectOne('/curator/api/me/profile-link-sites').flush(SITES);
    httpMock.expectOne('/curator/api/me/profile-links').flush([PSNPROFILES_LINK]);

    expect(await resolved).toEqual({
      status: 'ok',
      settings: { ...ALL_OFF, is_public: true },
      sites: SITES,
      links: [PSNPROFILES_LINK],
    });
  });

  it('degrades to a tagged error rather than redirecting, so the URL is not lost', async () => {
    const resolved = runResolver();
    httpMock.expectOne('/curator/api/me/profile-link-sites').flush(SITES);
    httpMock.expectOne('/curator/api/me/profile-links').flush([]);
    httpMock
      .expectOne('/curator/api/me/profile-settings')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(await resolved).toEqual({ status: 'error' });
  });

  it('degrades when only the profile-link half fails, rather than rendering a half-true page', async () => {
    const resolved = runResolver();
    httpMock.expectOne('/curator/api/me/profile-settings').flush(ALL_OFF);
    httpMock.expectOne('/curator/api/me/profile-link-sites').flush(SITES);
    httpMock
      .expectOne('/curator/api/me/profile-links')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(await resolved).toEqual({ status: 'error' });
  });
});
