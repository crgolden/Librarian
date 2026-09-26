import AxeBuilder from '@axe-core/playwright';
import { test, expect, signInAsAdmin } from './fixtures.js';
import { AxeTags } from './axe-constants';
import { PlaywrightConstants } from './playwright-constants';
import e2eSettings from './e2e-settings.json';
import { AppUrls } from '../src/app/app-paths';

const AUTHED_ROUTES = [
  AppUrls.home,
  AppUrls.catalog,
  AppUrls.library,
  AppUrls.collections,
  AppUrls.profile,
  AppUrls.account,
  AppUrls.consoles,
  AppUrls.adminEnrichment,
] as const;
const ANONYMOUS_ROUTES = [AppUrls.home, AppUrls.catalog, AppUrls.faq, AppUrls.privacy] as const;

const ADMIN_ROUTE_LANDMARK = new Map<string, string>([[AppUrls.adminEnrichment, '#enrichment-no-run']]);

const ROUTE_NAMED_CONTROL = new Map<string, string>([[AppUrls.account, '#schedule-save']]);

const DESKTOP = e2eSettings.viewports.desktop;
const MOBILE = e2eSettings.viewports.mobile;

interface AxeSummary {
  violations: { id: string; impact?: string | null; nodes: number; targets: string[]; html: string[] }[];
  incomplete: { id: string; nodes: number; targets: string[] }[];
}

function targetsOf(nodes: { target: unknown[] }[]): string[] {
  return nodes.map((node) => node.target.flat().join(' '));
}

async function scan(page: import('@playwright/test').Page): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page })
    .withTags(Object.values(AxeTags))
    .analyze();

  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      targets: targetsOf(v.nodes),
      html: v.nodes.map((node) => node.html),
    })),
    incomplete: results.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length, targets: targetsOf(v.nodes) })),
  };
}

function expectNoViolationsAndNothingUnevaluated(summary: AxeSummary): void {
  const where = test.info().titlePath.join(' › ');
  expect(summary.violations, `${where}: ${JSON.stringify(summary.violations)}`).toEqual([]);
  expect(
    summary.incomplete,
    `${where}: axe could not evaluate ${JSON.stringify(summary.incomplete)}, which is not the same as passing`,
  ).toEqual([]);
}

test.describe('Accessibility — signed in, desktop rail', () => {
  test.use({ viewport: DESKTOP });

  for (const route of AUTHED_ROUTES) {
    test(`${route} has no WCAG A/AA violations`, async ({ authedPage: page, store }) => {
      await store.reset();

      const landmark = ADMIN_ROUTE_LANDMARK.get(route);
      if (landmark !== undefined) {
        await store.seedAdmin();
        await signInAsAdmin(page);
      }

      await page.goto(route);

      if (landmark !== undefined) {
        await expect(
          page.locator(landmark),
          `${route} never rendered — an error paragraph or a redirect scans just as clean as the page`,
        ).toBeVisible();
      }

      const namedControl = ROUTE_NAMED_CONTROL.get(route);
      if (namedControl !== undefined) {
        await expect(
          page.locator(namedControl),
          `${route} scanned before ${namedControl} carried its label, or it never does`,
        ).toHaveAccessibleName(/\S/);
      }

      expectNoViolationsAndNothingUnevaluated(await scan(page));
    });
  }
});

test.describe('Accessibility — anonymous', () => {
  test.use({ viewport: DESKTOP });

  for (const route of ANONYMOUS_ROUTES) {
    test(`${route} has no WCAG A/AA violations for a visitor with no account`, async ({ page }) => {
      await page.goto(route);
      expectNoViolationsAndNothingUnevaluated(await scan(page));
    });
  }
});

test.describe('Accessibility — mobile tab bar and the More sheet', () => {
  test.use({ viewport: MOBILE });

  test('the tab bar is clean', async ({ authedPage: page, store }) => {
    await store.reset();
    await page.goto(AppUrls.home);
    expectNoViolationsAndNothingUnevaluated(await scan(page));
  });

  test('the More sheet is clean while open, which is when it is operable', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto(AppUrls.home);
    await page.locator('#nav-tab-more').click();
    await expect(page.locator('#nav-sheet')).toBeVisible();

    expectNoViolationsAndNothingUnevaluated(await scan(page));
  });
});

test.describe('Accessibility — the light scheme is scanned too', () => {
  test.use({ viewport: DESKTOP, colorScheme: PlaywrightConstants.colorSchemes.light });

  test('the home page is clean in the light re-binding as well as the dark base', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto(AppUrls.home);
    expectNoViolationsAndNothingUnevaluated(await scan(page));
  });
});
