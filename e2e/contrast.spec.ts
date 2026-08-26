import { test, expect } from './fixtures.js';

interface Pair {
  name: string;
  foreground: string;
  background: string;
  minimum: number;
}

const PAIRS: Pair[] = [
  { name: 'text on canvas', foreground: '--color-text', background: '--color-canvas', minimum: 4.5 },
  { name: 'text on surface', foreground: '--color-text', background: '--color-surface', minimum: 4.5 },
  { name: 'text on surface-2', foreground: '--color-text', background: '--color-surface-2', minimum: 4.5 },
  { name: 'text-muted on canvas', foreground: '--color-text-muted', background: '--color-canvas', minimum: 4.5 },
  { name: 'text-muted on surface', foreground: '--color-text-muted', background: '--color-surface', minimum: 4.5 },
  { name: 'accent on canvas', foreground: '--color-accent', background: '--color-canvas', minimum: 4.5 },
  { name: 'accent on surface', foreground: '--color-accent', background: '--color-surface', minimum: 4.5 },
  { name: 'danger on surface', foreground: '--color-danger', background: '--color-surface', minimum: 4.5 },
  { name: 'on-fill ink on the accent fill', foreground: '--color-on-fill', background: '--color-accent', minimum: 4.5 },
  { name: 'on-fill ink on the danger fill', foreground: '--color-on-fill', background: '--color-danger', minimum: 4.5 },
  { name: 'on-fill ink on the warn fill', foreground: '--color-on-fill', background: '--color-warn', minimum: 4.5 },
  { name: 'on-fill ink on the danger HOVER fill', foreground: '--color-on-fill', background: '--color-danger-hover', minimum: 4.5 },
  { name: 'accent-hover fill under its own ink', foreground: '--color-on-fill', background: '--color-accent-hover', minimum: 4.5 },
  { name: 'line-strong on canvas (control edge, 1.4.11)', foreground: '--color-line-strong', background: '--color-canvas', minimum: 3 },
  { name: 'line-strong on surface (control edge, 1.4.11)', foreground: '--color-line-strong', background: '--color-surface', minimum: 3 },
  { name: 'line-strong on surface-2 (control edge, 1.4.11)', foreground: '--color-line-strong', background: '--color-surface-2', minimum: 3 },
  { name: 'focus ring on canvas (1.4.11)', foreground: '--color-focus', background: '--color-canvas', minimum: 3 },
  { name: 'focus ring on surface (1.4.11)', foreground: '--color-focus', background: '--color-surface', minimum: 3 },
  { name: 'focus ring on surface-2 (1.4.11)', foreground: '--color-focus', background: '--color-surface-2', minimum: 3 },
  { name: 'psn on surface (1.4.11)', foreground: '--color-psn', background: '--color-surface', minimum: 3 },
];

const SENTINEL = 'rgb(255, 0, 255)';

async function measure(page: import('@playwright/test').Page, pairs: Pair[]) {
  return page.evaluate(
    ({ pairs: wanted, sentinel }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('no 2d context');
      }

      const root = getComputedStyle(document.documentElement);

      const channels = (token: string): [number, number, number] => {
        const declared = root.getPropertyValue(token).trim();
        if (declared.length === 0) {
          throw new Error(`token ${token} resolves to nothing`);
        }
        context.fillStyle = sentinel;
        context.fillStyle = declared;
        if (context.fillStyle === sentinel) {
          throw new Error(`token ${token} (${declared}) was rejected by Canvas2D`);
        }
        context.clearRect(0, 0, 1, 1);
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };

      const luminance = (rgb: [number, number, number]): number => {
        const [r, g, b] = rgb.map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      return wanted.map((pair) => {
        const a = luminance(channels(pair.foreground));
        const b = luminance(channels(pair.background));
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        return { name: pair.name, minimum: pair.minimum, ratio: Math.round(ratio * 100) / 100 };
      });
    },
    { pairs, sentinel: SENTINEL },
  );
}

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`Palette contrast — ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`every documented pair clears its WCAG bar in the ${scheme} scheme`, async ({ page }) => {
      await page.goto('/');

      const measured = await measure(page, PAIRS);
      const failures = measured.filter((entry) => entry.ratio < entry.minimum);

      expect(
        failures,
        `DESIGN.md's Colors table is the summary; this is the check. Failing pairs: ${JSON.stringify(failures)}`,
      ).toEqual([]);
    });
  });
}
