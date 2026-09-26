import { newPathSegment } from '@crgolden/modules/testing';
import { test, expect, signInAsAdmin } from './fixtures.js';
import { settleWebfonts } from './layout.js';
import { CssValues } from './css-constants';
import e2eSettings from './e2e-settings.json';
import { BffPaths } from '../src/shared/bff-contract';
import { AppUrls } from '../src/app/app-paths';
import { SiteNavIdPrefixes } from '../src/app/nav/site-nav-ids';
import { AriaCurrentValues } from '../src/testing/html-constants';

const NavSettings = e2eSettings.nav;

const RAIL = '#site-nav-rail';
const TABBAR = '#site-nav-tabbar';
const SHEET = '#nav-sheet';
const MAIN = '#page-main';

const RAIL_LINKS = `[id^="${SiteNavIdPrefixes.railLink}"]:not([id^="${SiteNavIdPrefixes.railLabel}"]):not([id^="${SiteNavIdPrefixes.railIcon}"])`;
const TAB_LINKS = `[id^="${SiteNavIdPrefixes.tabLink}"]:not([id^="${SiteNavIdPrefixes.tabLabel}"])`;
const TAB_LABELS = `[id^="${SiteNavIdPrefixes.tabLabel}"]`;
const SHEET_LINKS = `[id^="${SiteNavIdPrefixes.sheetLink}"]`;

const RAIL_ORDER: string[] = [
  AppUrls.home,
  AppUrls.catalog,
  AppUrls.library,
  AppUrls.collections,
  AppUrls.profile,
  AppUrls.account,
  AppUrls.consoles,
  AppUrls.faq,
  AppUrls.privacy,
];
const ADMIN_RAIL_POSITION = RAIL_ORDER.indexOf(AppUrls.faq);
const RAIL_ORDER_ADMIN = [
  ...RAIL_ORDER.slice(0, ADMIN_RAIL_POSITION),
  AppUrls.adminEnrichment,
  ...RAIL_ORDER.slice(ADMIN_RAIL_POSITION),
];
const RAIL_ORDER_ANONYMOUS: string[] = [AppUrls.home, AppUrls.catalog, AppUrls.faq, AppUrls.privacy];
const TAB_ORDER: string[] = [AppUrls.home, AppUrls.catalog, AppUrls.library, AppUrls.collections];
const SHEET_ORDER: string[] = [AppUrls.profile, AppUrls.account, AppUrls.consoles, AppUrls.faq, AppUrls.privacy];

const railId = (path: string, order: string[] = RAIL_ORDER) => `#nav-rail-${order.indexOf(path)}`;
const tabId = (path: string) => `#nav-tab-${TAB_ORDER.indexOf(path)}`;
const sheetId = (path: string) => `#nav-sheet-link-${SHEET_ORDER.indexOf(path)}`;

function newSubjectOutsideTheAvatarAlphabet(): string {
  return `${newPathSegment()}.${newPathSegment()}`;
}

function hrefsOf(links: import('@playwright/test').Locator): Promise<(string | null)[]> {
  return links.evaluateAll((elements) => elements.map((element) => element.getAttribute('href')));
}

const DESKTOP = e2eSettings.viewports.desktop;
const MOBILE = e2eSettings.viewports.mobile;

