import { test, expect, signInAsAdmin } from './fixtures.js';
import { settleWebfonts } from './layout.js';

const RAIL = '#site-nav-rail';
const TABBAR = '#site-nav-tabbar';
const SHEET = '#nav-sheet';
const MAIN = '#page-main';

const RAIL_LINKS = '[id^="nav-rail-"]:not([id^="nav-rail-label-"]):not([id^="nav-rail-icon-"])';
const TAB_LINKS = '[id^="nav-tab-"]:not([id^="nav-tab-label-"])';
const TAB_LABELS = '[id^="nav-tab-label-"]';
const SHEET_LINKS = '[id^="nav-sheet-link-"]';

const RAIL_ORDER = [
  'Home',
  'Catalog',
  'Library',
  'Collections',
  'Profile',
  'PSN Settings',
  'Consoles & Storage',
  'FAQ',
  'Privacy',
];
const RAIL_ORDER_ADMIN = [...RAIL_ORDER.slice(0, 7), 'Enrichment Runs', ...RAIL_ORDER.slice(7)];
const RAIL_ORDER_ANONYMOUS = ['Home', 'Catalog', 'FAQ', 'Privacy'];
const TAB_ORDER = ['Home', 'Catalog', 'Library', 'Collections'];
const SHEET_ORDER = ['Profile', 'PSN Settings', 'Consoles & Storage', 'FAQ', 'Privacy'];

const railId = (label: string, order: string[] = RAIL_ORDER) => `#nav-rail-${order.indexOf(label)}`;
const tabId = (label: string) => `#nav-tab-${TAB_ORDER.indexOf(label)}`;
const sheetId = (label: string) => `#nav-sheet-link-${SHEET_ORDER.indexOf(label)}`;

const SHEET_OPEN_TIMEOUT_MS = 15_000;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('SiteNavComponent — desktop rail', () => {
  test.use({ viewport: DESKTOP });

  for (const startPath of ['/', '/catalog', '/collections', '/library', '/profile']) {
    test(`the rail offers every destination in order on ${startPath}`, async ({ authedPage: page, store }) => {
      await store.reset();

      await page.goto(startPath);
      await expect(page.locator(`${RAIL} ${RAIL_LINKS}`)).toHaveCount(RAIL_ORDER.length + 1);
      for (const [index, label] of RAIL_ORDER.entries()) {
        await expect(page.locator(`#nav-rail-${index}`)).toHaveText(label);
      }
    });
  }

  test('Consoles & Storage is reachable from the rail, not only by typing its URL', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await page.locator(railId('Consoles & Storage')).click();
    await page.waitForURL('**/consoles', { timeout: 10_000 });
  });

  test('clicking Profile in the rail navigates to /profile without a deep link', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/catalog');
    await page.locator(railId('Profile')).click();
    await page.waitForURL('**/profile', { timeout: 10_000 });
  });

  test('the active route is visually marked in the rail', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    await expect(page.locator(railId('Catalog'))).toHaveClass(/nav-active/);
    await expect(page.locator(railId('Home'))).not.toHaveClass(/nav-active/);
  });

  test('the tab bar is for small viewports only', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(RAIL)).toBeVisible();
    await expect(page.locator(TABBAR)).toBeHidden();
  });

  for (const height of [900, 700]) {
    for (const asAdmin of [false, true]) {
      const who = asAdmin ? 'an admin' : 'a non-admin';
      test(`${who}'s rail keeps every destination on screen at ${height}px tall`, async ({
        authedPage: page,
        store,
      }) => {
        await store.reset();
        if (asAdmin) {
          await store.seedAdmin();
          await signInAsAdmin(page);
        }
        await page.setViewportSize({ width: 1440, height });

        await page.goto('/');
        const order = asAdmin ? RAIL_ORDER_ADMIN : RAIL_ORDER;
        if (asAdmin) {
          await expect(page.locator(railId('Enrichment Runs', order))).toBeVisible();
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
    await page.setViewportSize({ width: 1440, height: 640 });

    await page.goto('/faq');
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
    ).toBeGreaterThan(scrolled.viewportHeight * 2);
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
      maxWidth: getComputedStyle(el).maxWidth,
      overflow: getComputedStyle(el).overflow,
    }));

    expect(email.maxWidth).not.toBe('none');
    expect(email.overflow).toBe('hidden');
    expect(
      email.clipped,
      'the fixture address no longer overflows the cap, so deleting the cap would leave this green',
    ).toBe(true);
  });

  test('the rail width does not track the signed-in address', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await settleWebfonts(page, ['#user-email']);

    const railWidth = await page.locator(RAIL).evaluate((rail) => rail.getBoundingClientRect().width);
    const emailWidth = await page.locator('#user-email').evaluate((el) => el.getBoundingClientRect().width);

    expect(
      railWidth,
      'the rail is sized by its own token, so a longer address must not widen it',
    ).toBeGreaterThan(emailWidth);
  });

  test('a failed avatar load does not render its alt text at full width', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator('#user-chip')).toBeVisible();

    const avatar = await page.locator('#nav-avatar').evaluate(async (host) => {
      const image = host.querySelector('img');
      if (image === null) {
        return null;
      }
      const settled = new Promise<string>((resolve) => {
        image.addEventListener('error', () => resolve('error'), { once: true });
        image.addEventListener('load', () => resolve('load'), { once: true });
      });
      image.src = '/bff/avatar/no-such-avatar.png';
      const outcome = await settled;
      return {
        outcome,
        naturalWidth: image.naturalWidth,
        altLength: image.alt.length,
        width: host.getBoundingClientRect().width,
      };
    });

    expect(avatar, '#nav-avatar renders no <img>').not.toBeNull();
    expect(
      avatar?.outcome,
      'the avatar image did not fail, so the width assertion below would pass on a working image',
    ).toBe('error');
    expect(avatar?.naturalWidth, 'the browser still decoded an image, so nothing is being tested').toBe(0);
    expect(
      avatar?.altLength,
      'the alt is short, so it would not overflow even unconstrained — the fixture no longer exercises this',
    ).toBeGreaterThan(20);

    expect(
      avatar?.width,
      'a broken avatar is widening the nav by laying out its alt text — the recorded incident was 294px',
    ).toBeLessThanOrEqual(40);
  });

  test('every rail link keeps an accessible name', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    for (const [index, label] of RAIL_ORDER.entries()) {
      await expect(page.locator(`#nav-rail-${index}`)).toHaveAttribute('aria-label', label);
    }
    await expect(page.locator('#nav-rail-signout')).toHaveAttribute('aria-label', 'Sign out');
  });
});

