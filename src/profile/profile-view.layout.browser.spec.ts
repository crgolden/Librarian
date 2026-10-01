import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { page } from 'vitest/browser';
import { newId } from '@crgolden/modules/testing';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppComponent } from '../app/app.component';
import { AppPaths, AppUrls, RouteDataKeys } from '../app/app-paths';
import { AuthService } from '../auth/auth.service';
import type { PublicProfileResponse } from '../curator/curator.models';
import { BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { ResolvedStatuses } from '../shared/resolved-status';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { ProfileViewComponent } from './profile-view.component';
import type { ResolvedProfile } from './profile.resolver';

const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const PROFILE_HEIGHT = e2eSettings.viewports.xl.height;

function ownProfile(): ResolvedProfile {
  const profile: PublicProfileResponse = {
    sub: newId(),
    psn_account_id: null,
    is_public: false,
    viewer_is_owner: true,
    viewer_is_following: false,
    follower_count: 0,
    following_count: 0,
    library_visible: true,
    collections_visible: true,
    trophies: null,
    identity: null,
    created_at: null,
    library_count: 0,
    collections_count: 0,
    trophies_hidden_by_owner_setting: false,
    profile_links: [],
  };
  return { status: ResolvedStatuses.ok, profile, viewerPreferences: null };
}

async function renderProfileInShell(width: number, height: number): Promise<void> {
  await page.viewport(width, height);
  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([{ path: AppPaths.profile, component: ProfileViewComponent, data: { [RouteDataKeys.profile]: ownProfile() } }]),
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
    ],
  }).compileComponents();
  await resolveTestComponentResources();
  TestBed.inject(AuthService).refresh();
  TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: newId() }]);
  const fixture = TestBed.createComponent(AppComponent);
  await TestBed.inject(Router).navigateByUrl(AppUrls.profile);
  fixture.detectChanges();
  await fixture.whenStable();
  await document.fonts.ready;
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function tokenPx(token: string): number {
  const probe = document.createElement('div');
  probe.style.width = `var(${token})`;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

describe('The profile page in the app shell', () => {
  it('holds the data measure that the library holds', async () => {
    await renderProfileInShell(e2eSettings.viewports.desktop.width, e2eSettings.viewports.desktop.height);

    const dataMeasure = tokenPx('--container-data');
    expect(dataMeasure).toBeGreaterThan(0);
    expect(Math.abs(required('#profile-view').getBoundingClientRect().width - dataMeasure)).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it.each(e2eSettings.layout.profileStatGridTracks)(
    'resolves the stat grid to $expectedTracks track(s) at $width px with no media query',
    async ({ width, expectedTracks }) => {
      await renderProfileInShell(width, PROFILE_HEIGHT);

      expect(getComputedStyle(required('#profile-stat-grid')).gridTemplateColumns.split(' ')).toHaveLength(expectedTracks);
    },
  );
});
