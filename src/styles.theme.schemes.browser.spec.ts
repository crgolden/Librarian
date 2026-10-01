import { CssValues } from '../e2e/css-constants';
import e2eSettings from '../e2e/e2e-settings.json';

const NEUTRAL_TOKENS = [
  '--color-canvas',
  '--color-surface',
  '--color-surface-2',
  '--color-line',
  '--color-line-strong',
  '--color-text',
  '--color-text-muted',
];

function chromaOf(token: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /oklch\(\s*[0-9.]+\s+([0-9.]+)/.exec(value);
  if (match === null) {
    throw new Error(`${token} resolves to "${value}", not an oklch() color, so its chroma cannot be measured.`);
  }
  return Number.parseFloat(match[1]);
}

function paintedColorOf(token: string): string {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  document.body.appendChild(probe);
  const painted = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return painted;
}

describe('Either color scheme', () => {
  it('spends no chroma on a surface, line or text token, which is reserved for the accent', () => {
    const overChroma = NEUTRAL_TOKENS.filter((token) => chromaOf(token) > e2eSettings.theme.neutralChromaCeiling);

    expect(overChroma, 'DESIGN.md: chroma above the neutral ceiling on a ground token is a defect').toEqual([]);
  });

  it('paints the page with the scheme’s own ground', () => {
    const body = getComputedStyle(document.body).backgroundColor;

    expect(body).not.toBe(CssValues.transparent);
    expect(body, 'the body paints something other than the scheme’s canvas token').toBe(paintedColorOf('--color-canvas'));
  });
});
