import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter, type Data } from '@angular/router';
import { page } from 'vitest/browser';
import axe from 'axe-core';
import { newId } from '@crgolden/modules/testing';
import { AXE_WCAG_AA_RUN } from '../../e2e/axe-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AdminEnrichmentComponent } from '../admin/admin-enrichment.component';
import type { ResolvedEnrichmentRun } from '../admin/admin-enrichment.resolver';
import { AuthService, type Session } from '../auth/auth.service';
import { CatalogComponent } from '../catalog/catalog.component';
import { CollectionsComponent } from '../collections/collections.component';
import { CollectionsModes, type ResolvedCollections } from '../collections/collections.resolver';
import { ConsolesComponent } from '../consoles/consoles.component';
import type { ConsolesPageData } from '../consoles/consoles.resolver';
import type { CatalogGamesResponse } from '../curator/curator.models';
import { FaqComponent } from '../faq/faq.component';
import { HomeComponent } from '../home/home.component';
import type { HomeSummary } from '../home/home.resolver';
import { LibraryComponent } from '../library/library.component';
import type { ResolvedLibrary } from '../library/library.resolver';
import { PrivacyComponent } from '../privacy/privacy.component';
import { ProfileViewComponent } from '../profile/profile-view.component';
import type { ResolvedProfile } from '../profile/profile.resolver';
import { PsnSettingsComponent } from '../psn/psn-settings.component';
import type { ResolvedPsnStatus } from '../psn/psn-status.resolver';
import { ADMIN_CLAIM_VALUE, BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { ResolvedStatuses } from '../shared/resolved-status';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { AppComponent } from './app.component';
import { AppPaths, AppUrls, RouteDataKeys } from './app-paths';

const DESKTOP = e2eSettings.viewports.desktop;

interface PageUnderScan {
  path: string;
  url: string;
  component: Type<unknown>;
  data: Data;
}

const OWN_SUB = newId();

const MEMBER: Session = [{ type: ClaimTypes.sub, value: OWN_SUB }];
const ADMIN: Session = [...MEMBER, { type: ClaimTypes.admin, value: ADMIN_CLAIM_VALUE }];

const HOME: PageUnderScan = {
  path: AppPaths.home,
  url: AppUrls.home,
  component: HomeComponent,
  data: { [RouteDataKeys.summary]: { libraryTotal: 0, collectionCount: 0, collectionEntries: 0, linked: false } satisfies HomeSummary },
};
const CATALOG: PageUnderScan = {
  path: AppPaths.catalog,
  url: AppUrls.catalog,
  component: CatalogComponent,
  data: { [RouteDataKeys.catalog]: { games: [], total: 0, excluded_owned: 0 } satisfies CatalogGamesResponse, [RouteDataKeys.genres]: [] },
};
const FAQ: PageUnderScan = { path: AppPaths.faq, url: AppUrls.faq, component: FaqComponent, data: {} };
const PRIVACY: PageUnderScan = { path: AppPaths.privacy, url: AppUrls.privacy, component: PrivacyComponent, data: {} };

const MEMBER_PAGES: PageUnderScan[] = [
  HOME,
  CATALOG,
  {
    path: AppPaths.library,
    url: AppUrls.library,
    component: LibraryComponent,
    data: {
      [RouteDataKeys.library]: {
        status: ResolvedStatuses.ok,
        games: [],
        total: 0,
        genres: [],
        schedule: null,
        trophyProgress: null,
        hiddenCount: 0,
        psPlus: null,
      } satisfies ResolvedLibrary,
    },
  },
  {
    path: AppPaths.collections,
    url: AppUrls.collections,
    component: CollectionsComponent,
    data: {
      [RouteDataKeys.collections]: { mode: CollectionsModes.list, definitions: [], consoles: [] } satisfies ResolvedCollections,
      [RouteDataKeys.genres]: [],
    },
  },
  {
    path: AppPaths.profile,
    url: AppUrls.profile,
    component: ProfileViewComponent,
    data: {
      [RouteDataKeys.profile]: {
        status: ResolvedStatuses.ok,
        viewerPreferences: null,
        profile: {
          sub: OWN_SUB,
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
        },
      } satisfies ResolvedProfile,
    },
  },
  {
    path: AppPaths.account,
    url: AppUrls.account,
    component: PsnSettingsComponent,
    data: {
      [RouteDataKeys.status]: {
        status: { sub: OWN_SUB, email: null, linked: false, psn: null },
        enrichmentKeys: {
          rawg_configured: false,
          opencritic_configured: false,
          rawg_added_at: null,
          opencritic_added_at: null,
          rawg_key_rejected_at: null,
          opencritic_key_rejected_at: null,
        },
        schedule: null,
        preferences: null,
        trophySummary: null,
        identity: null,
        friendRequests: null,
        presence: null,
        devices: null,
        consoles: [],
      } satisfies ResolvedPsnStatus,
    },
  },
  {
    path: AppPaths.consoles,
    url: AppUrls.consoles,
    component: ConsolesComponent,
    data: { [RouteDataKeys.consoles]: { consoles: [], devices: [] } satisfies ConsolesPageData, [RouteDataKeys.genres]: [] },
  },
];

const ADMIN_PAGE: PageUnderScan = {
  path: AppPaths.adminEnrichment,
  url: AppUrls.adminEnrichment,
  component: AdminEnrichmentComponent,
  data: { [RouteDataKeys.latestRun]: { status: ResolvedStatuses.none } satisfies ResolvedEnrichmentRun },
};

async function renderPage(pageUnderScan: PageUnderScan, session: Session | null): Promise<void> {
  await page.viewport(DESKTOP.width, DESKTOP.height);
  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([{ path: pageUnderScan.path, component: pageUnderScan.component, data: pageUnderScan.data }]),
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
    ],
  }).compileComponents();
  await resolveTestComponentResources();
  TestBed.inject(AuthService).refresh();
  TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush(session);
  const fixture = TestBed.createComponent(AppComponent);
  await TestBed.inject(Router).navigateByUrl(pageUnderScan.url);
  fixture.detectChanges();
  await fixture.whenStable();
  await document.fonts.ready;
}

function summarise(results: axe.Result[]): { id: string; targets: string[]; html: string[] }[] {
  return results.map((result) => ({
    id: result.id,
    targets: result.nodes.map((node) => node.target.flat().join(' ')),
    html: result.nodes.map((node) => node.html),
  }));
}

async function scan(): Promise<axe.AxeResults> {
  return axe.run(document, AXE_WCAG_AA_RUN);
}

describe('Accessibility of each page for a signed-in member', () => {
  it.each(MEMBER_PAGES)('finds no WCAG A/AA violation on $url', async (pageUnderScan) => {
    await renderPage(pageUnderScan, MEMBER);

    const results = await scan();

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });

  it('finds no WCAG A/AA violation on enrichment runs for an administrator', async () => {
    await renderPage(ADMIN_PAGE, ADMIN);
    await expect
      .poll(() => document.querySelector('#enrichment-no-run') !== null, { message: 'the page never rendered, so an error scans as clean' })
      .toBe(true);

    const results = await scan();

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });
});

describe('Accessibility of each page for a visitor', () => {
  it.each([HOME, CATALOG, FAQ, PRIVACY])('finds no WCAG A/AA violation on $url', async (pageUnderScan) => {
    await renderPage(pageUnderScan, null);

    const results = await scan();

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });
});
