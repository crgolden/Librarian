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
const ONLY_CLASS_TOKENS = /^\s*`\.[a-z][a-z0-9-]*`(?:[\s/,]+`\.[a-z][a-z0-9-]*`)*\s*$/i;

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

/**
 * `RULE_BLOCK` captures everything since the previous `}` as the selector, so a comment above a rule
 * lands inside it — `/* Cards … *\/ .card` never matches a selector test. Stripping first is what makes
 * selector-shape checks mean anything.
 */
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

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
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

const filesWithExtension = (dir, extension) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? filesWithExtension(full, extension)
      : full.endsWith(extension)
        ? [full]
        : [];
  });

const stylesheets = (dir) => filesWithExtension(dir, '.css');

/**
 * Angular applies a class two ways, and a scan that only understands `class="…"` reports a false
 * *negative* — the failure mode that lets the next phantom class through. `[class.x]` names the class
 * in the attribute, so the attribute name is tokenized rather than its value.
 */
const CLASS_ATTRIBUTE = /\bclass\s*=\s*"([^"]*)"/g;
const CLASS_BINDING = /\[class\.([a-z][a-z0-9-]*)\]/gi;

const classesUsedIn = (html) => {
  const used = new Map();
  for (const [, value] of html.matchAll(CLASS_ATTRIBUTE)) {
    for (const token of value.split(/\s+/)) {
      if (/^[a-z][a-z0-9-]*$/i.test(token)) used.set(`.${token}`, (used.get(`.${token}`) ?? 0) + 1);
    }
  }
  for (const [, name] of html.matchAll(CLASS_BINDING)) {
    used.set(`.${name}`, (used.get(`.${name}`) ?? 0) + 1);
  }
  return used;
};

/**
 * Selector parts that mention `className` at all, and the subset that reach it without an ancestor
 * qualifier. `th.library-sortable` is unscoped — the class sits in the subject compound.
 * `.catalog-detail > .link-button` is scoped: it reaches only usages inside the declaring component,
 * which is how `.link-button` covered 3 of its 13 usages while looking declared.
 */
const selectorPartsFor = (css, className) => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentions = new RegExp(`${escaped}(?![a-z0-9-])`, 'i');
  const subjectCompound = new RegExp(`(^|[ >+~])[^ >+~]*${escaped}(?![a-z0-9-])[^ >+~]*$`, 'i');

  const parts = rulesTargeting(css, className)
    .flatMap(({ selector }) => selector.split(',').map((part) => part.trim()))
    .filter((part) => mentions.test(part));

  return { parts, unscoped: parts.filter((part) => subjectCompound.test(part) && !/[ >+~]/.test(part)) };
};

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

const templates = filesWithExtension(stylesheetRoot, '.html');
const cssByFile = new Map(allStylesheets.map((file) => [file, withoutComments(readText(file))]));

/**
 * `.tab-label` carries no styling — `.site-nav-tabbar .tab-link`'s flex column places it and the text
 * inherits — but `e2e/nav.spec.ts` selects it when asserting the tab bar's label/icon stacking, so it is
 * a test hook rather than a phantom. Replacing it with an `id` per CODE-STYLE rule 10 is the real fix;
 * until then it is named here rather than left to look declared.
 */
const ALLOWED_UNDECLARED = new Set(['.ng-star-inserted', '.tab-label']);

/**
 * Classes declared only under an ancestor are reported, never failed. The check cannot tell a
 * legitimate scoping hook — `.tab-link`, every usage of which sits inside `.site-nav-tabbar`; the
 * `.excluded-list` wrapper — from an orphan like `.link-button`, which was declared once as
 * `.catalog-detail > .link-button` and left 10 of its 13 usages unstyled. Distinguishing them needs
 * the containing-ancestor relation, which this line-based scan does not have.
 */
const scopedOnly = [];

/**
 * Classes forked across component stylesheets that are already inventoried, with a disposition, in
 * AGENTS/PARKING_LOT.md §8a. Recorded as a baseline so a *new* fork fails while the known backlog stays
 * visible rather than silently allow-listed. `.cover-art` is in §8a's false-positive list: its
 * Components entry explicitly lets each surface set its own width, which is all four declarations do.
 */
const KNOWN_FORKS = new Set([
  '.catalog-card',
  '.cover-art',
  '.delete-confirm-actions',
  '.follow-list',
  '.follow-list-entry',
  '.form-actions',
  '.item-unavailable',
  '.status-card',
]);

const usedClasses = new Map();
for (const template of templates) {
  for (const [className, count] of classesUsedIn(readText(template))) {
    usedClasses.set(className, (usedClasses.get(className) ?? 0) + count);
  }
}

for (const [className, usages] of [...usedClasses].sort()) {
  if (ALLOWED_UNDECLARED.has(className)) continue;

  const found = [...cssByFile.values()].map((css) => selectorPartsFor(css, className));
  const mentioned = found.some(({ parts }) => parts.length > 0);
  const unscoped = found.some(({ unscoped: u }) => u.length > 0);

  if (!mentioned) {
    failures.push(
      `${className}: used ${usages} time(s) in src/**/*.html and named in no stylesheet selector. ` +
        'Reach for an existing primitive rather than inventing a name beside the vocabulary.',
    );
  } else if (!unscoped) {
    scopedOnly.push(`${className} (${usages} usage(s))`);
  }
}

const declaringComponents = new Map();
for (const [file, css] of cssByFile) {
  if (file === sharedStylesheet) continue;
  for (const className of usedClasses.keys()) {
    if (rulesTargeting(css, className).length === 0) continue;
    if (!declaringComponents.has(className)) declaringComponents.set(className, []);
    declaringComponents.get(className).push(relative(repoRoot, file).replace(/\\/g, '/'));
  }
}

const knownForksSeen = [];

for (const [className, files] of [...declaringComponents].sort()) {
  if (files.length < 2) continue;
  if (KNOWN_FORKS.has(className)) {
    knownForksSeen.push(`${className} (${files.length} files)`);
    continue;
  }
  failures.push(
    `${className}: declared in ${files.length} component stylesheets (${files.join(', ')}) — ` +
      'a shared appearance becomes one primitive in styles.css, not a copy per component.',
  );
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} primitive violation(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nSee DESIGN.md → "Where styling lives" → "One primitive, one definition".');
  process.exit(1);
}

if (scopedOnly.length > 0) {
  console.log(`\nDeclared only under an ancestor (${scopedOnly.length}): ${scopedOnly.join(', ')}`);
}

if (knownForksSeen.length > 0) {
  console.log(
    `\nKnown forks, baselined against AGENTS/PARKING_LOT.md §8a (${knownForksSeen.length}): ` +
      `${knownForksSeen.join(', ')}`,
  );
}

console.log(
  `\nOK: every primitive is declared exactly once in src/styles.css, and all ${usedClasses.size} ` +
    'template classes are named by a stylesheet.',
);
