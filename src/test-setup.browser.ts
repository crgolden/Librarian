import './styles.css';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { resolveTestComponentResources } from './test-setup-resources.browser';

const WEBFONT_TOKENS = ['--font-heading', '--font-body', '--font-mono'] as const;

function unquoted(family: string): string {
  return family.trim().replace(/^['"]|['"]$/g, '');
}

async function loadTheWebfontsOrFail(): Promise<void> {
  const root = getComputedStyle(document.documentElement);
  const families = WEBFONT_TOKENS.map((token) => unquoted(root.getPropertyValue(token).split(',')[0]));
  const faces = [...document.fonts].filter((face) => families.includes(unquoted(face.family)));
  const undeclared = families.filter((family) => !faces.some((face) => unquoted(face.family) === family));
  if (undeclared.length > 0) {
    throw new Error(`No @font-face is declared for ${undeclared.join(', ')}, so every measurement would be taken in fallback metrics.`);
  }
  await Promise.all(faces.map((face) => face.load()));
}

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

beforeAll(loadTheWebfontsOrFail);

beforeEach(async () => {
  await resolveTestComponentResources();
});
