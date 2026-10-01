import { randomIntBetween } from '@crgolden/modules/testing';
import { CanvasContextTypes } from '../e2e/markup-constants';
import { WcagContrastMinimums, WcagRelativeLuminance } from '../e2e/wcag-constants';
import e2eSettings from '../e2e/e2e-settings.json';

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

function newSentinelColor(): string {
  const channel = () => randomIntBetween(0, WcagRelativeLuminance.channelMaximum + 1);
  return `rgb(${channel()}, ${channel()}, ${channel()})`;
}

function measure(pairs: readonly Pair[]): { name: string; minimum: number; ratio: number }[] {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext(CanvasContextTypes.twoDimensional);
  if (context === null) {
    throw new Error('The browser offers no 2d canvas, so no token can be measured.');
  }
  const root = getComputedStyle(document.documentElement);
  const sentinel = newSentinelColor();
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
      const channel = value / WcagRelativeLuminance.channelMaximum;
      return channel <= WcagRelativeLuminance.linearThreshold
        ? channel / WcagRelativeLuminance.linearDivisor
        : Math.pow((channel + WcagRelativeLuminance.gammaOffset) / WcagRelativeLuminance.gammaDivisor, WcagRelativeLuminance.gammaExponent);
    });
    return WcagRelativeLuminance.redWeight * r + WcagRelativeLuminance.greenWeight * g + WcagRelativeLuminance.blueWeight * b;
  };

  return pairs.map((pair) => {
    const a = luminance(channels(pair.foreground));
    const b = luminance(channels(pair.background));
    const ratio = (Math.max(a, b) + WcagRelativeLuminance.flare) / (Math.min(a, b) + WcagRelativeLuminance.flare);
    return { name: pair.name, minimum: pair.minimum, ratio: Number(ratio.toFixed(e2eSettings.contrastRatioDecimals)) };
  });
}

describe('Palette contrast in the active color scheme', () => {
  it('clears the WCAG bar for every documented pair', () => {
    const pairs: Pair[] = e2eSettings.contrastPairs.map((pair) => ({ ...pair, minimum: wcagMinimum(pair.minimum) }));

    const measured = measure(pairs);

    expect(
      measured.filter((entry) => entry.ratio < entry.minimum),
      "DESIGN.md's Colors table is the summary; this is the check",
    ).toEqual([]);
  });
});
