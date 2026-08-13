import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const designDocPath = join(repoRoot, 'DESIGN.md');
const sharedStylesheet = join(repoRoot, 'src', 'styles.css');
const stylesheetRoot = join(repoRoot, 'src');

/**
 * A primitive is named in the *bold lead-in* of a Components list item, and that lead-in holds nothing
 * but backticked class tokens and separators — `- **`.card` / `.card-accent`**`. Bold prose elsewhere in
 * an item mentions classes that live *inside* a component (`.user-chip`, `.site-nav-tabbar`) and are not
 * themselves primitives, so requiring the whole bold segment to be class tokens is what separates the two.
 */
const BOLD_SEGMENT = /\*\*(.+?)\*\*/gs;
const CLASS_TOKEN = /`(\.[a-z][a-z0-9-]*)`/gi;
const ONLY_CLASS_TOKENS = /^(?:\s*`\.[a-z][a-z0-9-]*`\s*[/,]?\s*)+$/i;

/**
 * Size and placement may differ per surface — a 48px table thumbnail and a 320px detail image are the
 * same primitive. Shape, radius, fit, colour and typography are what the primitive *is*, so restating
 * any of those outside styles.css forks the vocabulary.
 */
const SIZING_AND_PLACEMENT = new RegExp(
  `^(?:(?:min-|max-)?(?:width|height)|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|grid-(?:column|row|area)` +
    `|(?:align|justify|place)-self|order|position|top|right|bottom|left|inset(?:-[a-z]+)?` +
    `|flex(?:-(?:grow|shrink|basis))?|z-index)$`,
);

const RULE_BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const DECLARED_PROPERTY = /(?:^|;)\s*([a-z-]+)\s*:/g;

/** Every rule in `css` whose selector targets `className`, paired with the properties it declares. */
const rulesTargeting = (css, className) => {
  const mentions = new RegExp(`${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9-])`, 'i');
  const found = [];
  for (const [, selector, body] of css.matchAll(RULE_BLOCK)) {
    if (!mentions.test(selector)) continue;
    found.push({
      selector: selector.trim().replace(/\s+/g, ' '),
      properties: [...body.matchAll(DECLARED_PROPERTY)].map(([, property]) => property),
    });
  }
  return found;
};

const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const componentsSection = () => {
  const doc = readText(designDocPath);
  const start = doc.indexOf('\n## Components\n');
  if (start === -1) throw new Error('DESIGN.md has no "## Components" section — the parser found nothing to read.');
  const end = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, end === -1 ? doc.length : end);
};

const primitivesFromDesignDoc = () => {
  const names = new Set();
  for (const [, segment] of componentsSection().matchAll(BOLD_SEGMENT)) {
    if (!ONLY_CLASS_TOKENS.test(segment)) continue;
    for (const [, className] of segment.matchAll(CLASS_TOKEN)) names.add(className);
  }
  return [...names].sort();
};

const stylesheets = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? stylesheets(full) : full.endsWith('.css') ? [full] : [];
  });

const primitives = primitivesFromDesignDoc();
const SANITY_FLOOR = 6;

console.log(`Primitives declared in DESIGN.md Components (${primitives.length}): ${primitives.join(' ')}`);

if (primitives.length < SANITY_FLOOR) {
  console.error(
    `\nFAIL: parsed only ${primitives.length} primitives, below the sanity floor of ${SANITY_FLOOR}. ` +
      'The Components list is formatted in a way this parser no longer understands — fix the parser rather than the floor.',
  );
  process.exit(1);
}

const failures = [];
const allStylesheets = stylesheets(stylesheetRoot);

for (const className of primitives) {
  let definedInShared = false;

  for (const file of allStylesheets) {
    const rules = rulesTargeting(readText(file), className);
    if (rules.length === 0) continue;

    if (file === sharedStylesheet) {
      definedInShared = true;
      continue;
    }

    for (const { selector, properties } of rules) {
      const redefining = properties.filter((property) => !SIZING_AND_PLACEMENT.test(property));
      if (redefining.length > 0) {
        failures.push(
          `${className}: "${selector}" in ${relative(repoRoot, file).replace(/\\/g, '/')} restates ` +
            `${redefining.join(', ')} — a component may size and place a primitive, not redefine it.`,
        );
      }
    }
  }

  if (!definedInShared) {
    failures.push(`${className}: named in DESIGN.md Components but not defined in src/styles.css.`);
  }
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} primitive violation(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nSee DESIGN.md → "Where styling lives" → "One primitive, one definition".');
  process.exit(1);
}

console.log(`\nOK: every primitive is declared exactly once, in src/styles.css.`);
