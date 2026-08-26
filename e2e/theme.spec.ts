import { test, expect } from './fixtures.js';

const SURFACE_TOKENS = ['--color-canvas', '--color-surface', '--color-surface-2'] as const;

async function tokenValues(page: import('@playwright/test').Page, tokens: readonly string[]) {
  return page.evaluate((wanted) => {
    const root = getComputedStyle(document.documentElement);
    return Object.fromEntries(wanted.map((token) => [token, root.getPropertyValue(token).trim()]));
  }, tokens);
}

async function paintedBackground(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor);
}

function lightnessOf(token: string): number {
  const match = /oklch\(\s*([0-9.]+)/.exec(token);
  if (match === null) {
    throw new Error(`token is not an oklch() value: "${token}"`);
  }
  return Number.parseFloat(match[1]);
}

test.describe('Colour scheme — dark is the base', () => {
  test.use({ colorScheme: 'dark' });

  test('every surface token is darker than mid, and the ground is the darkest of them', async ({ page }) => {
    await page.goto('/');
    const tokens = await tokenValues(page, SURFACE_TOKENS);

    const canvas = lightnessOf(tokens['--color-canvas']);
    const surface = lightnessOf(tokens['--color-surface']);
    const surfaceTwo = lightnessOf(tokens['--color-surface-2']);

    expect(canvas, JSON.stringify(tokens)).toBeLessThan(0.5);
    expect(surface).toBeGreaterThan(canvas);
    expect(surfaceTwo).toBeGreaterThan(surface);
  });

  test('the document declares the color-scheme property, not just the media query', async ({ page }) => {
    await page.goto('/');

    const declared = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

    expect(
      declared,
      'prefers-color-scheme tells this stylesheet about the user; color-scheme tells the browser about ' +
        'this document. Without it the UA paints scrollbars, form controls and its own canvas light ' +
        'against a near-black page, and no token or contrast assertion can see it',
    ).toContain('dark');
  });

  test('no surface, line or text token spends chroma — that is reserved for the accent', async ({ page }) => {
    await page.goto('/');
    const neutral = await tokenValues(page, [
      '--color-canvas',
      '--color-surface',
      '--color-surface-2',
      '--color-line',
      '--color-line-strong',
      '--color-text',
      '--color-text-muted',
    ]);

    const overChroma = Object.entries(neutral).filter(([, value]) => {
      const match = /oklch\(\s*[0-9.]+\s+([0-9.]+)/.exec(value);
      return match !== null && Number.parseFloat(match[1]) > 0.02;
    });

    expect(overChroma, `DESIGN.md: chroma above 0.02 on a ground token is a defect`).toEqual([]);
  });
});

test.describe('Colour scheme — light re-binds the same tokens', () => {
  test.use({ colorScheme: 'light' });

  test('the ground inverts rather than a second design appearing', async ({ page }) => {
    await page.goto('/');
    const tokens = await tokenValues(page, SURFACE_TOKENS);

    expect(lightnessOf(tokens['--color-canvas']), JSON.stringify(tokens)).toBeGreaterThan(0.5);
  });
});

test.describe('Colour scheme — the page actually repaints', () => {
  test('the same element paints a different background in each scheme, with no toggle in the UI', async ({
    browser,
  }) => {
    const dark = await browser.newContext({ colorScheme: 'dark' });
    const light = await browser.newContext({ colorScheme: 'light' });

    const darkPage = await dark.newPage();
    const lightPage = await light.newPage();
    await darkPage.goto('/');
    await lightPage.goto('/');

    const darkBody = await paintedBackground(darkPage, 'body');
    const lightBody = await paintedBackground(lightPage, 'body');

    expect(darkBody).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      lightBody,
      'both schemes painted the same background — the light re-binding is not taking effect',
    ).not.toBe(darkBody);

    await dark.close();
    await light.close();
  });
});

function restoreLeadingZeros(value: string): string {
  return value.replace(/(^|[^0-9])\.(?=[0-9])/g, '$10.').replace(/\s+/g, ' ').trim();
}

async function assertRing(
  page: import('@playwright/test').Page,
  selectors: readonly string[],
): Promise<void> {
  const focusToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-focus').trim(),
  );
  expect(focusToken, '--color-focus resolves to nothing').not.toBe('');

  for (const selector of selectors) {
    const ring = await page.locator(selector).evaluate((element) => {
      element.focus();
      const style = getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
        color: style.outlineColor,
      };
    });

    expect(ring.style, `${selector} has no focus outline`).not.toBe('none');
    expect(
      ring.style,
      `${selector} shows Chromium's default 'auto' ring (measured auto/1px/1px), which ignores outline-color`,
    ).toBe('solid');
    expect(ring.offset, `DESIGN.md: outline-offset is mandatory on ${selector}`).toBe('2px');
    expect(ring.width, `${selector} focus ring is not 2px`).toBe('2px');
    expect(restoreLeadingZeros(ring.color), `${selector} focus ring is not --color-focus`).toBe(
      restoreLeadingZeros(focusToken),
    );
  }
}

test.describe('Focus ring — the offset is the contrast', () => {
  test('every link and button ring is the design token at a 2px offset, not the browser default', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await page.goto('/');
    await assertRing(page, ['#brand', '#nav-rail-0', '#nav-link-signin']);
  });

  test('the tab bar is ringed too — a <button>, where a stray `outline: none` would land first', async ({
    anonymousPage: page,
    store,
  }) => {
    await store.reset();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#site-nav-tabbar')).toBeVisible();
    await assertRing(page, ['#nav-tab-more', '#nav-tab-0']);
  });
});