test.describe('SiteNavComponent — desktop rail', () => {
  test.use({ viewport: DESKTOP });

  for (const startPath of [AppUrls.home, AppUrls.catalog, AppUrls.collections, AppUrls.library, AppUrls.profile]) {
    test(`the rail offers every destination in order on ${startPath}`, async ({ authedPage: page, store }) => {
      await store.reset();

      await page.goto(startPath);
      await expect(page.locator(`${RAIL} ${RAIL_LINKS}`)).toHaveCount(RAIL_ORDER.length + 1);
      for (const [index, path] of RAIL_ORDER.entries()) {
        await expect(page.locator(`#nav-rail-${index}`)).toHaveAttribute('href', path);
      }
    });
  }

  test('Consoles & Storage is reachable from the rail, not only by typing its URL', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await page.locator(railId(AppUrls.consoles)).click();
    await page.waitForURL(`**${AppUrls.consoles}`);
  });

  test('clicking Profile in the rail navigates to /profile without a deep link', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.catalog);
    await page.locator(railId(AppUrls.profile)).click();
    await page.waitForURL(`**${AppUrls.profile}`);
  });

  test('the active route is visually marked in the rail', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.catalog);
    await expect(page.locator(railId(AppUrls.catalog))).toHaveAttribute('aria-current', AriaCurrentValues.page);
    await expect(page.locator(railId(AppUrls.home))).not.toHaveAttribute('aria-current');

    const inkOf = (path: string) =>
      page.locator(railId(path)).evaluate((element) => getComputedStyle(element).color);
    expect(await inkOf(AppUrls.catalog), 'the current route renders in the same ink as the others').not.toBe(
      await inkOf(AppUrls.home),
    );
  });

  test('the tab bar is for small viewports only', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(RAIL)).toBeVisible();
    await expect(page.locator(TABBAR)).toBeHidden();
  });

  for (const height of NavSettings.railHeightsPx) {
    for (const asAdmin of [false, true]) {
      test(`${asAdmin ? 'an admin' : 'a non-admin'}'s rail keeps every destination on screen at ${height}px tall`, async ({
        authedPage: page,
        store,
      }) => {
        await store.reset();
        if (asAdmin) {
          await store.seedAdmin();
          await signInAsAdmin(page);
        }
        await page.setViewportSize({ width: DESKTOP.width, height });

        await page.goto('/');
        const order = asAdmin ? RAIL_ORDER_ADMIN : RAIL_ORDER;
        if (asAdmin) {
          await expect(page.locator(railId(AppUrls.adminEnrichment, order))).toBeVisible();
        }
        await settleWebfonts(page, ['#brand']);

        const layout = await page.locator(RAIL).evaluate((rail, selector) => {
          const links = Array.from(rail.querySelectorAll<HTMLElement>(selector));
          const boxes = links.map((link) => link.getBoundingClientRect());
          return {
            columns: new Set(boxes.map((box) => Math.round(box.left))).size,
            linkCount: links.length,
            minTop: Math.min(...boxes.map((box) => Math.round(box.top))),
            maxBottom: Math.max(...boxes.map((box) => Math.round(box.bottom))),
            viewportHeight: window.innerHeight,
          };
        }, RAIL_LINKS);

        expect(layout.linkCount).toBe(order.length + 1);
        expect(layout.columns, `rail wrapped into columns; ${JSON.stringify(layout)}`).toBe(1);
        expect(
          layout.minTop,
          `rail escaped the top of the viewport; ${JSON.stringify(layout)}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          layout.maxBottom,
          `a rail destination sits below the fold; ${JSON.stringify(layout)}`,
        ).toBeLessThanOrEqual(layout.viewportHeight);
      });
    }
  }

  test('the rail stays pinned to the viewport once the page is scrolled', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: DESKTOP.width, height: NavSettings.stickyRailViewportHeightPx });

    await page.goto(AppUrls.faq);
    await expect(page.locator(RAIL)).toBeVisible();
    await settleWebfonts(page, ['#brand']);

    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return {
        scrollY: Math.round(window.scrollY),
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });

    expect(
      scrolled.documentHeight,
      `a page no taller than the viewport cannot exercise sticky travel; ${JSON.stringify(scrolled)}`,
    ).toBeGreaterThan(scrolled.viewportHeight * NavSettings.stickyTravelViewportMultiple);
    expect(scrolled.scrollY, 'the page did not scroll, so nothing below was measured').toBeGreaterThan(0);

    const rail = await page.locator(RAIL).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), viewportHeight: window.innerHeight };
    });

    expect(
      rail.top,
      `the rail scrolled off the top; its sticky containing block is too short. ${JSON.stringify(rail)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      rail.bottom,
      'the rail edge stops partway down the page, leaving a stub border beside empty space. ' +
        `${JSON.stringify(rail)}`,
    ).toBeGreaterThanOrEqual(rail.viewportHeight - 1);
  });

  test('the user-email cap truncates a long address, measured against the cap itself', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#user-chip')).toBeVisible();
    await settleWebfonts(page, ['#user-email']);

    const email = await page.locator('#user-email').evaluate((el) => ({
      clipped: el.scrollWidth > el.clientWidth,
      renderedWidth: el.getBoundingClientRect().width,
      capWidth: parseFloat(getComputedStyle(el).maxWidth),
    }));

    expect(Number.isFinite(email.capWidth), 'the address has no width cap, so nothing limits it').toBe(true);
    expect(email.renderedWidth).toBeLessThanOrEqual(email.capWidth);
    expect(
      email.clipped,
      'the fixture address no longer overflows the cap, so deleting the cap would leave this green',
    ).toBe(true);
  });

  test('the header row does not track the signed-in address', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await settleWebfonts(page, ['#user-email']);

    const brandRight = await page.locator('#brand').evaluate((el) => el.getBoundingClientRect().right);
    const emailLeft = await page.locator('#user-email').evaluate((el) => el.getBoundingClientRect().left);

    expect(
      emailLeft,
      'the capped address must not grow leftwards into the brand it shares the header row with',
    ).toBeGreaterThan(brandRight);
  });

  test('a failed avatar load does not render its alt text at full width', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#user-chip')).toBeVisible();

    const avatar = await page.locator('#nav-avatar').evaluate(async (host, brokenAvatarPath) => {
      const image = host.querySelector('img');
      if (image === null) {
        return null;
      }
      const settled = new Promise<boolean>((resolve) => {
        image.addEventListener('error', () => resolve(true), { once: true });
        image.addEventListener('load', () => resolve(false), { once: true });
      });
      image.src = brokenAvatarPath;
      const failed = await settled;
      return {
        failed,
        naturalWidth: image.naturalWidth,
        altLength: image.alt.length,
        width: host.getBoundingClientRect().width,
      };
    }, BffPaths.avatar(newSubjectOutsideTheAvatarAlphabet()));

    expect(avatar, '#nav-avatar renders no <img>').not.toBeNull();
    expect(
      avatar?.failed,
      'the avatar image did not fail, so the width assertion below would pass on a working image',
    ).toBe(true);
    expect(avatar?.naturalWidth, 'the browser still decoded an image, so nothing is being tested').toBe(0);
    expect(
      avatar?.altLength,
      'the alt is short, so it would not overflow even unconstrained — the fixture no longer exercises this',
    ).toBeGreaterThan(NavSettings.avatarAltOverflowLength);

    expect(
      avatar?.width,
      'a broken avatar is widening the nav by laying out its alt text — the recorded incident was 294px',
    ).toBeLessThanOrEqual(NavSettings.avatarMaximumWidthPx);
  });

  test('every rail link keeps an accessible name', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    for (const index of RAIL_ORDER.keys()) {
      await expect(page.locator(`#nav-rail-${index}`)).toHaveAccessibleName(/\S/);
    }
    await expect(page.locator('#nav-rail-signout')).toHaveAccessibleName(/\S/);
  });
});

