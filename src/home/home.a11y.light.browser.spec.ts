import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { page } from 'vitest/browser';
import axe from 'axe-core';
import { newId } from '@crgolden/modules/testing';
import { AXE_WCAG_AA_RUN } from '../../e2e/axe-constants';
import { ColorSchemeQueries } from '../../e2e/css-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppComponent } from '../app/app.component';
import { AppPaths, AppUrls, RouteDataKeys } from '../app/app-paths';
import { AuthService } from '../auth/auth.service';
import { BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { HomeComponent } from './home.component';
import type { HomeSummary } from './home.resolver';

const DESKTOP = e2eSettings.viewports.desktop;

function summarise(results: axe.Result[]): { id: string; targets: string[]; html: string[] }[] {
  return results.map((result) => ({
    id: result.id,
    targets: result.nodes.map((node) => node.target.flat().join(' ')),
    html: result.nodes.map((node) => node.html),
  }));
}

describe('Accessibility of the home page in the light scheme', () => {
  it('finds no WCAG A/AA violation in the light re-binding as well as the dark base', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const summary: HomeSummary = { libraryTotal: 0, collectionCount: 0, collectionEntries: 0, linked: false };
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([{ path: AppPaths.home, component: HomeComponent, data: { [RouteDataKeys.summary]: summary } }]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    await resolveTestComponentResources();
    TestBed.inject(AuthService).refresh();
    TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: newId() }]);
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl(AppUrls.home);
    fixture.detectChanges();
    await fixture.whenStable();
    await document.fonts.ready;
    expect(matchMedia(ColorSchemeQueries.light).matches, 'this project did not emulate the light scheme').toBe(true);

    const results = await axe.run(document, AXE_WCAG_AA_RUN);

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });
});
