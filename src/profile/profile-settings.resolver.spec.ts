import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { profileSettingsResolver, ResolvedProfileSettings } from './profile-settings.resolver';
import { ProfileLinkResponse, ProfileLinkSiteResponse, ProfileSettingsResponse } from '../curator/curator.models';
import { CuratorApi } from '../curator/curator-api';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const SITE_KEY = newId();
const SITE_DISPLAY_NAME = newText();

const ALL_OFF: ProfileSettingsResponse = {
  is_public: false,
  show_library: false,
  show_collections: false,
  show_trophies: false,
  show_identity: false,
};

const SITES: ProfileLinkSiteResponse[] = [{ site_key: SITE_KEY, display_name: SITE_DISPLAY_NAME }];

const PSNPROFILES_LINK: ProfileLinkResponse = {
  site_key: SITE_KEY,
  display_name: SITE_DISPLAY_NAME,
  handle: newText(),
  url: newHttpsAddress(),
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
    httpMock.expectOne(CuratorApi.meProfileSettings).flush({ ...ALL_OFF, is_public: true });
    httpMock.expectOne(CuratorApi.meProfileLinkSites).flush(SITES);
    httpMock.expectOne(CuratorApi.meProfileLinks).flush([PSNPROFILES_LINK]);

    expect(await resolved).toEqual({
      status: ResolvedStatuses.ok,
      settings: { ...ALL_OFF, is_public: true },
      sites: SITES,
      links: [PSNPROFILES_LINK],
    });
  });

  it('degrades to a tagged error rather than redirecting, so the URL is not lost', async () => {
    const resolved = runResolver();
    httpMock.expectOne(CuratorApi.meProfileLinkSites).flush(SITES);
    httpMock.expectOne(CuratorApi.meProfileLinks).flush([]);
    httpMock
      .expectOne(CuratorApi.meProfileSettings)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(await resolved).toEqual({ status: ResolvedStatuses.error });
  });

  it('degrades when only the profile-link half fails, rather than rendering a half-true page', async () => {
    const resolved = runResolver();
    httpMock.expectOne(CuratorApi.meProfileSettings).flush(ALL_OFF);
    httpMock.expectOne(CuratorApi.meProfileLinkSites).flush(SITES);
    httpMock
      .expectOne(CuratorApi.meProfileLinks)
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });

    expect(await resolved).toEqual({ status: ResolvedStatuses.error });
  });
});