test.describe('SiteNavComponent — mobile tab bar', () => {
  test.use({ viewport: MOBILE });

  test('keeps the header chip inside the row it shares with the brand, at the narrowest viewport', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#user-chip')).toBeVisible();
    await settleWebfonts(page, ['#user-email']);

    const row = await page.locator('#header-inner').evaluate((header) => {
      const headerBox = header.getBoundingClientRect();
      const chip = header.querySelector('#user-chip');
      const brand = header.querySelector('#brand');
      if (chip === null || brand === null) {
        return null;
      }
      const chipBox = chip.getBoundingClientRect();
      return {
        chipRight: chipBox.right,
        headerRight: headerBox.right,
        chipLeft: chipBox.left,
        brandRight: brand.getBoundingClientRect().right,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(row, 'the chip or the brand is missing from the header').not.toBeNull();
    expect(row?.chipRight, 'the chip overflows the header').toBeLessThanOrEqual((row?.headerRight ?? 0) + 1);
    expect(row?.chipLeft, 'the chip has collided with the brand').toBeGreaterThan(row?.brandRight ?? 0);
    expect(
      row?.documentScrollWidth,
      'the chip pushed the document wider than the viewport, so the whole page scrolls sideways',
    ).toBeLessThanOrEqual((row?.viewportWidth ?? 0) + 1);
  });

  test('renders four tabs plus More, and hides the rail', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(TABBAR)).toBeVisible();
    await expect(page.locator(RAIL)).toBeHidden();
    await expect(page.locator(`${TABBAR} ${TAB_LINKS}`)).toHaveCount(TAB_ORDER.length + 1);
    for (const [index, path] of TAB_ORDER.entries()) {
      await expect(page.locator(`#nav-tab-${index}`)).toHaveAttribute('href', path);
      await expect(page.locator(`#nav-tab-label-${index}`)).toBeVisible();
    }
    await expect(page.locator('#nav-tab-label-more')).toBeVisible();
  });

  test('every tab label stays on one line and the stacked icon fits inside the bar', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await settleWebfonts(page, [TAB_LABELS]);

    const overflowing = await page.locator(TABBAR).evaluate((bar, selectors) => {
      const barBox = bar.getBoundingClientRect();
      return Array.from(bar.querySelectorAll<HTMLElement>(selectors.links)).flatMap((tab) => {
        const label = tab.querySelector<HTMLElement>(selectors.labels);
        if (label === null) return [];
        const wrapped = label.getClientRects().length > 1;
        const box = tab.getBoundingClientRect();
        const escapes = box.top < barBox.top - 1 || box.bottom > barBox.bottom + 1;
        return wrapped || escapes ? [{ id: tab.id, wrapped, escapes }] : [];
      });
    }, { links: TAB_LINKS, labels: TAB_LABELS });

    expect(overflowing, JSON.stringify(overflowing)).toEqual([]);
  });

  test('the tab bar is fixed and reserves the safe area below it', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    const spacing = await page.locator(TABBAR).evaluate((bar) => ({
      paddingBottom: getComputedStyle(bar).paddingBottom,
      position: getComputedStyle(bar).position,
    }));

    expect(spacing.position).toBe(CssValues.fixed);
    expect(spacing.paddingBottom).not.toBe('');
  });

  test('page content is not hidden behind the fixed tab bar', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    const mainPaddingBottom = await page
      .locator(MAIN)
      .evaluate((main) => Number.parseFloat(getComputedStyle(main).paddingBottom));
    const barHeight = await page.locator(TABBAR).evaluate((bar) => bar.getBoundingClientRect().height);

    expect(
      mainPaddingBottom,
      'the last row of a page would sit under the tab bar',
    ).toBeGreaterThanOrEqual(barHeight);
  });

  test('tapping a tab navigates', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator(tabId(AppUrls.catalog)).click();
    await page.waitForURL(`**${AppUrls.catalog}`);
  });
});

