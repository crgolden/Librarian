import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { page, userEvent } from 'vitest/browser';
import { newId } from '@crgolden/modules/testing';
import axe from 'axe-core';
import { AXE_WCAG_AA_RUN } from '../../e2e/axe-constants';
import { CssValues } from '../../e2e/css-constants';
import { WcagFocusAppearance } from '../../e2e/wcag-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AuthService, type Session } from '../auth/auth.service';
import { FaqComponent } from '../faq/faq.component';
import { ADMIN_CLAIM_VALUE, BFF_USER_RELATIVE_PATH, BffPaths, ClaimTypes } from '../shared/bff-contract';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { AppComponent } from './app.component';
import { AppPaths, AppUrls } from './app-paths';
import { ANONYMOUS_NAV_LINKS, PRIMARY_NAV_LINKS } from './nav/nav-links';
import { SiteNavIdPrefixes } from './nav/site-nav-ids';
import { AriaCurrentValues, UserEventKeys } from '../testing/html-constants';

const NavSettings = e2eSettings.nav;
const DESKTOP = e2eSettings.viewports.desktop;
const MOBILE = e2eSettings.viewports.mobile;
const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const ONE_COLUMN = 1;
const NO_ELEMENTS = 0;

const RAIL_LINKS = `[id^="${SiteNavIdPrefixes.railLink}"]:not([id^="${SiteNavIdPrefixes.railLabel}"]):not([id^="${SiteNavIdPrefixes.railIcon}"])`;
const TAB_LINKS = `[id^="${SiteNavIdPrefixes.tabLink}"]:not([id^="${SiteNavIdPrefixes.tabLabel}"])`;
const TAB_LABELS = `[id^="${SiteNavIdPrefixes.tabLabel}"]`;
const SHEET_LINKS = `[id^="${SiteNavIdPrefixes.sheetLink}"]`;

const MEMBER_LINKS = PRIMARY_NAV_LINKS.filter((link) => link.adminOnly !== true);
const TAB_ORDER = MEMBER_LINKS.filter((link) => link.tab === true);
const SHEET_ORDER = MEMBER_LINKS.filter((link) => link.tab !== true);

const ROUTES: Routes = [
  { path: AppPaths.faq, component: FaqComponent },
  ...PRIMARY_NAV_LINKS.map((link) => ({ path: link.path.slice(1), children: [] })),
];

function memberSession(email: string): Session {
  return [
    { type: ClaimTypes.sub, value: newId() },
    { type: ClaimTypes.email, value: email },
    { type: ClaimTypes.logoutUrl, value: BffPaths.logout },
  ];
}

function adminSession(): Session {
  return [...memberSession(`${newId()}@example.invalid`), { type: ClaimTypes.admin, value: ADMIN_CLAIM_VALUE }];
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function summarise(results: axe.Result[]): { id: string; targets: string[]; html: string[] }[] {
  return results.map((result) => ({
    id: result.id,
    targets: result.nodes.map((node) => node.target.flat().join(' ')),
    html: result.nodes.map((node) => node.html),
  }));
}

function all(selector: string, within: ParentNode = document): HTMLElement[] {
  return [...within.querySelectorAll<HTMLElement>(selector)];
}

function railLinksWithNoAccessibleName(): string[] {
  return all(`#site-nav-rail ${RAIL_LINKS}`)
    .filter((link) => link.innerText.trim().length === 0 && !link.hasAttribute('aria-label'))
    .map((link) => link.id);
}

function tabsWrappedOrOutsideTheBar(): string[] {
  const bar = required('#site-nav-tabbar').getBoundingClientRect();
  return all(TAB_LINKS, required('#site-nav-tabbar'))
    .filter((tab) => {
      const label = tab.querySelector<HTMLElement>(TAB_LABELS);
      if (label === null) {
        throw new Error(`${tab.id} has no label to measure.`);
      }
      const box = tab.getBoundingClientRect();
      return label.getClientRects().length > 1 || box.top < bar.top - SUB_PIXEL_ROUNDING_TOLERANCE_PX || box.bottom > bar.bottom + SUB_PIXEL_ROUNDING_TOLERANCE_PX;
    })
    .map((tab) => tab.id);
}

function expectTheRailOnOneColumnAboveTheFold(): void {
  const boxes = all(`#site-nav-rail ${RAIL_LINKS}`).map((link) => link.getBoundingClientRect());
  expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(ONE_COLUMN);
  expect(Math.min(...boxes.map((box) => Math.round(box.top)))).toBeGreaterThanOrEqual(0);
  expect(Math.max(...boxes.map((box) => Math.round(box.bottom))), 'a rail destination sits below the fold').toBeLessThanOrEqual(
    window.innerHeight,
  );
}

async function renderShell(
  session: Session | null,
  viewport: { width: number; height: number },
  path: string = AppUrls.home,
): Promise<ComponentFixture<AppComponent>> {
  await page.viewport(viewport.width, viewport.height);
  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [provideRouter(ROUTES), provideHttpClient(withXhr()), provideHttpClientTesting()],
  }).compileComponents();
  await resolveTestComponentResources();
  TestBed.inject(AuthService).refresh();
  TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush(session);
  const fixture = TestBed.createComponent(AppComponent);
  await TestBed.inject(Router).navigateByUrl(path);
  fixture.detectChanges();
  await fixture.whenStable();
  await document.fonts.ready;
  return fixture;
}

