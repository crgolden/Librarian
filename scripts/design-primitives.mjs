const BOLD_SEGMENT = /\*\*(.+?)\*\*/gs;
const CLASS_TOKEN = /`(\.[a-z][a-z0-9-]*)`/gi;
const ONLY_CLASS_TOKENS = /^\s*`\.[a-z][a-z0-9-]*`(?:[\s/,]+`\.[a-z][a-z0-9-]*`)*\s*$/i;

const SIZING_AND_PLACEMENT = new RegExp(
  `^(?:(?:min-|max-)?(?:width|height)|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|grid-(?:column|row|area)` +
    `|(?:align|justify|place)-self|order|position|top|right|bottom|left|inset(?:-[a-z]+)?` +
    `|flex(?:-(?:grow|shrink|basis))?|z-index)$`,
);

const RULE_BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const DECLARED_PROPERTY = /(?:^|;)\s*([a-z-]+)\s*:/g;
const CLASS_ATTRIBUTE = /\bclass\s*=\s*"([^"]*)"/g;
const CLASS_BINDING = /\[class\.([a-z][a-z0-9-]*)\]/gi;

export const SANITY_FLOOR = 6;

export const ALLOWED_UNDECLARED = new Set(['.ng-star-inserted', '.tab-label']);

export const ALLOWED_SCOPED = new Set(['.catalog-detail', '.nav-label', '.tab-link']);

export const KNOWN_FORKS = new Set([
  '.catalog-card',
  '.cover-art',
  '.delete-confirm-actions',
  '.follow-list',
  '.follow-list-entry',
  '.form-actions',
  '.status-card',
]);

const escapeForRegExp = (className) => className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export const rulesTargeting = (css, className) => {
  const mentions = new RegExp(`${escapeForRegExp(className)}(?![a-z0-9-])`, 'i');
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

export const componentsSection = (designDoc) => {
  const start = designDoc.indexOf('\n## Components\n');
  if (start === -1) throw new Error('DESIGN.md has no "## Components" section — the parser found nothing to read.');
  const end = designDoc.indexOf('\n## ', start + 1);
  return designDoc.slice(start, end === -1 ? designDoc.length : end);
};

export const primitivesFromDesignDoc = (designDoc) => {
  const names = new Set();
  for (const [, segment] of componentsSection(designDoc).matchAll(BOLD_SEGMENT)) {
    if (!ONLY_CLASS_TOKENS.test(segment)) continue;
    for (const [, className] of segment.matchAll(CLASS_TOKEN)) names.add(className);
  }
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

export const classesUsedIn = (html) => {
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

export const selectorPartsFor = (css, className) => {
  const escaped = escapeForRegExp(className);
  const mentions = new RegExp(`${escaped}(?![a-z0-9-])`, 'i');
  const subjectCompound = new RegExp(`(^|[ >+~])[^ >+~]*${escaped}(?![a-z0-9-])[^ >+~]*$`, 'i');

  const parts = rulesTargeting(css, className)
    .flatMap(({ selector }) => selector.split(',').map((part) => part.trim()))
    .filter((part) => mentions.test(part));

  return { parts, unscoped: parts.filter((part) => subjectCompound.test(part) && !/[ >+~]/.test(part)) };
};

export function analyze({
  designDoc,
  stylesheets,
  templates,
  sharedStylesheetPath,
  allowedUndeclared = ALLOWED_UNDECLARED,
  allowedScoped = ALLOWED_SCOPED,
  knownForks = KNOWN_FORKS,
}) {
  const primitives = primitivesFromDesignDoc(designDoc);
  const failures = [];
  const allowedScopedSeen = [];
  const knownForksSeen = [];

  for (const className of primitives) {
    let definedInShared = false;

    for (const { path, css } of stylesheets) {
      const rules = rulesTargeting(css, className);
      if (rules.length === 0) continue;

      if (path === sharedStylesheetPath) {
        definedInShared = true;
        continue;
      }

      for (const { selector, properties } of rules) {
        const redefining = properties.filter((property) => !SIZING_AND_PLACEMENT.test(property));
        if (redefining.length > 0) {
          failures.push(
            `${className}: "${selector}" in ${path} restates ${redefining.join(', ')} — ` +
              'a component may size and place a primitive, not redefine it.',
          );
        }
      }
    }

    if (!definedInShared) {
      failures.push(`${className}: named in DESIGN.md Components but not defined in src/styles.css.`);
    }
  }

  const strippedStylesheets = stylesheets.map(({ path, css }) => ({ path, css: withoutComments(css) }));

  const usedClasses = new Map();
  for (const { html } of templates) {
    for (const [className, count] of classesUsedIn(html)) {
      usedClasses.set(className, (usedClasses.get(className) ?? 0) + count);
    }
  }

  for (const [className, usages] of [...usedClasses].sort()) {
    if (allowedUndeclared.has(className)) continue;

    const found = strippedStylesheets.map(({ css }) => selectorPartsFor(css, className));
    const mentioned = found.some(({ parts }) => parts.length > 0);
    const unscoped = found.some(({ unscoped: reaching }) => reaching.length > 0);

    if (!mentioned) {
      failures.push(
        `${className}: used ${usages} time(s) in src/**/*.html and named in no stylesheet selector. ` +
          'Reach for an existing primitive rather than inventing a name beside the vocabulary.',
      );
    } else if (unscoped) {
      continue;
    } else if (allowedScoped.has(className)) {
      allowedScopedSeen.push(`${className} (${usages} usage(s))`);
    } else {
      const selectors = [...new Set(found.flatMap(({ parts }) => parts))].join(', ');
      failures.push(
        `${className}: used ${usages} time(s) in src/**/*.html and reached only under an ancestor ` +
          `(${selectors}) — every usage outside that ancestor renders unstyled. Declare it unscoped, ` +
          'use an existing primitive, or name it in ALLOWED_SCOPED with a reason in AGENTS/Librarian.md.',
      );
    }
  }

  const declaringComponents = new Map();
  for (const { path, css } of strippedStylesheets) {
    if (path === sharedStylesheetPath) continue;
    for (const className of usedClasses.keys()) {
      if (rulesTargeting(css, className).length === 0) continue;
      if (!declaringComponents.has(className)) declaringComponents.set(className, []);
      declaringComponents.get(className).push(path);
    }
  }

  for (const [className, files] of [...declaringComponents].sort()) {
    if (files.length < 2) continue;
    if (knownForks.has(className)) {
      knownForksSeen.push(`${className} (${files.length} files)`);
      continue;
    }
    failures.push(
      `${className}: declared in ${files.length} component stylesheets (${files.join(', ')}) — ` +
        'a shared appearance becomes one primitive in styles.css, not a copy per component.',
    );
  }

  return { primitives, failures, allowedScopedSeen, knownForksSeen, templateClassCount: usedClasses.size };
}
