import e2eSettings from '../e2e/e2e-settings.json';

const MID_LIGHTNESS = e2eSettings.theme.midLightness;

function lightnessOf(token: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /oklch\(\s*([0-9.]+)/.exec(value);
  if (match === null) {
    throw new Error(`${token} is not an oklch() value: "${value}"`);
  }
  return Number.parseFloat(match[1]);
}

describe('The light color scheme', () => {
  it('inverts the ground rather than introducing a second design', () => {
    const canvas = lightnessOf('--color-canvas');

    expect(canvas).toBeGreaterThan(MID_LIGHTNESS);
  });
});