describe('The app shell on a wide screen', () => {
  it.each([AppUrls.home, AppUrls.catalog, AppUrls.collections, AppUrls.library, AppUrls.profile])(
    'offers every member destination in the rail, in order, on %s',
    async (startPath) => {
    await renderShell(memberSession(`${newId()}@example.invalid`), DESKTOP, startPath);

    expect(all(`#site-nav-rail ${RAIL_LINKS}`).map((link) => link.getAttribute('href'))).toEqual([
      ...MEMBER_LINKS.map((link) => link.path),
      BffPaths.logout,
    ]);
  },
  );

  it('marks the current route in the rail, in its own ink', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), DESKTOP, AppUrls.catalog);

    const current = required(`#nav-rail-${MEMBER_LINKS.findIndex((link) => link.path === AppUrls.catalog)}`);
    const home = required(`#nav-rail-${MEMBER_LINKS.findIndex((link) => link.path === AppUrls.home)}`);
    expect(current.getAttribute('aria-current')).toBe(AriaCurrentValues.page);
    expect(home.hasAttribute('aria-current')).toBe(false);
    expect(getComputedStyle(current).color, 'the current route renders in the same ink as the others').not.toBe(
      getComputedStyle(home).color,
    );
  });

  it('shows the rail and hides the tab bar', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), DESKTOP);

    expect(required('#site-nav-rail').checkVisibility()).toBe(true);
    expect(required('#site-nav-tabbar').checkVisibility()).toBe(false);
  });

  it.each(NavSettings.railHeightsPx)('keeps every member destination on one column and on screen at %i px tall', async (height) => {
    await renderShell(memberSession(`${newId()}@example.invalid`), { width: DESKTOP.width, height });

    expectTheRailOnOneColumnAboveTheFold();
  });

  it.each(NavSettings.railHeightsPx)('keeps every administrator destination on one column and on screen at %i px tall', async (height) => {
    await renderShell(adminSession(), { width: DESKTOP.width, height });

    expectTheRailOnOneColumnAboveTheFold();
  });

  it('keeps the rail pinned to the viewport once the page is scrolled', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), { width: DESKTOP.width, height: NavSettings.stickyRailViewportHeightPx }, AppUrls.faq);
    expect(
      document.documentElement.scrollHeight,
      'a page no taller than the viewport cannot exercise sticky travel',
    ).toBeGreaterThan(window.innerHeight * NavSettings.stickyTravelViewportMultiple);

    window.scrollTo(0, document.documentElement.scrollHeight);

    expect(window.scrollY, 'the page did not scroll, so nothing below was measured').toBeGreaterThan(0);
    const rail = required('#site-nav-rail').getBoundingClientRect();
    expect(rail.top, 'the rail scrolled off the top').toBeGreaterThanOrEqual(0);
    expect(rail.bottom, 'the rail edge stops partway down the page').toBeGreaterThanOrEqual(window.innerHeight - SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it('truncates a long signed-in address at its cap, clear of the brand', async () => {
    await renderShell(memberSession(`${newId()}${newId()}@example.invalid`), DESKTOP);

    const email = required('#user-email');
    const cap = Number.parseFloat(getComputedStyle(email).maxWidth);
    expect(Number.isFinite(cap), 'the address has no width cap, so nothing limits it').toBe(true);
    expect(getComputedStyle(email).overflow, 'the capped address spills past its cap instead of being clipped').toBe(CssValues.hidden);
    expect(email.getBoundingClientRect().width).toBeLessThanOrEqual(cap);
    expect(email.scrollWidth, 'the address no longer overflows the cap, so deleting the cap would leave this green').toBeGreaterThan(
      email.clientWidth,
    );
    expect(email.getBoundingClientRect().left).toBeGreaterThan(required('#brand').getBoundingClientRect().right);
  });

  it('keeps a broken avatar from laying its alt text out at full width', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), DESKTOP);
    const image = required('#nav-avatar').firstElementChild as HTMLImageElement;
    expect(image).toBeInstanceOf(HTMLImageElement);
    const failed = new Promise<boolean>((resolve) => {
      image.addEventListener('error', () => resolve(true), { once: true });
      image.addEventListener('load', () => resolve(false), { once: true });
    });

    image.src = BffPaths.avatar(`${newId()}.${newId()}`);

    expect(await failed, 'the avatar image did not fail, so the width check would pass on a working image').toBe(true);
    expect(image.alt.length, 'the alt is too short to overflow, so the fixture exercises nothing').toBeGreaterThan(NavSettings.avatarAltOverflowLength);
    expect(required('#nav-avatar').getBoundingClientRect().width).toBeLessThanOrEqual(NavSettings.avatarMaximumWidthPx);
  });

  it('gives every rail link an accessible name', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), DESKTOP);

    expect(railLinksWithNoAccessibleName()).toEqual([]);
  });

  it.each([
    { selector: '#brand', viewport: DESKTOP },
    { selector: '#nav-rail-0', viewport: DESKTOP },
    { selector: '#nav-link-signin', viewport: DESKTOP },
    { selector: '#nav-tab-more', viewport: MOBILE },
    { selector: '#nav-tab-0', viewport: MOBILE },
  ])('rings $selector with the focus token at its width and offset', async ({ selector, viewport }) => {
    await renderShell(null, viewport);
    const root = getComputedStyle(document.documentElement);
    const width = root.getPropertyValue('--focus-ring-width').trim();
    const offset = root.getPropertyValue('--focus-ring-offset').trim();
    const control = required(selector);

    control.focus();

    expect(Number.parseFloat(width), '--focus-ring-width is thinner than WCAG 2.4.13 allows').toBeGreaterThanOrEqual(
      WcagFocusAppearance.minimumThicknessPx,
    );
    expect(Number.parseFloat(offset)).toBeGreaterThan(0);
    const ring = getComputedStyle(control);
    expect(ring.outlineStyle, `${selector} does not draw a solid ring, so it ignores the focus color`).toBe(CssValues.solid);
    expect(ring.outlineWidth).toBe(width);
    expect(ring.outlineOffset).toBe(offset);
  });

  it('offers a visitor only the destinations that need no account, and sign-in', async () => {
    await renderShell(null, DESKTOP);

    expect(all(`#site-nav-rail ${RAIL_LINKS}`).map((link) => link.getAttribute('href'))).toEqual(
      ANONYMOUS_NAV_LINKS.map((link) => link.path),
    );
    expect(required('#nav-link-signin').checkVisibility()).toBe(true);
    expect(document.querySelectorAll('#user-chip')).toHaveLength(NO_ELEMENTS);
  });
});

