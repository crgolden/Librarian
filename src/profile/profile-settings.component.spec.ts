import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileSettingsComponent } from './profile-settings.component';
import { ProfileSettingsResponse } from '../curator/curator.models';

interface ProfileSettingsHarness {
  onToggle(field: keyof ProfileSettingsResponse, newValue: boolean): void;
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

describe('ProfileSettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Zoneless change detection settles asynchronously -- `fixture.whenStable()` is required (not
  // just `detectChanges()`) before an `[ngModel]`-bound checkbox's `.checked` DOM property reliably
  // reflects a signal update that happened inside an async subscribe callback.
  async function createAndLoad(settings: ProfileSettingsResponse = ALL_OFF): Promise<ComponentFixture<ProfileSettingsComponent>> {
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/me/profile-settings').flush(settings);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('fetches and renders the current settings on load', async () => {
    const fixture = await createAndLoad({ ...ALL_OFF, is_public: true, show_library: true });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector<HTMLInputElement>('#setting-is-public')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-library')?.checked).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-collections')?.checked).toBe(false);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-trophies')?.checked).toBe(false);
    expect(compiled.querySelector<HTMLInputElement>('#setting-show-identity')?.checked).toBe(false);
  });

  it('shows an error message when loading settings fails', () => {
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/me/profile-settings').flush(null, { status: 500, statusText: 'Error' });
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
});
