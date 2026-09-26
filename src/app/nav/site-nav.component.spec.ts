import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ANONYMOUS_NAV_LINKS, PRIMARY_NAV_LINKS, SiteNavComponent } from './site-nav.component';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';
import { BffPaths, SID_QUERY_PARAMETER, loginUrlReturningTo } from '../../shared/bff-contract';
import { SiteNavIdPrefixes } from './site-nav-ids';
import { AriaCurrentValues } from '../../testing/html-constants';
import { newEmailAddress, newId } from '@crgolden/modules/testing';
import { AppUrls } from '../app-paths';
import { NavLabels, PageTitles } from '../../shared/page-title';

const signedInSession = () => {
  const signedInSub = newId();
  return {
    sub: signal(signedInSub),
    isAuthenticated: signal(true),
    email: signal(newEmailAddress()),
    username: signal(null),
    picture: signal(null),
    logoutUrl: signal(`${BffPaths.logout}?${SID_QUERY_PARAMETER}=${newId()}`),
  };
};

const anonymousSession = () => ({
  sub: signal(null),
  isAuthenticated: signal(false),
  loginUrl: BffPaths.login,
});

function configure(
  auth: Partial<AuthService>,
  admin: Partial<AdminService> = { isAdmin: signal(false) },
): ComponentFixture<SiteNavComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SiteNavComponent],
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      provideRouter(PRIMARY_NAV_LINKS.map((link) => ({ path: link.path.replace(/^\//, ''), children: [] }))),
      { provide: AuthService, useValue: auth },
      { provide: AdminService, useValue: admin },
    ],
  });
  const fixture = TestBed.createComponent(SiteNavComponent);
  fixture.detectChanges();
  return fixture;
}

const textOf = (fixture: ComponentFixture<SiteNavComponent>, selector: string): string | undefined =>
  (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent ?? undefined;

const labelsIn = (fixture: ComponentFixture<SiteNavComponent>, selector: string): (string | undefined)[] =>
  [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map((element) => element.textContent?.trim());

const guardedLinks = PRIMARY_NAV_LINKS.filter((link) => link.reachableWithoutSigningIn !== true);

describe('SiteNavComponent — anonymous', () => {
  it('offers Sign in', () => {
    const fixture = configure(anonymousSession());

    expect(textOf(fixture, '#nav-link-signin')).toContain(NavLabels.signIn);
  });

  it.each(ANONYMOUS_NAV_LINKS.map((link) => link.label))('offers %s, which needs no account', (label) => {
    const fixture = configure(anonymousSession());

    expect(textOf(fixture, '#site-nav-rail')).toContain(label);
  });

  it.each(guardedLinks.map((link) => link.label))('withholds %s, which sits behind the auth guard', (label) => {
    const fixture = configure(anonymousSession());

    expect(textOf(fixture, '#site-nav-rail')).not.toContain(label);
  });

  it('sends the page the visitor is on as returnTo, so signing in does not dump them at home', async () => {
    const fixture = configure(anonymousSession());
    await TestBed.inject(Router).navigateByUrl(AppUrls.catalog);
    fixture.detectChanges();

    const signInHref = (fixture.nativeElement as HTMLElement)
      .querySelector('#nav-link-signin')
      ?.getAttribute('href');

    expect(signInHref).toBe(loginUrlReturningTo(AppUrls.catalog));
  });

  it('omits returnTo when the visitor is already on the home page', () => {
    const fixture = configure(anonymousSession());

    const signInHref = (fixture.nativeElement as HTMLElement)
      .querySelector('#nav-link-signin')
      ?.getAttribute('href');

    expect(signInHref).toBe(BffPaths.login);
  });

  it('offers no sign-out, because there is no session to end', () => {
    const fixture = configure(anonymousSession());

    expect((fixture.nativeElement as HTMLElement).querySelector('#nav-rail-signout')).toBeNull();
  });
});

describe('SiteNavComponent — signed in', () => {
  it('puts exactly the four tab destinations in the tab bar', () => {
    const fixture = configure(signedInSession());

    expect(labelsIn(fixture, `#site-nav-tabbar [id^="${SiteNavIdPrefixes.tabLabel}"]:not(#nav-tab-label-more)`)).toEqual([
      NavLabels.home,
      PageTitles.catalog,
      PageTitles.library,
      PageTitles.collections,
    ]);
  });

  it('offers More alongside the tabs', () => {
    const fixture = configure(signedInSession());

    expect(textOf(fixture, '#nav-tab-label-more')).toBe(NavLabels.more);
  });

  it('loses no destination to the sheet — tabs and sheet together are the whole rail', () => {
    const fixture = configure(signedInSession(), { isAdmin: signal(true) });

    const railLabels = labelsIn(fixture, `#site-nav-rail [id^="${SiteNavIdPrefixes.railLabel}"]`);
    const tabLabels = labelsIn(fixture, `#site-nav-tabbar [id^="${SiteNavIdPrefixes.tabLabel}"]:not(#nav-tab-label-more)`);
    const sheetLabels = labelsIn(fixture, `#nav-sheet [id^="${SiteNavIdPrefixes.sheetLink}"]`);

    expect([...tabLabels, ...sheetLabels].sort()).toEqual([...railLabels].sort());
  });

  it('reaches Consoles & Storage, which no nav offered before', () => {
    const fixture = configure(signedInSession());

    expect(textOf(fixture, '#nav-sheet')).toContain(PageTitles.consoles);
  });

  it('does not show Enrichment Runs to a non-admin', () => {
    const fixture = configure(signedInSession(), { isAdmin: signal(false) });

    expect(textOf(fixture, '#site-nav-rail')).not.toContain(PageTitles.enrichmentRuns);
  });

  it('shows Enrichment Runs to an admin', () => {
    const fixture = configure(signedInSession(), { isAdmin: signal(true) });

    expect(textOf(fixture, '#nav-sheet')).toContain(PageTitles.enrichmentRuns);
  });

  it('keeps Enrichment Runs out of the tab bar, which is reserved for the four everyone has', () => {
    const fixture = configure(signedInSession(), { isAdmin: signal(true) });

    expect(textOf(fixture, '#site-nav-tabbar')).not.toContain(PageTitles.enrichmentRuns);
  });

  it('keeps the tab bar the same width across an isAdmin false -> true transition', () => {
    const isAdmin = signal(false);
    const fixture = configure(signedInSession(), { isAdmin });
    const tabsBeforePromotion = labelsIn(fixture, `#site-nav-tabbar [id^="${SiteNavIdPrefixes.tabLabel}"]`).length;

    isAdmin.set(true);
    fixture.detectChanges();

    expect(labelsIn(fixture, `#site-nav-tabbar [id^="${SiteNavIdPrefixes.tabLabel}"]`).length).toBe(tabsBeforePromotion);
  });

  it('marks the active route with routerLinkActive', async () => {
    const fixture = configure(signedInSession());
    await TestBed.inject(Router).navigateByUrl(AppUrls.catalog);
    fixture.detectChanges();

    const catalogIndex = PRIMARY_NAV_LINKS.findIndex((link) => link.path === AppUrls.catalog);
    const catalogLink = (fixture.nativeElement as HTMLElement).querySelector(`#${SiteNavIdPrefixes.railLink}${catalogIndex}`);

    expect(catalogLink?.getAttribute('aria-current')).toBe(AriaCurrentValues.page);
  });

  it.each(PRIMARY_NAV_LINKS.map((link, index) => [link.label, index] as const))(
    '%s keeps an accessible name on its rail link',
    (label, index) => {
      const fixture = configure(signedInSession(), { isAdmin: signal(true) });

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(`#${SiteNavIdPrefixes.railLink}${index}`)?.getAttribute('aria-label'),
      ).toBe(label);
    },
  );

  it('ships the sheet closed, so it is inert until the visitor asks for it', () => {
    const fixture = configure(signedInSession());
    const sheet = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>('#nav-sheet');

    expect(sheet?.open).toBe(false);
  });

  it('reports the sheet as collapsed on the trigger until it is opened', () => {
    const fixture = configure(signedInSession());

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#nav-tab-more')?.getAttribute('aria-expanded'),
    ).toBe(String(false));
  });

  it('opens the sheet when the trigger is pressed', () => {
    const fixture = configure(signedInSession());
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLButtonElement>('#nav-tab-more')?.click();
    fixture.detectChanges();

    expect(host.querySelector<HTMLDialogElement>('#nav-sheet')?.open).toBe(true);
  });

  it('leaves the sheet open when the app reports arriving where it already is, which is what the first navigation does', async () => {
    const fixture = configure(signedInSession());
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('#nav-tab-more')?.click();
    fixture.detectChanges();

    await TestBed.inject(Router).navigateByUrl(AppUrls.home);
    fixture.detectChanges();

    expect(host.querySelector<HTMLDialogElement>('#nav-sheet')?.open).toBe(true);
  });

  it('closes the sheet when navigation actually goes somewhere else', async () => {
    const fixture = configure(signedInSession());
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('#nav-tab-more')?.click();
    fixture.detectChanges();

    await TestBed.inject(Router).navigateByUrl(AppUrls.catalog);
    fixture.detectChanges();

    expect(host.querySelector<HTMLDialogElement>('#nav-sheet')?.open).toBe(false);
  });

  it('issues no request of its own — admin status comes from the session, not a round trip', () => {
    configure(signedInSession(), { isAdmin: signal(true) });

    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectNone(() => true);
    httpMock.verify();
  });

  it('hides every icon from assistive technology, leaving the name to the link', () => {
    const fixture = configure(signedInSession());
    const iconsWithoutAriaHidden = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('ng-icon'),
    ].filter((icon) => icon.getAttribute('aria-hidden') !== String(true));

    expect(iconsWithoutAriaHidden).toEqual([]);
  });

  it('renders an icon for every destination, so the tab bar is not text-only', () => {
    const fixture = configure(signedInSession());

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('ng-icon').length,
    ).toBeGreaterThan(PRIMARY_NAV_LINKS.length);
  });
});