test.describe('SiteNavComponent — mobile tab bar', () => {
  test.use({ viewport: MOBILE });

  test('renders four tabs plus More, and hides the rail', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(TABBAR)).toBeVisible();
    await expect(page.locator(RAIL)).toBeHidden();
    await expect(page.locator(`${TABBAR} ${TAB_LINKS}`)).toHaveCount(TAB_ORDER.length + 1);
    for (const [index, label] of TAB_ORDER.entries()) {
      await expect(page.locator(`#nav-tab-label-${index}`)).toHaveText(label);
    }
    await expect(page.locator('#nav-tab-label-more')).toHaveText('More');
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

    expect(spacing.position).toBe('fixed');
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
    await page.locator(tabId('Catalog')).click();
    await page.waitForURL('**/catalog', { timeout: 10_000 });
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
    await expect(
      page.locator(SHEET),
      'the sheet did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: SHEET_OPEN_TIMEOUT_MS });

    await expect(page.locator(`${SHEET} ${SHEET_LINKS}`)).toHaveCount(SHEET_ORDER.length);
    for (const [index, label] of SHEET_ORDER.entries()) {
      await expect(page.locator(`#nav-sheet-link-${index}`)).toHaveText(label);
    }
  });

  test('loses no destination — tabs and sheet together are the whole rail', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    const tabs = await page.locator(TAB_LABELS).allTextContents();
    await page.locator('#nav-tab-more').click();
    await expect(
      page.locator(SHEET),
      'the sheet did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: SHEET_OPEN_TIMEOUT_MS });
    const sheetLinks = await page.locator(`${SHEET} ${SHEET_LINKS}`).allTextContents();

    const offered = [...tabs, ...sheetLinks].map((text) => text.trim());
    for (const label of RAIL_ORDER) {
      expect(offered, `${label} is reachable from neither the tab bar nor the sheet`).toContain(label);
    }
  });

  test('traps focus while open and restores it to the trigger on Escape', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(
      page.locator(SHEET),
      'the sheet did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: SHEET_OPEN_TIMEOUT_MS });

    const insideSheet = await page.evaluate(
      (sheet) => document.querySelector(sheet)?.contains(document.activeElement),
      SHEET,
    );
    expect(insideSheet, 'focus stayed outside the modal sheet').toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator(SHEET)).toBeHidden();

    const restored = await page.evaluate(() => document.activeElement?.id);
    expect(restored, 'focus was not returned to the control that opened the sheet').toBe('nav-tab-more');
  });

  test('closes on its own close button', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(
      page.locator(SHEET),
      'the sheet did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: SHEET_OPEN_TIMEOUT_MS });

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
    await expect(
      page.locator(SHEET),
      'the sheet did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: SHEET_OPEN_TIMEOUT_MS });

    await page.locator(sheetId('Profile')).click();
    await page.waitForURL('**/profile', { timeout: 10_000 });
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
    for (const [index, label] of RAIL_ORDER_ANONYMOUS.entries()) {
      await expect(page.locator(`#nav-rail-${index}`)).toHaveText(label);
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
    await page.locator(railId('Catalog', RAIL_ORDER_ANONYMOUS)).click();
    await page.waitForURL('**/catalog', { timeout: 10_000 });
    await expect(page.locator('#nav-link-signin')).toBeVisible();
  });
});
