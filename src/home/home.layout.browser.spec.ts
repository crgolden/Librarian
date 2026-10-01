import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { page } from 'vitest/browser';
import { newCount, newId } from '@crgolden/modules/testing';
import e2eSettings from '../../e2e/e2e-settings.json';
import { RouteDataKeys } from '../app/app-paths';
import { AuthService } from '../auth/auth.service';
import { BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { HomeComponent } from './home.component';
import type { HomeSummary } from './home.resolver';

const HomeActions = e2eSettings.layout.homeActions;
const DESKTOP = e2eSettings.viewports.desktop;

describe('The home page in a real browser', () => {
  it('lays its actions out at one width over whole rows, with no orphan', async () => {
    const summary: HomeSummary = { libraryTotal: newCount(), collectionCount: newCount(), collectionEntries: newCount(), linked: true };
    await page.viewport(DESKTOP.width, DESKTOP.height);
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { [RouteDataKeys.summary]: summary } } } },
      ],
    }).compileComponents();
    await resolveTestComponentResources();
    TestBed.inject(AuthService).refresh();
    TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: newId() }]);

    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await document.fonts.ready;

    const actions = [...document.querySelectorAll<HTMLElement>('[id^="home-action-"]')].map((link) => link.getBoundingClientRect());
    expect(actions, 'the home card should offer its configured number of actions').toHaveLength(HomeActions.count);
    expect(new Set(actions.map((box) => Math.round(box.width))).size, 'content-sized buttons produce ragged spacing').toBe(1);
    expect(new Set(actions.map((box) => Math.round(box.top))).size, 'a third row means one action wrapped alone').toBe(HomeActions.rows);
  });
});