describe('The app shell on a phone', () => {
  it('keeps the signed-in chip inside the header row, clear of the brand', async () => {
    await renderShell(memberSession(`${newId()}${newId()}@example.invalid`), MOBILE);

    const header = required('#header-inner').getBoundingClientRect();
    const chip = required('#user-chip').getBoundingClientRect();
    expect(chip.right).toBeLessThanOrEqual(header.right + SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(chip.left).toBeGreaterThan(required('#brand').getBoundingClientRect().right);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it('shows four tabs and More, and hides the rail', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);

    expect(required('#site-nav-tabbar').checkVisibility()).toBe(true);
    expect(required('#site-nav-rail').checkVisibility()).toBe(false);
    expect(all(`#site-nav-tabbar ${TAB_LINKS}`).map((link) => link.getAttribute('href'))).toEqual([
      ...TAB_ORDER.map((link) => link.path),
      null,
    ]);
  });

  it('keeps every tab label on one line and every tab inside the bar', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);

    expect(tabsWrappedOrOutsideTheBar()).toEqual([]);
  });

  it('fixes the tab bar and keeps the last page row clear of it', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);

    const bar = required('#site-nav-tabbar');
    expect(getComputedStyle(bar).position).toBe(CssValues.fixed);
    expect(Number.parseFloat(getComputedStyle(required('#page-main')).paddingBottom), 'the last row of a page would sit under the tab bar').toBeGreaterThanOrEqual(
      bar.getBoundingClientRect().height,
    );
  });
});