test.describe('SiteNavComponent — the More sheet', () => {
  test.use({ viewport: MOBILE });

  test('is not shown until it is asked for, and holds what the tab bar could not', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(SHEET)).toBeHidden();

    await page.locator('#nav-tab-more').click();
    await expect(page.locator(SHEET)).toBeVisible();

    await expect(page.locator(`${SHEET} ${SHEET_LINKS}`)).toHaveCount(SHEET_ORDER.length);
    for (const [index, path] of SHEET_ORDER.entries()) {
      await expect(page.locator(`#nav-sheet-link-${index}`)).toHaveAttribute('href', path);
    }
  });

  test('loses no destination — tabs and sheet together are the whole rail', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    const tabs = await hrefsOf(page.locator(`${TABBAR} ${TAB_LINKS}`));
    await page.locator('#nav-tab-more').click();
    await expect(page.locator(SHEET)).toBeVisible();
    const sheetLinks = await hrefsOf(page.locator(`${SHEET} ${SHEET_LINKS}`));

    const offered = [...tabs, ...sheetLinks];
    for (const path of RAIL_ORDER) {
      expect(offered, `${path} is reachable from neither the tab bar nor the sheet`).toContain(path);
    }
  });

  test('traps focus while open and restores it to the trigger on Escape', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(page.locator(SHEET)).toBeVisible();

    const insideSheet = await page.evaluate(
      (sheet) => document.querySelector(sheet)?.contains(document.activeElement),
      SHEET,
    );
    expect(insideSheet, 'focus stayed outside the modal sheet').toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator(SHEET)).toBeHidden();

    await expect(page.locator('#nav-tab-more'), 'focus was not returned to the control that opened the sheet').toBeFocused();
  });

  test('closes on its own close button', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(page.locator(SHEET)).toBeVisible();

    await page.locator('#nav-sheet-close').click();
    await expect(page.locator(SHEET)).toBeHidden();
  });

  test('closes when a link inside it navigates, rather than surviving the route change', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(page.locator(SHEET)).toBeVisible();

    await page.locator(sheetId(AppUrls.profile)).click();
    await page.waitForURL(`**${AppUrls.profile}`);
    await expect(page.locator(SHEET), 'the sheet survived navigation').toBeHidden();
  });

  test('announces its expanded state on the trigger', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#nav-tab-more')).toHaveAttribute('aria-expanded', 'false');

    await page.locator('#nav-tab-more').click();
    await expect(page.locator('#nav-tab-more')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('SiteNavComponent — anonymous', () => {
  test.use({ viewport: DESKTOP });

  test('offers the destinations that need no account, and Sign in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#nav-link-signin')).toBeVisible();
    for (const [index, path] of RAIL_ORDER_ANONYMOUS.entries()) {
      await expect(page.locator(`#nav-rail-${index}`)).toHaveAttribute('href', path);
    }
  });

  test('offers no destination that would bounce the visitor to the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(`${RAIL} ${RAIL_LINKS}`)).toHaveCount(RAIL_ORDER_ANONYMOUS.length);
    await expect(page.locator('#user-chip')).toHaveCount(0);
    await expect(page.locator('#nav-rail-signout')).toHaveCount(0);
  });

  test('the catalog the rail advertises is genuinely reachable without an account', async ({ page }) => {
    await page.goto('/');
    await page.locator(railId(AppUrls.catalog, RAIL_ORDER_ANONYMOUS)).click();
    await page.waitForURL(`**${AppUrls.catalog}`);
    await expect(page.locator('#nav-link-signin')).toBeVisible();
  });
});
