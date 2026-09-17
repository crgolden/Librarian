import AxeBuilder from '@axe-core/playwright';
import { test, expect, signInAsAdmin } from './fixtures.js';

const AUTHED_ROUTES = [
  '/',
  '/catalog',
  '/library',
  '/collections',
  '/profile',
  '/account',
  '/consoles',
  '/admin/enrichment',
] as const;
const ANONYMOUS_ROUTES = ['/', '/catalog', '/faq', '/privacy'] as const;

const ADMIN_ROUTE_LANDMARK = new Map<string, string>([['/admin/enrichment', '#enrichment-no-run']]);

const ROUTE_NAMED_CONTROL = new Map<string, string>([['/account', '#schedule-save']]);

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

interface AxeSummary {
  violations: { id: string; impact?: string | null; nodes: number; targets: string[]; html: string[] }[];
  incomplete: { id: string; nodes: number; targets: string[] }[];
}

function targetsOf(nodes: { target: unknown[] }[]): string[] {
  return nodes.map((node) => node.target.flat().join(' '));
}

async function scan(page: import('@playwright/test').Page): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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

function expectNoViolationsAndNothingUnevaluated(summary: AxeSummary, where: string): void {
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

      expectNoViolationsAndNothingUnevaluated(await scan(page), `signed in, desktop, ${route}`);
    });
  }
});

test.describe('Accessibility — anonymous', () => {
  test.use({ viewport: DESKTOP });

  for (const route of ANONYMOUS_ROUTES) {
    test(`${route} has no WCAG A/AA violations for a visitor with no account`, async ({ page }) => {
      await page.goto(route);
      expectNoViolationsAndNothingUnevaluated(await scan(page), `anonymous, desktop, ${route}`);
    });
  }
});

test.describe('Accessibility — mobile tab bar and the More sheet', () => {
  test.use({ viewport: MOBILE });

  test('the tab bar is clean', async ({ authedPage: page, store }) => {
    await store.reset();
    await page.goto('/');
    expectNoViolationsAndNothingUnevaluated(await scan(page), 'signed in, mobile, tab bar');
  });

  test('the More sheet is clean while open, which is when it is operable', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');
    await page.locator('#nav-tab-more').click();
    await expect(page.locator('#nav-sheet')).toBeVisible();

    expectNoViolationsAndNothingUnevaluated(await scan(page), 'signed in, mobile, sheet open');
  });
});

test.describe('Accessibility — the light scheme is scanned too', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'light' });

  test('the home page is clean in the light re-binding as well as the dark base', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');
    expectNoViolationsAndNothingUnevaluated(await scan(page), 'signed in, desktop, light scheme');
  });
});
