import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ProfileSettingsComponent } from './profile-settings.component';
import { ProfileLinkResponse, ProfileLinkSiteResponse, ProfileSettingsResponse } from '../curator/curator.models';
import { ResolvedProfileSettings } from './profile-settings.resolver';

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
  { site_key: 'psnprofiles', display_name: 'PSNProfiles' },
  { site_key: 'truetrophies', display_name: 'TrueTrophies' },
];

const PSNPROFILES_LINK: ProfileLinkResponse = {
  site_key: 'psnprofiles',
  display_name: 'PSNProfiles',
  handle: 'curator_one',
  url: 'https://psnprofiles.com/curator_one',
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
          useValue: { snapshot: { paramMap: convertToParamMap({}), data: { settings: resolved } } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    configure({ status: 'ok', settings: ALL_OFF, sites: SITES, links: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** The route resolves the first payload, so activation waits and the component issues no load request. */
  async function createAndLoad(
    settings: ProfileSettingsResponse = ALL_OFF,
    links: ProfileLinkResponse[] = [],
  ): Promise<ComponentFixture<ProfileSettingsComponent>> {
    configure({ status: 'ok', settings, sites: SITES, links });
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
    httpMock.expectNone((r) => r.url.endsWith('/me/profile-settings'));
  });

  it('renders no "Loading..." text, because the route resolves before it activates', async () => {
    const fixture = await createAndLoad();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Loading');
  });

  it('shows an error message when the resolver degraded', () => {
    configure({ status: 'error' });
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load profile settings.');
  });

  it('explains the AND-gate with harvest_* and links to the PSN settings page', async () => {
    const fixture = await createAndLoad();
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.textContent).toContain("you've also enabled harvesting them");
    const link = compiled.querySelector('a[routerLink="/psn"]');
    expect(link).not.toBeNull();
  });

  it('onToggle sends a PUT with the full settings body, not just the changed field', async () => {
    const fixture = await createAndLoad({ ...ALL_OFF, show_library: true });

    harness(fixture).onToggle('is_public', true);

    const req = httpMock.expectOne('/curator/api/me/profile-settings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...ALL_OFF, show_library: true, is_public: true });
    req.flush({ ...ALL_OFF, show_library: true, is_public: true });
  });

  it('optimistically checks the toggle immediately, then confirms on success', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);
    const compiled: HTMLElement = fixture.nativeElement;

    h.onToggle('show_trophies', true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.disabled).toBe(true);

    const req = httpMock.expectOne('/curator/api/me/profile-settings');
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

    h.onToggle('show_identity', true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(true);

    const req = httpMock.expectOne('/curator/api/me/profile-settings');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(false);
    expect(compiled.textContent).toContain('Failed to update setting. Please try again.');
  });

  it('all five toggles are independently wired to onToggle with their own field name', async () => {
    const fixture = await createAndLoad();

    const fields: (keyof ProfileSettingsResponse)[] = [
      'is_public',
      'show_library',
      'show_collections',
      'show_trophies',
      'show_identity',
    ];

    for (const field of fields) {
      harness(fixture).onToggle(field, true);
      const req = httpMock.expectOne('/curator/api/me/profile-settings');
      expect(req.request.body).toEqual(expect.objectContaining({ [field]: true }));
      req.flush({ ...ALL_OFF, [field]: true });
      await fixture.whenStable();
      fixture.detectChanges();
    }
  });

  it('renders one row per allowlisted site, prefilled with the handle already declared', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelectorAll('.profile-link-row')).toHaveLength(SITES.length);
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe('curator_one');
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-1')?.value).toBe('');
    httpMock.expectNone((r) => r.url.includes('/me/profile-link'));
  });

  it('renders the URL Curator built, never one assembled in the browser', async () => {
    const fixture = await createAndLoad(ALL_OFF, [
      { ...PSNPROFILES_LINK, url: 'https://psnprofiles.com/somewhere-else' },
    ]);
    const anchor = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#profile-link-url-0');

    expect(anchor?.getAttribute('href')).toBe('https://psnprofiles.com/somewhere-else');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer nofollow ugc');
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
      'Save your PSNProfiles handle',
    );
    expect(compiled.querySelector('#profile-link-save-1')?.getAttribute('aria-label')).toBe(
      'Save your TrueTrophies handle',
    );
    expect(compiled.querySelector('#profile-link-remove-0')?.getAttribute('aria-label')).toBe(
      'Remove your PSNProfiles handle',
    );
    expect(compiled.querySelector('#profile-link-url-0')?.getAttribute('aria-label')).toBe(
      'Open your PSNProfiles profile',
    );
  });

  it('disables Save until the handle is both valid and changed', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);
    const save = (): HTMLButtonElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#profile-link-save-0');

    expect(save()?.disabled).toBe(true);

    h.onHandleInput('psnprofiles', 'ab');
    fixture.detectChanges();
    expect(save()?.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('#profile-link-invalid-0')).not.toBeNull();

    h.onHandleInput('psnprofiles', 'curator_two');
    fixture.detectChanges();
    expect(save()?.disabled).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('#profile-link-invalid-0')).toBeNull();
  });

  it('saveLink PUTs the trimmed handle to the site it belongs to and renders the returned link', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput('truetrophies', '  curator_two  ');
    h.saveLink('truetrophies');

    const req = httpMock.expectOne('/curator/api/me/profile-links/truetrophies');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ handle: 'curator_two' });
    req.flush({
      site_key: 'truetrophies',
      display_name: 'TrueTrophies',
      handle: 'curator_two',
      url: 'https://www.truetrophies.com/gamer/curator_two',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const anchor = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#profile-link-url-1');
    expect(anchor?.getAttribute('href')).toBe('https://www.truetrophies.com/gamer/curator_two');
  });

  it('saveLink issues no request for a handle the server would reject', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput('psnprofiles', 'no spaces allowed');
    h.saveLink('psnprofiles');

    httpMock.expectNone((r) => r.url.includes('/me/profile-links'));
  });

  it('removeLink DELETEs and drops the row back to an empty handle', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);

    h.removeLink('psnprofiles');

    const req = httpMock.expectOne('/curator/api/me/profile-links/psnprofiles');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#profile-link-url-0')).toBeNull();
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe('');
  });

  it('saving one row leaves text typed into another row untouched', async () => {
    const fixture = await createAndLoad();
    const h = harness(fixture);

    h.onHandleInput('psnprofiles', 'still_typing');
    h.onHandleInput('truetrophies', 'curator_two');
    h.saveLink('truetrophies');
    httpMock.expectOne('/curator/api/me/profile-links/truetrophies').flush({
      site_key: 'truetrophies',
      display_name: 'TrueTrophies',
      handle: 'curator_two',
      url: 'https://www.truetrophies.com/gamer/curator_two',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-0')?.value).toBe('still_typing');
    expect(compiled.querySelector<HTMLInputElement>('#profile-link-handle-1')?.value).toBe('curator_two');
  });

  it('keeps the existing link and shows an error when the save fails', async () => {
    const fixture = await createAndLoad(ALL_OFF, [PSNPROFILES_LINK]);
    const h = harness(fixture);

    h.onHandleInput('psnprofiles', 'curator_two');
    h.saveLink('psnprofiles');
    httpMock
      .expectOne('/curator/api/me/profile-links/psnprofiles')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Failed to save the link. Please try again.');
    expect(compiled.querySelector<HTMLAnchorElement>('#profile-link-url-0')?.getAttribute('href')).toBe(
      'https://psnprofiles.com/curator_one',
    );
  });
});
