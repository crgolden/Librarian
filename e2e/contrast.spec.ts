import { randomIntBetween } from '@crgolden/modules/testing';
import { test, expect } from './fixtures.js';
import { CanvasContextTypes } from './markup-constants';
import { PlaywrightConstants } from './playwright-constants';
import { WcagContrastMinimums, WcagRelativeLuminance } from './wcag-constants';
import e2eSettings from './e2e-settings.json';
import { AppUrls } from '../src/app/app-paths';

interface Pair {
  name: string;
  foreground: string;
  background: string;
  minimum: number;
}

function wcagMinimum(kind: string): number {
  const minimums: Readonly<Record<string, number | undefined>> = WcagContrastMinimums;
  const minimum = minimums[kind];
  if (minimum === undefined) {
    throw new Error(`e2e-settings.json names the contrast minimum '${kind}', which WcagContrastMinimums does not declare.`);
  }
  return minimum;
}

const PAIRS: Pair[] = e2eSettings.contrastPairs.map((pair) => ({ ...pair, minimum: wcagMinimum(pair.minimum) }));

function newChannel(): number {
  return randomIntBetween(0, WcagRelativeLuminance.channelMaximum + 1);
}

function newSentinelColor(): string {
  return `rgb(${newChannel()}, ${newChannel()}, ${newChannel()})`;
}

async function measure(page: import('@playwright/test').Page, pairs: Pair[]) {
  return page.evaluate(
    ({ pairs: wanted, sentinel, luminance: coefficients, decimals, contextType }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext(contextType);
      if (context === null) {
        throw new Error('no 2d context');
      }

      const root = getComputedStyle(document.documentElement);
      context.fillStyle = sentinel;
      const sentinelAsParsed = context.fillStyle;

      const channels = (token: string): [number, number, number] => {
        const declared = root.getPropertyValue(token).trim();
        if (declared.length === 0) {
          throw new Error(`token ${token} resolves to nothing`);
        }
        context.fillStyle = sentinel;
        context.fillStyle = declared;
        if (context.fillStyle === sentinelAsParsed) {
          throw new Error(`token ${token} (${declared}) was rejected by Canvas2D`);
        }
        context.clearRect(0, 0, 1, 1);
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };

      const luminance = (rgb: [number, number, number]): number => {
        const [r, g, b] = rgb.map((value) => {
          const channel = value / coefficients.channelMaximum;
          return channel <= coefficients.linearThreshold
            ? channel / coefficients.linearDivisor
            : Math.pow((channel + coefficients.gammaOffset) / coefficients.gammaDivisor, coefficients.gammaExponent);
        });
        return coefficients.redWeight * r + coefficients.greenWeight * g + coefficients.blueWeight * b;
      };

      return wanted.map((pair) => {
        const a = luminance(channels(pair.foreground));
        const b = luminance(channels(pair.background));
        const ratio = (Math.max(a, b) + coefficients.flare) / (Math.min(a, b) + coefficients.flare);
        return { name: pair.name, minimum: pair.minimum, ratio: Number(ratio.toFixed(decimals)) };
      });
    },
    {
      pairs,
      sentinel: newSentinelColor(),
      luminance: WcagRelativeLuminance,
      decimals: e2eSettings.contrastRatioDecimals,
      contextType: CanvasContextTypes.twoDimensional,
    },
  );
}

for (const scheme of Object.values(PlaywrightConstants.colorSchemes)) {
  test.describe(`Palette contrast — ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`every documented pair clears its WCAG bar in the ${scheme} scheme`, async ({ page }) => {
      await page.goto(AppUrls.home);

      const measured = await measure(page, PAIRS);
      const failures = measured.filter((entry) => entry.ratio < entry.minimum);

      expect(
        failures,
        `DESIGN.md's Colors table is the summary; this is the check. Failing pairs: ${JSON.stringify(failures)}`,
      ).toEqual([]);
    });
  });
}
