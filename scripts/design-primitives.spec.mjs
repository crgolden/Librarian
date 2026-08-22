import { describe, expect, it } from 'vitest';

import { analyze, classesUsedIn, primitivesFromDesignDoc } from './design-primitives.mjs';

const SHARED = 'src/styles.css';

const designDoc = (components = '- **`.card`** — the one surface.\n') =>
  `# DESIGN\n\n## Components\n\n${components}\n## Next\n`;

function run({ components, css = {}, html = {}, ...overrides }) {
  return analyze({
    designDoc: designDoc(components),
    stylesheets: Object.entries(css).map(([path, text]) => ({ path, css: text })),
    templates: Object.entries(html).map(([path, text]) => ({ path, html: text })),
    sharedStylesheetPath: SHARED,
    allowedUndeclared: new Set(),
    allowedScoped: new Set(),
    knownForks: new Set(),
    ...overrides,
  });
}

describe('primitivesFromDesignDoc', () => {
  it('reads a bold lead-in of nothing but class tokens and skips bold prose that mentions one', () => {
    const doc = designDoc('- **`.card` / `.card-accent`** — surfaces.\n- **the `.user-chip`** lives inside the nav.\n');

    expect(primitivesFromDesignDoc(doc)).toEqual(['.card', '.card-accent']);
  });
});

describe('classesUsedIn', () => {
  it('counts a static class attribute and an Angular class binding as the same class', () => {
    const used = classesUsedIn('<div class="card"></div><p [class.card]="on"></p>');

    expect(used.get('.card')).toBe(2);
  });
});

describe('analyze — a primitive must be declared once, in styles.css', () => {
  it('fails a primitive that DESIGN.md names and no shared stylesheet defines', () => {
    const { failures } = run({ css: { [SHARED]: '.other { color: red; }' } });

    expect(failures).toEqual([expect.stringContaining('.card: named in DESIGN.md Components but not defined')]);
  });

  it('fails a component stylesheet that restates a primitive property other than size or placement', () => {
    const { failures } = run({
      css: { [SHARED]: '.card { border-radius: 4px; }', 'src/a/a.component.css': '.card { border-radius: 0; }' },
    });

    expect(failures).toEqual([expect.stringContaining('restates border-radius')]);
  });

  it('allows a component stylesheet to size and place a primitive', () => {
    const { failures } = run({
      css: { [SHARED]: '.card { border-radius: 4px; }', 'src/a/a.component.css': '.card { width: 12rem; }' },
    });

    expect(failures).toEqual([]);
  });
});

describe('analyze — a template class must be reachable from a stylesheet', () => {
  const declaredCard = { [SHARED]: '.card { border-radius: 4px; }' };

  it('fails a class used in a template and named in no selector at all', () => {
    const { failures } = run({ css: declaredCard, html: { 'src/a/a.component.html': '<a class="link-button">x</a>' } });

    expect(failures).toEqual([expect.stringContaining('.link-button: used 1 time(s)')]);
  });

  it('fails a class every declaration of which sits under an ancestor', () => {
    const { failures } = run({
      css: { ...declaredCard, 'src/a/a.component.css': '.detail > .link-button { margin-top: 1rem; }' },
      html: { 'src/a/a.component.html': '<a class="link-button">x</a><a class="link-button">y</a>' },
    });

    expect(failures).toEqual([expect.stringContaining('reached only under an ancestor (.detail > .link-button)')]);
  });

  it('passes the same class once one declaration reaches it unscoped', () => {
    const { failures } = run({
      css: { ...declaredCard, 'src/a/a.component.css': '.detail > .link-button { margin-top: 1rem; }\n.link-button { color: red; }' },
      html: { 'src/a/a.component.html': '<a class="link-button">x</a>' },
    });

    expect(failures).toEqual([]);
  });

  it('reports an allow-listed scoping hook instead of failing it', () => {
    const { failures, allowedScopedSeen } = run({
      css: { ...declaredCard, 'src/a/a.component.css': '.tabbar .tab-link { color: red; }' },
      html: { 'src/a/a.component.html': '<a class="tab-link">x</a>' },
      allowedScoped: new Set(['.tab-link']),
    });

    expect(failures).toEqual([]);
    expect(allowedScopedSeen).toEqual(['.tab-link (1 usage(s))']);
  });

  it('skips an allow-listed undeclared class', () => {
    const { failures } = run({
      css: declaredCard,
      html: { 'src/a/a.component.html': '<span class="tab-label">x</span>' },
      allowedUndeclared: new Set(['.tab-label']),
    });

    expect(failures).toEqual([]);
  });
});

describe('analyze — one appearance, one definition', () => {
  const forked = {
    css: {
      [SHARED]: '.card { border-radius: 4px; }',
      'src/a/a.component.css': '.tile { color: red; }',
      'src/b/b.component.css': '.tile { color: blue; }',
    },
    html: { 'src/a/a.component.html': '<div class="tile"></div>' },
  };

  it('fails a class declared in two component stylesheets', () => {
    const { failures } = run(forked);

    expect(failures).toEqual([
      expect.stringContaining('.tile: declared in 2 component stylesheets (src/a/a.component.css, src/b/b.component.css)'),
    ]);
  });

  it('baselines a known fork instead of failing it', () => {
    const { failures, knownForksSeen } = run({ ...forked, knownForks: new Set(['.tile']) });

    expect(failures).toEqual([]);
    expect(knownForksSeen).toEqual(['.tile (2 files)']);
  });
});
