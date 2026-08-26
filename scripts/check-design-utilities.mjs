import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeUtilities, unconsumedThemeTokens } from './design-primitives.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builtRoot = join(repoRoot, 'dist');
const sourceRoot = join(repoRoot, 'src');

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

if (!existsSync(builtRoot)) {
  console.error(
    `FAIL: no dist/ at ${repoRelative(builtRoot)}. This check reads the CSS the browser actually gets, ` +
      'so it must run after a build — `npm run e2e` or `npm run build` — not before one.',
  );
  process.exit(1);
}

const builtStylesheets = filesWithExtension(builtRoot, '.css');
const componentStylesheets = filesWithExtension(sourceRoot, '.css').filter((path) =>
  path.endsWith('.component.css'),
);

if (builtStylesheets.length === 0) {
  console.error(
    `FAIL: dist/ contains no .css at all. A zero-stylesheet run would pass every class vacuously, ` +
      'so this is a hard failure rather than an empty success.',
  );
  process.exit(1);
}

const { failures, allowedScopedSeen, templateClassCount } = analyzeUtilities({
  stylesheets: [...builtStylesheets, ...componentStylesheets].map((path) => ({
    path: repoRelative(path),
    css: readText(path),
  })),
  templates: filesWithExtension(sourceRoot, '.html').map((path) => ({
    path: repoRelative(path),
    html: readText(path),
  })),
});

console.log(
  `Reading ${builtStylesheets.length} built stylesheet(s) and ${componentStylesheets.length} ` +
    'component stylesheet(s).',
);

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} unreachable template class(es).`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\nA class here reaches no shipped selector. Under Tailwind that usually means a mistyped utility, ' +
      'which the compiler drops in silence.',
  );
  process.exit(1);
}

if (allowedScopedSeen.length > 0) {
  console.log(`\nAllow-listed scoping hooks (${allowedScopedSeen.length}): ${allowedScopedSeen.join(', ')}`);
}

const unconsumed = unconsumedThemeTokens({
  themeCss: readText(join(sourceRoot, 'styles.css')),
  stylesheets: [...builtStylesheets, ...componentStylesheets].map((path) => readText(path)),
});

if (unconsumed.length > 0) {
  console.error(`\nFAIL: ${unconsumed.length} @theme token(s) declared but referenced by nothing that ships.`);
  for (const token of unconsumed) console.error(`  ${token}`);
  console.error(
    '\nA token that resolves is not a token that is used. `--container-prose` was emitted, greppable and ' +
      'documented while `max-w-prose` — a Tailwind built-in pinned to 65ch — ignored it, so the measure was ' +
      'wrong everywhere and nothing failed. Consume the token, delete it, or rename what should consume it.',
  );
  process.exit(1);
}

console.log(
  `\nOK: all ${templateClassCount} template classes are reached by CSS that actually ships, ` +
    'and every @theme token is referenced by it.',
);
