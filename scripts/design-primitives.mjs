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
const CLASS_ATTRIBUTE = /\bclass\s*=\s*("[^"]*"|'[^']*')/g;
const CLASS_BINDING = /\[class\.([a-z][a-z0-9-]*)\]/gi;
const NG_CLASS_ATTRIBUTE = /\[ngClass\]\s*=\s*("[^"]*"|'[^']*')/g;
const QUOTED_LITERAL = /'([^']*)'|"([^"]*)"/g;
const UNANALYZABLE_CLASS_BINDING = /\[class\]\s*=/;
const CLASS_TOKEN_NAME =
  /^(?:(?:[a-z][a-z0-9-]*|\[[^\]]*\]):)*[a-z][a-z0-9-]*(?:\[[^\]]*\])?$/i;

const THEME_BLOCK = /@theme\s*\{([\s\S]*?)\n\}/;
const THEME_TOKEN = /^\s*(--[a-z0-9-]+)\s*:/gim;

export const SANITY_FLOOR = 6;

export const ALLOWED_UNDECLARED = new Set(['.ng-star-inserted', '.tab-label']);

export const ALLOWED_SCOPED = new Set(['.catalog-detail', '.nav-label', '.tab-link']);

export const KNOWN_FORKS = new Set();

const escapeForRegExp = (className) => className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export const withoutSelectorEscapes = (css) => css.replace(/\\([^a-zA-Z0-9])/g, '$1');

export const themeTokensIn = (css) => {
  const block = THEME_BLOCK.exec(withoutComments(css));
  if (block === null) return [];
  return [...block[1].matchAll(THEME_TOKEN)].map(([, name]) => name);
};

export const BUILD_TIME_THEME_NAMESPACES = [/^--breakpoint-/];

export const unconsumedThemeTokens = ({ themeCss, stylesheets, allowedUnconsumed = new Set() }) => {
  const declared = themeTokensIn(themeCss);
  const body = withoutComments(stylesheets.join('\n'));
  return declared.filter((token) => {
    if (allowedUnconsumed.has(token)) return false;
    if (BUILD_TIME_THEME_NAMESPACES.some((namespace) => namespace.test(token))) return false;
    return !new RegExp(`var\\(\\s*${token}(?![a-z0-9-])`, 'i').test(body);
  });
};

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

const unquoted = (literal) => literal.slice(1, -1);

export const classesUsedIn = (html) => {
  const used = new Map();
  const count = (token) => {
    if (CLASS_TOKEN_NAME.test(token)) used.set(`.${token}`, (used.get(`.${token}`) ?? 0) + 1);
  };

  for (const [, value] of html.matchAll(CLASS_ATTRIBUTE)) {
    for (const token of unquoted(value).split(/\s+/)) count(token);
  }
  for (const [, expression] of html.matchAll(NG_CLASS_ATTRIBUTE)) {
    for (const [, single, double] of unquoted(expression).matchAll(QUOTED_LITERAL)) {
      for (const token of (single ?? double).split(/\s+/)) count(token);
    }
  }
  for (const [, name] of html.matchAll(CLASS_BINDING)) {
    used.set(`.${name}`, (used.get(`.${name}`) ?? 0) + 1);
  }
  return used;
};

export const splitSelectorList = (selector) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const character of selector) {
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts;
};

export const selectorPartsFor = (css, className) => {
  const escaped = escapeForRegExp(className);
  const mentions = new RegExp(`${escaped}(?![a-z0-9-])`, 'i');
  const subjectCompound = new RegExp(`(^|[ >+~])[^ >+~]*${escaped}(?![a-z0-9-])[^ >+~]*$`, 'i');
  const actsAsAncestor = new RegExp(`${escaped}(?![a-z0-9-])[^,]*[ >+~]`, 'i');

  const parts = rulesTargeting(css, className)
    .flatMap(({ selector }) => splitSelectorList(selector).map((part) => part.trim()))
    .filter((part) => mentions.test(part));

  const reaches = (part) =>
    (subjectCompound.test(part) && !/[ >+~]/.test(part)) || actsAsAncestor.test(part);

  return { parts, unscoped: parts.filter(reaches) };
};

export const collectTemplateClasses = (templates) => {
  const usedClasses = new Map();
  const failures = [];

  for (const { path, html } of templates) {
    if (UNANALYZABLE_CLASS_BINDING.test(html)) {
      failures.push(
        `${path}: un-analyzable class binding; use [class.x] or a static class attribute. ` +
          'A whole-attribute [class] expression hides its class names from this check and from the fork check below.',
      );
    }
    for (const [className, count] of classesUsedIn(html)) {
      usedClasses.set(className, (usedClasses.get(className) ?? 0) + count);
    }
  }

  return { usedClasses, failures };
};

const reachabilityFailures = ({ usedClasses, strippedStylesheets, allowedUndeclared, allowedScoped }) => {
  const failures = [];
  const allowedScopedSeen = [];

  for (const [className, usages] of [...usedClasses].sort(([a], [b]) => a.localeCompare(b))) {
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
          'use an existing primitive, or name it in ALLOWED_SCOPED with a reason in AGENTS/REPOS/Librarian.md.',
      );
    }
  }

  return { failures, allowedScopedSeen };
};

export function analyzeUtilities({
  stylesheets,
  templates,
  allowedUndeclared = ALLOWED_UNDECLARED,
  allowedScoped = ALLOWED_SCOPED,
}) {
  const strippedStylesheets = stylesheets.map(({ path, css }) => ({
    path,
    css: withoutSelectorEscapes(withoutComments(css)),
  }));
  const { usedClasses, failures } = collectTemplateClasses(templates);
  const reachability = reachabilityFailures({
    usedClasses,
    strippedStylesheets,
    allowedUndeclared,
    allowedScoped,
  });

  return {
    failures: [...failures, ...reachability.failures],
    allowedScopedSeen: reachability.allowedScopedSeen,
    templateClassCount: usedClasses.size,
  };
}

export function analyze({
  designDoc,
  stylesheets,
  templates,
  sharedStylesheetPath,
  allowedUndeclared = ALLOWED_UNDECLARED,
  allowedScoped = ALLOWED_SCOPED,
  knownForks = KNOWN_FORKS,
  skipReachability = false,
}) {
  const primitives = primitivesFromDesignDoc(designDoc);
  const failures = [];
  const allowedScopedSeen = [];
  const knownForksSeen = [];

  const strippedStylesheets = stylesheets.map(({ path, css }) => ({ path, css: withoutComments(css) }));

  for (const className of primitives) {
    let definedInShared = false;

    for (const { path, css } of strippedStylesheets) {
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

  const { usedClasses, failures: templateFailures } = collectTemplateClasses(templates);
  failures.push(...templateFailures);

  if (!skipReachability) {
    const reachability = reachabilityFailures({
      usedClasses,
      strippedStylesheets,
      allowedUndeclared,
      allowedScoped,
    });
    failures.push(...reachability.failures);
    allowedScopedSeen.push(...reachability.allowedScopedSeen);
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

  for (const [className, files] of [...declaringComponents].sort(([a], [b]) => a.localeCompare(b))) {
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
