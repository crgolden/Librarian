import { describe, expect, it } from 'vitest';

import {
  analyze,
  analyzeUtilities,
  classesUsedIn,
  primitivesFromDesignDoc,
  unconsumedThemeTokens,
} from './design-primitives.mjs';

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

  it('counts a single-quoted class attribute', () => {
    const used = classesUsedIn("<div class='card card-accent'></div>");

    expect([...used]).toEqual([
      ['.card', 1],
      ['.card-accent', 1],
    ]);
  });

  it('counts the object keys of an [ngClass] binding, splitting a multi-class key', () => {
    const used = classesUsedIn(`<div [ngClass]="{ 'card': on, 'stat stat-head': off }"></div>`);

    expect([...used]).toEqual([
      ['.card', 1],
      ['.stat', 1],
      ['.stat-head', 1],
    ]);
  });

  it('counts the array elements and both ternary branches of an [ngClass] binding', () => {
    const used = classesUsedIn(`<div [ngClass]="['card', 'stat']"></div><p [ngClass]="on ? 'pager' : 'stamp-label'"></p>`);

    expect([...used]).toEqual([
      ['.card', 1],
      ['.stat', 1],
      ['.pager', 1],
      ['.stamp-label', 1],
    ]);
  });

  it('contributes nothing for an [ngClass] bound to a bare expression rather than literals', () => {
    const used = classesUsedIn('<div [ngClass]="someObject"></div>');

    expect([...used]).toEqual([]);
  });

  it('reads [class.card-accent] as the class name alone, never as the attribute text', () => {
    const used = classesUsedIn('<div [class.card-accent]="on"></div>');

    expect([...used]).toEqual([['.card-accent', 1]]);
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

  it('does not accept a commented-out shared rule as the primitive being defined', () => {
    const { failures } = run({ css: { [SHARED]: '/* .card { border-radius: 4px; } */' } });

    expect(failures).toEqual([expect.stringContaining('.card: named in DESIGN.md Components but not defined')]);
  });

  it('does not read a commented-out component rule as restating a primitive', () => {
    const { failures } = run({
      css: { [SHARED]: '.card { border-radius: 4px; }', 'src/a/a.component.css': '/* .card { border-radius: 0; } */' },
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

  it('fails a whole-attribute [class] binding, which no static parse can resolve', () => {
    const { failures } = run({
      css: declaredCard,
      html: { 'src/a/a.component.html': '<div [class]="computedClasses"></div>' },
    });

    expect(failures).toEqual([
      expect.stringContaining('src/a/a.component.html: un-analyzable class binding; use [class.x] or a static class attribute.'),
    ]);
  });

  it('fails a phantom class reached only through an [ngClass] object key', () => {
    const { failures } = run({
      css: declaredCard,
      html: { 'src/a/a.component.html': `<div [ngClass]="{'phantom-a': on}"></div>` },
    });

    expect(failures).toEqual([expect.stringContaining('.phantom-a: used 1 time(s)')]);
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

  it('fails a fork whose only template usage is an [ngClass] object key', () => {
    const { failures } = run({
      ...forked,
      html: { 'src/a/a.component.html': `<div [ngClass]="{'tile': on}"></div>` },
    });

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

describe('analyze — skipReachability hands pass (b) to the built-CSS check', () => {
  const unreachable = {
    css: { [SHARED]: '.card { border-radius: 4px; }' },
    html: { 'src/a/a.component.html': '<div class="mistyped-utility"></div>' },
  };

  it('reports an unreachable template class by default', () => {
    const { failures } = run(unreachable);

    expect(failures).toEqual([expect.stringContaining('.mistyped-utility: used 1 time(s)')]);
  });

  it('stays silent about reachability when the built-CSS check owns it', () => {
    const { failures } = run({ ...unreachable, skipReachability: true });

    expect(failures).toEqual([]);
  });

  it('still fails an un-analyzable [class] binding, which is not a reachability question', () => {
    const { failures } = run({
      css: { [SHARED]: '.card { border-radius: 4px; }' },
      html: { 'src/a/a.component.html': '<div [class]="whatever"></div>' },
      skipReachability: true,
    });

    expect(failures).toEqual([expect.stringContaining('un-analyzable class binding')]);
  });
});

describe('analyzeUtilities — reachability against the CSS that actually ships', () => {
  const utilities = ({ css, html }) =>
    analyzeUtilities({
      stylesheets: Object.entries(css).map(([path, text]) => ({ path, css: text })),
      templates: Object.entries(html).map(([path, text]) => ({ path, html: text })),
      allowedUndeclared: new Set(),
      allowedScoped: new Set(),
    });

  it('passes a utility the compiler emitted into the built stylesheet', () => {
    const { failures, templateClassCount } = utilities({
      css: { 'dist/browser/styles-abc.css': '.gap-4{gap:1rem}' },
      html: { 'src/a/a.component.html': '<div class="gap-4"></div>' },
    });

    expect(failures).toEqual([]);
    expect(templateClassCount).toBe(1);
  });

  it('fails a mistyped utility, which the compiler drops without a word', () => {
    const { failures } = utilities({
      css: { 'dist/browser/styles-abc.css': '.gap-4{gap:1rem}' },
      html: { 'src/a/a.component.html': '<div class="gap-4 gap-4x"></div>' },
    });

    expect(failures).toEqual([expect.stringContaining('.gap-4x: used 1 time(s)')]);
  });

  it('passes a class whose rule styles its children, because the class itself is on the element', () => {
    const { failures } = utilities({
      css: { 'dist/browser/styles-abc.css': ':where(.space-y-2>:not(:last-child)){margin-top:0.5rem}' },
      html: { 'src/a/a.component.html': '<ul class="space-y-2"></ul>' },
    });

    expect(failures).toEqual([]);
  });

  it('still fails a class that only exists as the SUBJECT of a descendant selector', () => {
    const { failures } = utilities({
      css: { 'dist/browser/styles-abc.css': '.catalog-detail > .link-button{color:red}' },
      html: { 'src/a/a.component.html': '<a class="link-button"></a>' },
    });

    expect(failures).toEqual([expect.stringContaining('.link-button: used 1 time(s)')]);
  });

  it('reads a component stylesheet too, because Angular inlines those into JS rather than into dist CSS', () => {
    const { failures } = utilities({
      css: {
        'dist/browser/styles-abc.css': '.gap-4{gap:1rem}',
        'src/a/a.component.css': '.page-own-arrangement { display: grid; }',
      },
      html: { 'src/a/a.component.html': '<div class="gap-4 page-own-arrangement"></div>' },
    });

    expect(failures).toEqual([]);
  });

  it('sees an arbitrary value through the escapes Tailwind ships it with', () => {
    const { failures, templateClassCount } = utilities({
      css: { 'dist/browser/styles-abc.css': '.max-w-\\[320px\\]{max-width:320px}' },
      html: { 'src/a/a.component.html': '<img class="max-w-[320px]" />' },
    });

    expect(failures).toEqual([]);
    expect(templateClassCount).toBe(1);
  });

  it('keeps a variant as part of the class name, because Tailwind ships it as one class', () => {
    const { failures } = utilities({
      css: { 'dist/browser/styles-abc.css': '@media (min-width:480px){.sm\\:grid-cols-2{grid-template-columns:repeat(2,1fr)}}' },
      html: { 'src/a/a.component.html': '<div class="sm:grid-cols-2"></div>' },
    });

    expect(failures).toEqual([]);
  });

  it('splits a selector list at bracket depth zero, so an arbitrary value keeps its own commas', () => {
    const { failures } = utilities({
      css: {
        'dist/browser/styles-abc.css':
          '.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(220px\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}',
      },
      html: { 'src/a/a.component.html': '<div class="grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"></div>' },
    });

    expect(failures).toEqual([]);
  });

  it('still fails a mistyped ARBITRARY utility, which the compiler drops as silently as a plain one', () => {
    const { failures } = utilities({
      css: { 'dist/browser/styles-abc.css': '.max-w-\\[320px\\]{max-width:320px}' },
      html: { 'src/a/a.component.html': '<img class="max-w-[320pxx]" />' },
    });

    expect(failures).toEqual([expect.stringContaining('.max-w-[320pxx]: used 1 time(s)')]);
  });
});

describe('unconsumedThemeTokens — a token that resolves is not a token that is used', () => {
  const theme = (body) => `@theme {\n${body}\n}`;

  it('fails a token nothing references, which is how --container-prose shipped wrong', () => {
    const unconsumed = unconsumedThemeTokens({
      themeCss: theme('  --container-prose: 720px;\n  --container-data: 960px;'),
      stylesheets: ['.max-w-prose{max-width:65ch}.max-w-data{max-width:var(--container-data)}'],
    });

    expect(unconsumed).toEqual(['--container-prose']);
  });

  it('accepts a token a component stylesheet consumes, since Angular inlines those out of dist CSS', () => {
    const unconsumed = unconsumedThemeTokens({
      themeCss: theme('  --rail-width: 15rem;'),
      stylesheets: ['.unrelated{color:red}', '.site-nav-rail { width: var(--rail-width); }'],
    });

    expect(unconsumed).toEqual([]);
  });

  it('exempts --breakpoint-*, which Tailwind resolves into an @media condition rather than a var()', () => {
    const unconsumed = unconsumedThemeTokens({
      themeCss: theme('  --breakpoint-sm: 480px;'),
      stylesheets: ['@media (min-width:480px){.sm\\:flex{display:flex}}'],
    });

    expect(unconsumed).toEqual([]);
  });

  it('does not exempt --container-*, the family the gate exists to police', () => {
    const unconsumed = unconsumedThemeTokens({
      themeCss: theme('  --container-narrow: 480px;'),
      stylesheets: ['.unrelated{color:red}'],
    });

    expect(unconsumed).toEqual(['--container-narrow']);
  });
});
