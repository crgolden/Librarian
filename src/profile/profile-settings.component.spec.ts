import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileSettingsComponent } from './profile-settings.component';
import {
  ProfileLinkResponse,
  ProfileLinkSiteResponse,
  ProfileSettingKeys,
  ProfileSettingsResponse,
} from '../curator/curator.models';
import { ResolvedProfileSettings } from './profile-settings.resolver';
import { CuratorApi, CuratorRoutes } from '../curator/curator-api';
import { AppUrls, RouteDataKeys } from '../app/app-paths';
import { LINK_SAVE_ERROR, PROFILE_SETTINGS_LOAD_ERROR, SETTING_UPDATE_ERROR } from './profile.messages';
import { HttpMethods } from '../bff/http-headers';
import { ResolvedStatuses } from '../shared/resolved-status';
import { LinkRelTokens } from '../testing/html-constants';
import { lowercaseToken, newDisplayName, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const FIRST_SITE_KEY = newId();
const SECOND_SITE_KEY = newId();
const DECLARED_HANDLE = newText();
const NEW_HANDLE = newText();

interface ProfileSettingsHarness {
  onToggle(field: keyof ProfileSettingsResponse, newValue: boolean): void;
  onHandleInput(siteKey: string, value: string): void;
  saveLink(siteKey: string): void;
  removeLink(siteKey: string): void;
}

function harness(fixture: ComponentFixture<ProfileSettingsComponent>): ProfileSettingsHarness {
  return fixture.componentInstance as unknown as ProfileSettingsHarness;
}

const ALL_OFF: ProfileSettingsResponse = {
  is_public: false,
  show_library: false,
  show_collections: false,
  show_trophies: false,
  show_identity: false,
};

const SITES: ProfileLinkSiteResponse[] = [
  { site_key: FIRST_SITE_KEY, display_name: newText() },
  { site_key: SECOND_SITE_KEY, display_name: newText() },
];

const PSNPROFILES_LINK: ProfileLinkResponse = {
  site_key: FIRST_SITE_KEY,
  display_name: SITES[0].display_name,
  handle: DECLARED_HANDLE,
  url: newHttpsAddress(),
};

describe('ProfileSettingsComponent', () => {
  let httpMock: HttpTestingController;

  function configure(resolved: ResolvedProfileSettings): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}), data: { [RouteDataKeys.settings]: resolved } } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    configure({ status: ResolvedStatuses.ok, settings: ALL_OFF, sites: SITES, links: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function createAndLoad(
    settings: ProfileSettingsResponse = ALL_OFF,
    links: ProfileLinkResponse[] = [],
  ): Promise<ComponentFixture<ProfileSettingsComponent>> {
    configure({ status: ResolvedStatuses.ok, settings, sites: SITES, links });
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders the resolved settings with no request of its own', async () => {
    const fixture = await createAndLoad({ ...ALL_OFF, is_public: true, show_library: true });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector<HTMLInputElement>('#setting-is-public')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-library')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-collections')?.checked).toBe(false);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.checked).toBe(false);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(false);
    httpMock.expectNone((r) => r.url.endsWith(CuratorRoutes.meProfileSettings));
  });

  it('renders no "Loading..." text, because the route resolves before it activates', async () => {
    const fixture = await createAndLoad();

    expect((fixture.nativeElement as HTMLElement).querySelector('#setting-is-public')).not.toBeNull();
  });

  it('shows an error message when the resolver degraded', () => {
    configure({ status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(PROFILE_SETTINGS_LOAD_ERROR);
  });

  it('explains the AND-gate with harvest_* and links to the PSN settings page', async () => {
    const fixture = await createAndLoad();
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#profile-settings-harvest-note')).not.toBeNull();
    const link = compiled.querySelector('#profile-settings-psn-link');
    expect(link?.getAttribute('href')).toBe(AppUrls.account);
  });

  it('onToggle sends a PUT with the full settings body, not just the changed field', async () => {
    const fixture = await createAndLoad({ ...ALL_OFF, show_library: true });

    harness(fixture).onToggle(ProfileSettingKeys.isPublic, true);

    const req = httpMock.expectOne(CuratorApi.meProfileSettings);
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ ...ALL_OFF, show_library: true, is_public: true });
    req.flush({ ...ALL_OFF, show_library: true, is_public: true });
  });

  it('optimistically checks the toggle immediately, then confirms on success', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle(ProfileSettingKeys.showTrophies, true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.disabled).toBe(true);

    const req = httpMock.expectOne(CuratorApi.meProfileSettings);
    req.flush({ ...ALL_OFF, show_trophies: true });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.disabled).toBe(false);
  });

  it('reverts the optimistic toggle and shows an error when the PUT fails', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle(ProfileSettingKeys.showIdentity, true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(true);

    const req = httpMock.expectOne(CuratorApi.meProfileSettings);
    req.flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(false);
    expect(compiled.textContent).toContain(SETTING_UPDATE_ERROR);
  });

  it('all five toggles are independently wired to onToggle with their own field name', async () => {
    const fixture = await createAndLoad();

    const fields: (keyof ProfileSettingsResponse)[] = Object.values(ProfileSettingKeys);

    for (const field of fields) {
      harness(fixture).onToggle(field, true);
      const req = httpMock.expectOne(CuratorApi.meProfileSettings);
      expect(req.request.body).toEqual(expect.objectContaining({ [field]: true }));
      req.flush({ ...ALL_OFF, [field]: true });
      await fixture.whenStable();
      fixture.detectChanges();
    }
  });

  it('renders one row per allowlisted site, prefilled with the handle already declared', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelectorAll('[id^="profile-link-handle-"]')).toHaveLength(SITES.length);
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe(DECLARED_HANDLE);
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-1')?.value).toBe('');
    httpMock.expectNone((r) => r.url.includes(CuratorRoutes.meProfileLinks));
  });

  it('renders the URL Curator built, never one assembled in the browser', async () => {
    const builtUrl = newHttpsAddress();
    const fixture = await createAndLoad(ALL_OFF, [{ ...PSNPROFILES_LINK, url: builtUrl }]);
    const anchor = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#profile-link-url-0');

    expect(anchor?.getAttribute('href')).toBe(builtUrl);
    expect(anchor?.getAttribute('rel')).toBe(
      [LinkRelTokens.noopener, LinkRelTokens.noreferrer, LinkRelTokens.nofollow, LinkRelTokens.ugc].join(' '),
    );
  });

  it('offers Remove and Open only for a site that has a link', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#profile-link-remove-0')).not.toBeNull();
    expect(compiled.querySelector('#profile-link-url-0')).not.toBeNull();
    expect(compiled.querySelector('#profile-link-remove-1')).toBeNull();
    expect(compiled.querySelector('#profile-link-url-1')).toBeNull();
  });

  it('names the site in every row control\'s accessible name, so three rows are not three "Save"s', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('#profile-link-save-0')?.getAttribute('aria-label')).toBe(
      `Save your ${SITES[0].display_name} handle`,
    );
    expect(compiled.querySelector('#profile-link-save-1')?.getAttribute('aria-label')).toBe(
      `Save your ${SITES[1].display_name} handle`,
    );
    expect(compiled.querySelector('#profile-link-remove-0')?.getAttribute('aria-label')).toBe(
      `Remove your ${SITES[0].display_name} handle`,
    );
    expect(compiled.querySelector('#profile-link-url-0')?.getAttribute('aria-label')).toBe(
      `Open your ${SITES[0].display_name} profile`,
    );
  });

  it('disables Save until the handle is both valid and changed', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);
    const save = (): HTMLButtonElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#profile-link-save-0');

    expect(save()?.disabled).toBe(true);

    h.onHandleInput(FIRST_SITE_KEY, lowercaseToken(2));
    fixture.detectChanges();
    expect(save()?.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('#profile-link-invalid-0')).not.toBeNull();

    h.onHandleInput(FIRST_SITE_KEY, NEW_HANDLE);
    fixture.detectChanges();
    expect(save()?.disabled).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('#profile-link-invalid-0')).toBeNull();
  });

  it('saveLink PUTs the trimmed handle to the site it belongs to and renders the returned link', async () => {
    const SAVED_URL = newHttpsAddress();
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput(SECOND_SITE_KEY, `  ${NEW_HANDLE}  `);
    h.saveLink(SECOND_SITE_KEY);

    const req = httpMock.expectOne(CuratorApi.meProfileLinksBySiteKey(SECOND_SITE_KEY));
    expect(req.request.method).toBe(HttpMethods.put);
    expect(req.request.body).toEqual({ handle: NEW_HANDLE });
    req.flush({
      site_key: SECOND_SITE_KEY,
      display_name: SITES[1].display_name,
      handle: NEW_HANDLE,
      url: SAVED_URL,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const anchor = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#profile-link-url-1');
    expect(anchor?.getAttribute('href')).toBe(SAVED_URL);
  });

  it('saveLink issues no request for a handle the server would reject', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput(FIRST_SITE_KEY, newDisplayName());
    h.saveLink(FIRST_SITE_KEY);

    httpMock.expectNone((r) => r.url.includes(CuratorRoutes.meProfileLinks));
  });

  it('removeLink DELETEs and drops the row back to an empty handle', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);

    h.removeLink(FIRST_SITE_KEY);

    const req = httpMock.expectOne(CuratorApi.meProfileLinksBySiteKey(FIRST_SITE_KEY));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: HttpStatusCode[HttpStatusCode.NoContent] });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#profile-link-url-0')).toBeNull();
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe('');
  });

  it('saving one row leaves text typed into another row untouched', async () => {
    const STILL_TYPING = newText();
    const SAVED_URL = newHttpsAddress();
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput(FIRST_SITE_KEY, STILL_TYPING);
    h.onHandleInput(SECOND_SITE_KEY, NEW_HANDLE);
    h.saveLink(SECOND_SITE_KEY);
    httpMock.expectOne(CuratorApi.meProfileLinksBySiteKey(SECOND_SITE_KEY)).flush({
      site_key: SECOND_SITE_KEY,
      display_name: SITES[1].display_name,
      handle: NEW_HANDLE,
      url: SAVED_URL,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe(STILL_TYPING);
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-1')?.value).toBe(NEW_HANDLE);
  });

  it('keeps the existing link and shows an error when the save fails', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);

    h.onHandleInput(FIRST_SITE_KEY, NEW_HANDLE);
    h.saveLink(FIRST_SITE_KEY);
    httpMock
      .expectOne(CuratorApi.meProfileLinksBySiteKey(FIRST_SITE_KEY))
      .flush(null, { status: HttpStatusCode.InternalServerError, statusText: HttpStatusCode[HttpStatusCode.InternalServerError] });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(LINK_SAVE_ERROR);
    expect(compiled.querySelector<HTMLAnchorElement>('#profile-link-url-0')?.getAttribute('href')).toBe(
      PSNPROFILES_LINK.url,
    );
  });
});
