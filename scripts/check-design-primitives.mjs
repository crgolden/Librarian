import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SANITY_FLOOR, analyze } from './design-primitives.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const designDocPath = join(repoRoot, 'DESIGN.md');
const sharedStylesheet = join(repoRoot, 'src', 'styles.css');
const stylesheetRoot = join(repoRoot, 'src');

const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const repoRelative = (path) => relative(repoRoot, path).replace(/\\/g, '/');

const filesWithExtension = (dir, extension) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? filesWithExtension(full, extension)
      : full.endsWith(extension)
        ? [full]
        : [];
  });

const { primitives, failures, allowedScopedSeen, knownForksSeen, templateClassCount } = analyze({
  designDoc: readText(designDocPath),
  stylesheets: filesWithExtension(stylesheetRoot, '.css').map((path) => ({
    path: repoRelative(path),
    css: readText(path),
  })),
  templates: filesWithExtension(stylesheetRoot, '.html').map((path) => ({
    path: repoRelative(path),
    html: readText(path),
  })),
  sharedStylesheetPath: repoRelative(sharedStylesheet),
});

console.log(`Primitives declared in DESIGN.md Components (${primitives.length}): ${primitives.join(' ')}`);

if (primitives.length < SANITY_FLOOR) {
  console.error(
    `\nFAIL: parsed only ${primitives.length} primitives, below the sanity floor of ${SANITY_FLOOR}. ` +
      'The Components list is formatted in a way this parser no longer understands — fix the parser rather than the floor.',
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} primitive violation(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nSee DESIGN.md → "Where styling lives" → "One primitive, one definition".');
  process.exit(1);
}

if (allowedScopedSeen.length > 0) {
  console.log(`\nAllow-listed scoping hooks (${allowedScopedSeen.length}): ${allowedScopedSeen.join(', ')}`);
}

if (knownForksSeen.length > 0) {
  console.log(
    `\nKnown forks, baselined against AGENTS/PARKING_LOT.md §8a (${knownForksSeen.length}): ` +
      `${knownForksSeen.join(', ')}`,
  );
}

console.log(
  `\nOK: every primitive is declared exactly once in src/styles.css, and all ${templateClassCount} ` +
    'template classes are reached by a stylesheet selector.',
);