describe('Accessibility of the shell on a phone', () => {
  it('finds no WCAG A/AA violation in the tab bar', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);

    const results = await axe.run(document, AXE_WCAG_AA_RUN);

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });

  it('finds no WCAG A/AA violation in the More sheet while it is open', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    await userEvent.click(required('#nav-tab-more'));

    const results = await axe.run(document, AXE_WCAG_AA_RUN);

    expect(summarise(results.violations), 'violations').toEqual([]);
    expect(summarise(results.incomplete), 'axe could not evaluate these, which is not the same as passing').toEqual([]);
  });
});

describe('The More sheet', () => {
  it('stays shut until asked for, then holds what the tab bar could not', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    expect(required('#nav-sheet').checkVisibility()).toBe(false);

    await userEvent.click(required('#nav-tab-more'));

    expect(required('#nav-sheet').checkVisibility()).toBe(true);
    expect(all(`#nav-sheet ${SHEET_LINKS}`).map((link) => link.getAttribute('href'))).toEqual(SHEET_ORDER.map((link) => link.path));
  });

  it('loses no destination: the tabs and the sheet together are the whole rail', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    const tabs = all(`#site-nav-tabbar ${TAB_LINKS}`).map((link) => link.getAttribute('href'));

    await userEvent.click(required('#nav-tab-more'));

    const offered = [...tabs, ...all(`#nav-sheet ${SHEET_LINKS}`).map((link) => link.getAttribute('href'))];
    expect(MEMBER_LINKS.map((link) => link.path).filter((path) => !offered.includes(path)), 'reachable from neither the tab bar nor the sheet').toEqual([]);
  });

  it('traps focus while open and returns it to More on Escape', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    await userEvent.click(required('#nav-tab-more'));
    expect(required('#nav-sheet').contains(document.activeElement), 'focus stayed outside the modal sheet').toBe(true);

    await userEvent.keyboard(UserEventKeys.escape);

    expect(required('#nav-sheet').checkVisibility()).toBe(false);
    expect(document.activeElement, 'focus was not returned to the control that opened the sheet').toBe(required('#nav-tab-more'));
  });

  it('closes on its own close button', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    await userEvent.click(required('#nav-tab-more'));

    await userEvent.click(required('#nav-sheet-close'));

    expect(required('#nav-sheet').checkVisibility()).toBe(false);
  });

  it('announces its expanded state on More', async () => {
    await renderShell(memberSession(`${newId()}@example.invalid`), MOBILE);
    expect(required('#nav-tab-more').getAttribute('aria-expanded')).toBe(String(false));

    await userEvent.click(required('#nav-tab-more'));

    expect(required('#nav-tab-more').getAttribute('aria-expanded')).toBe(String(true));
  });
});
