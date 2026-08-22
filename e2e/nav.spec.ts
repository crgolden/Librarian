import { test, expect, signInAsAdmin } from './fixtures.js';
import { settleWebfonts } from './layout.js';

const PRIMARY_LINKS = ['Home', 'Catalog', 'Collections', 'Library', 'Profile'];
const DESKTOP_NAV = '#site-nav-desktop';
const TABBAR = '#site-nav-tabbar';
const NAV_LABELS = '[id^="nav-label-"]';
const TAB_LABELS = '[id^="tab-label-"]';
const TAB_LINKS = '[id^="tab-link-"]';
const NAV_ICONS = '[id^="nav-icon-"]';

test.describe('SiteNavComponent — desktop', () => {
  for (const startPath of ['/', '/catalog', '/collections', '/library', '/profile']) {
    test(`all primary destinations are reachable from the header nav on ${startPath}`, async ({ authedPage: page, store }) => {
      await store.reset();

      await page.goto(startPath);
      for (const label of PRIMARY_LINKS) {
        await expect(page.locator(DESKTOP_NAV).getByRole('link', { name: label, exact: true })).toBeVisible();
      }
    });
  }

  test('clicking Profile in the header nav navigates to /profile without a deep link', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    await page.locator(DESKTOP_NAV).getByRole('link', { name: 'Profile', exact: true }).click();
    await page.waitForURL('**/profile', { timeout: 10_000 });
  });

  test('the active route is visually marked in the header nav', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/catalog');
    const catalogLink = page.locator(DESKTOP_NAV).getByRole('link', { name: 'Catalog', exact: true });
    await expect(catalogLink).toHaveClass(/nav-active/);

    const homeLink = page.locator(DESKTOP_NAV).getByRole('link', { name: 'Home', exact: true });
    await expect(homeLink).not.toHaveClass(/nav-active/);
  });
});

test.describe('SiteNavComponent — responsive escalation', () => {
  test('above xl the header carries icons and the user chip, with labels held back as tooltips', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await expect(page.locator('#user-chip')).toBeVisible();
    await expect(page.locator(NAV_LABELS).first()).toBeHidden();
    expect(await page.locator(NAV_ICONS).count()).toBeGreaterThan(0);
  });

  test('a label appears on hover and on keyboard focus, and only for the link addressed', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const catalog = page.locator(DESKTOP_NAV).getByRole('link', { name: 'Catalog', exact: true });
    const catalogLabel = catalog.locator(NAV_LABELS);
    const homeLabel = page
      .locator(DESKTOP_NAV)
      .getByRole('link', { name: 'Home', exact: true })
      .locator(NAV_LABELS);

    await expect(catalogLabel).toBeHidden();
    await catalog.hover();
    await expect(catalogLabel).toBeVisible();
    await expect(homeLabel).toBeHidden();

    await page.mouse.move(0, 400);
    await expect(catalogLabel).toBeHidden();

    await catalog.focus();
    await expect(catalogLabel).toBeVisible();
  });

  test('the chip boundary is max-width, so each named width sits in the narrower band', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');

    await page.setViewportSize({ width: 1281, height: 900 });
    await expect(page.locator('#user-chip')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('#user-chip')).toBeHidden();
  });

  test('the tab bar below md keeps its labels visible, unlike the desktop header', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 700, height: 900 });

    await page.goto('/');
    await expect(page.locator(DESKTOP_NAV)).toBeHidden();
    await expect(page.locator(TAB_LABELS).first()).toBeVisible();
  });

  for (const width of [1440, 1100]) {
    for (const asAdmin of [false, true]) {
      const who = asAdmin ? 'an admin' : 'a non-admin';
      test(`${who}'s header stays on one unclipped row at ${width}px`, async ({ authedPage: page, store }) => {
        await store.reset();
        if (asAdmin) {
          await store.seedAdmin();
          await signInAsAdmin(page);
        }
        await page.setViewportSize({ width, height: 900 });

        await page.goto('/');
        if (asAdmin) {
          await expect(
            page.locator(DESKTOP_NAV).getByRole('link', { name: 'Enrichment Runs', exact: true }),
          ).toBeVisible();
        }
        await settleWebfonts(page, ['#brand']);

        const layout = await page.locator(DESKTOP_NAV).evaluate((nav) => {
          const links = Array.from(nav.querySelectorAll('a'));
          const centres = links.map((link) => {
            const box = link.getBoundingClientRect();
            return Math.round(box.top + box.height / 2);
          });
          return {
            rows: new Set(centres).size,
            linkCount: links.length,
            minTop: Math.min(...links.map((link) => Math.round(link.getBoundingClientRect().top))),
          };
        });

        expect(layout.linkCount).toBe(asAdmin ? 8 : 7);
        expect(layout.rows, `header wrapped; ${JSON.stringify(layout)}`).toBe(1);
        expect(
          layout.minTop,
          `header escaped the top of the viewport; ${JSON.stringify(layout)}`,
        ).toBeGreaterThanOrEqual(0);
      });
    }
  }

  test('the user-email cap truncates a long address, measured against the cap itself', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 1440, height: 900 });

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

  test('every link keeps its accessible name once the labels are tooltips', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 900, height: 900 });

    await page.goto('/');
    await expect(page.locator(DESKTOP_NAV)).toBeVisible();
    await expect(page.locator(NAV_LABELS).first()).toBeHidden();

    for (const label of [...PRIMARY_LINKS, 'PSN Settings', 'Sign out']) {
      await expect(page.locator(DESKTOP_NAV).getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });
});

test.describe('SiteNavComponent — mobile bottom tab bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders a 6-item bottom tab bar (5 primary destinations + PSN) instead of the desktop nav', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(TABBAR)).toBeVisible();
    await expect(page.locator(DESKTOP_NAV)).toBeHidden();
    await expect(page.locator(TAB_LINKS)).toHaveCount(6);
  });

  test('every tab label stays on one line and the stacked icon fits inside the bar', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.locator(TABBAR)).toBeVisible();
    await settleWebfonts(page, [TAB_LABELS]);

    const layout = await page.locator(TABBAR).evaluate((bar, labelSelector) => {
      const lineCounts = Array.from(bar.querySelectorAll(labelSelector)).map((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return { text: label.textContent?.trim(), lines: range.getClientRects().length };
      });
      return { lineCounts, scrollHeight: bar.scrollHeight, clientHeight: bar.clientHeight };
    }, TAB_LABELS);

    expect(layout.lineCounts.filter((label) => label.lines !== 1)).toEqual([]);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight);
  });

  test('PSN is reachable from the mobile tab bar', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator(TABBAR).getByRole('link', { name: 'PSN', exact: true }).click();
    await page.waitForURL('**/psn', { timeout: 10_000 });
  });

  test('tapping a tab navigates correctly', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await page.locator(TABBAR).getByRole('link', { name: 'Library', exact: true }).click();
    await page.waitForURL('**/library', { timeout: 10_000 });
  });
});

test.describe('SiteNavComponent — anonymous', () => {
  test('shows only Sign in, no primary destinations', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    for (const label of ['Catalog', 'Collections', 'Library']) {
      await expect(page.locator(DESKTOP_NAV).getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
  });
});
