import { CssValues } from '../e2e/css-constants';
import e2eSettings from '../e2e/e2e-settings.json';

const MID_LIGHTNESS = e2eSettings.theme.midLightness;
const SURFACE_TOKENS = ['--color-canvas', '--color-surface', '--color-surface-2'] as const;

function lightnessOf(token: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /oklch\(\s*([0-9.]+)/.exec(value);
  if (match === null) {
    throw new Error(`${token} is not an oklch() value: "${value}"`);
  }
  return Number.parseFloat(match[1]);
}

describe('The dark color scheme, which is the base', () => {
  it('keeps every surface darker than mid, with the ground darkest', () => {
    const [canvas, surface, surfaceTwo] = SURFACE_TOKENS.map(lightnessOf);

    expect(canvas).toBeLessThan(MID_LIGHTNESS);
    expect(surface).toBeGreaterThan(canvas);
    expect(surfaceTwo).toBeGreaterThan(surface);
  });

  it('declares the color-scheme property, not only the media query', () => {
    const declared = getComputedStyle(document.documentElement).colorScheme;

    expect(
      declared,
      'prefers-color-scheme tells the stylesheet about the user; color-scheme tells the browser about the document, ' +
        'and without it the browser paints its own controls light against a near-black page',
    ).toContain(CssValues.darkColorScheme);
  });
});
