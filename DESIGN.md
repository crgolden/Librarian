---
version: alpha
name: Librarian
description: A reading light over a large, dark collection. Dark-first OKLCH, one accent, an instrument-panel type pairing.
colors:
  canvas: "oklch(0.18 0.012 265)"
  surface: "oklch(0.22 0.014 265)"
  surface2: "oklch(0.26 0.016 265)"
  line: "oklch(0.32 0.016 265)"
  lineStrong: "oklch(0.56 0.02 265)"
  text: "oklch(0.95 0.005 265)"
  textMuted: "oklch(0.72 0.012 265)"
  accent: "oklch(0.72 0.17 155)"
  accentHover: "oklch(0.8 0.15 155)"
  onFill: "oklch(0.18 0.012 265)"
  danger: "oklch(0.65 0.19 25)"
  dangerHover: "oklch(0.73 0.17 25)"
  warn: "oklch(0.78 0.15 75)"
  ok: "oklch(0.72 0.17 155)"
  psn: "oklch(0.62 0.15 265)"
  focus: "oklch(0.85 0.12 155)"
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.25
  h2:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.25
  h3:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.25
  h4:
    fontFamily: Space Grotesk
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  catalogTitle:
    fontFamily: Space Grotesk
    fontWeight: 600
  catalogMeta:
    fontFamily: JetBrains Mono
    fontSize: 0.85rem
  stampLabel:
    fontFamily: JetBrains Mono
    fontSize: 0.8rem
    fontWeight: 400
    letterSpacing: 0.06em
  spineLabel:
    fontFamily: Inter
    fontSize: 0.7rem
    fontWeight: 600
    letterSpacing: 0.06em
rounded:
  sm: 4px
  md: 6px
  lg: 12px
spacing:
  unit: 0.25rem
components:
  - crgCard
  - crgCardAccent
  - crgButtonPrimary
  - crgButtonPrimarySmall
  - crgButtonSecondary
  - crgButtonGhost
  - crgButtonGhostSmall
  - crgButtonGhostDanger
  - crgButtonGhostDangerSmall
  - crgButtonDanger
  - crgPageContainer
  - crgPageSection
  - appCatalogTitle
  - appCatalogMeta
  - appSpineLabel
  - appStampLabel
---

# Design Language

## Overview

**A reading light over a large, dark collection.**

Librarian is an instrument for scanning a big collection, not a storefront and not a document. Three
consequences follow, and every decision below is one of them:

1. **Dark is the base, not the alternate.** The content *is* the light. A grid of saturated 1:1 cover
   tiles reads as a shelf against near-black and as noise against parchment: the ground has to recede
   so the art can be the brightest thing on screen. Light is a re-binding of the same tokens under
   `@media (prefers-color-scheme: light)`, not a second design.
2. **One accent, because in a scanning tool color is a pointer.** A palette with four decorative hues
   has no way left to say *look here*. Librarian spends its chroma on exactly one accent and keeps every
   surface within `0.02` chroma of neutral. Success is not a second green; it is the accent, and it is
   distinguished by *shape* (inline text with a check glyph) rather than by hue.

   **The accent is green (hue 155) because `--color-ok` is an alias of the accent.** This palette has no
   second hue for success, so success *is* the accent, and green is the only candidate where that reads
   naturally: "success is violet" fights a convention every visitor arrives with, and the alias would have
   to become a real second hue, which is the thing rule 2 exists to prevent. Contrast does not decide it:
   at the shipped `L`/`C`, hues 155, 225, 300 and 330 all clear every bar in both schemes, 195 fails the
   light text bar at 4.31:1, and 25, 75 and 265 are excluded because they collide with `--color-danger`,
   `--color-warn` and `--color-psn`; a single accent indistinguishable from a status color would be
   worse than any aesthetic objection. **The light accent's headroom is the thing to watch: 4.57:1 against
   a 4.5 bar, 1.6% spare**, the tightest text pair in the palette, so any lightening of `--color-accent`
   in the light scheme fails `src/styles.contrast.schemes.browser.spec.ts`, by design.
3. **Space Grotesk, because these are labels on an instrument panel.** Headings are controls and
   section markers, not prose. Body copy is Inter; anything the eye compares column-wise (counts,
   percentages, dates, ids) is JetBrains Mono, so digits align.

The palette is expressed in **OKLCH**, and that is load-bearing rather than fashionable: lightness in
OKLCH is perceptually uniform, so `0.22` and `0.26` are a predictable step apart on every hue, and that
predictability is what makes the three-surface ladder in Elevation work without a shadow. It also makes
a bad value visible as a number: a surface token with chroma above `0.02` is wrong on sight.

**Theme switching stays `prefers-color-scheme` only.** No JS toggle, and none should be added (see
Do's and Don'ts).

**There is no site footer, and one should not be added.** A footer nav would duplicate the rail (Home,
Catalog, FAQ and Privacy are all in the rail, and in the More sheet on mobile), and it cannot be
centered: the footer would sit inside the app body, the flex sibling of the rail, so its
`crgPageContainer` centers against the viewport **minus** the rail and reads as skewed right on every
desktop width, the same class of bug as the header brand, which is fixed by un-capping. The mobile-app
idiom the brief asked for has a tab bar, not a footer, and Privacy is reachable from the rail and the
sheet. **Provider attribution is the obvious reason to want one, and it is not a good enough one**:
RAWG's terms ask for a hyperlink on the pages that render their data, which is three of them, not all of
them, and only when those three are showing it; `app-rawg-attribution` puts the line exactly there (see
Components). A footer would attribute RAWG on `/privacy`, which renders none of their data and makes
claims about provenance for a living.

**`html` declares the CSS `color-scheme: dark light` property in `@layer base`, and it is not the same
thing as the media query.** `prefers-color-scheme` tells *this stylesheet* what the user prefers;
`color-scheme` tells *the browser* what this document supports, and the order lists dark first so dark is
what a user with no preference gets. Without it the UA paints its own chrome (scrollbars, form controls,
the canvas behind the page) from the OS light theme, which on Windows means bright scrollbars with
stepper arrows against a near-black UI. **No token, contrast or layout assertion can see that**, because
none of it is the page's own CSS; `src/styles.theme.browser.spec.ts` asserts the declared property directly.

## Colors

Dark is the base and lives in Tailwind's `@theme`. Light re-binds the *same* token names in a plain
`:root` rule inside the media query: plain, not `@theme inline`, because `@theme inline` bakes the value
into every utility and the re-binding would then do nothing.

| Token | Dark (base) | Light |
|---|---|---|
| `--color-canvas` | `oklch(0.18 0.012 265)` | `oklch(0.97 0.004 265)` |
| `--color-surface` | `oklch(0.22 0.014 265)` | `oklch(1 0 0)` |
| `--color-surface-2` | `oklch(0.26 0.016 265)` | `oklch(0.945 0.006 265)` |
| `--color-line` | `oklch(0.32 0.016 265)` | `oklch(0.89 0.008 265)` |
| `--color-line-strong` | `oklch(0.56 0.02 265)` | `oklch(0.58 0.014 265)` |
| `--color-text` | `oklch(0.95 0.005 265)` | `oklch(0.24 0.012 265)` |
| `--color-text-muted` | `oklch(0.72 0.012 265)` | `oklch(0.48 0.014 265)` |
| `--color-accent` | `oklch(0.72 0.17 155)` | `oklch(0.52 0.15 155)` |
| `--color-accent-hover` | `oklch(0.8 0.15 155)` | `oklch(0.44 0.14 155)` |
| `--color-on-fill` | `oklch(0.18 0.012 265)` | `oklch(0.99 0.002 265)` |
| `--color-danger` | `oklch(0.65 0.19 25)` | `oklch(0.52 0.2 25)` |
| `--color-danger-hover` | `oklch(0.73 0.17 25)` | `oklch(0.44 0.19 25)` |
| `--color-warn` | `oklch(0.78 0.15 75)` | `oklch(0.55 0.13 75)` |
| `--color-ok` | = accent | = accent |
| `--color-psn` | `oklch(0.62 0.15 265)` | `oklch(0.48 0.16 265)` |
| `--color-focus` | `oklch(0.85 0.12 155)` | `oklch(0.44 0.14 155)` |

**Usage rules:**

- **Chroma above `0.02` on a surface, line or text token is a defect.** The ground is a near-neutral at
  hue 265; the accent is the only place chroma is spent. This is checkable by reading the number, which
  is the point of expressing the palette in OKLCH rather than hex.
- **`--color-accent` at `0.17` chroma, not `0.19`.** `oklch(0.72 0.19 155)` is outside the sRGB gamut
  (its linear-red component is negative), so a browser silently gamut-maps it, and every contrast ratio
  computed from the token then describes a color that is not the one rendered. A token you cannot
  measure is worse than a duller one.
- **Ink on a fill is `--color-on-fill`, never `#fff` and never assumed.** White fails on all three dark
  fills. The direction is not automatic and does not follow the scheme: on the dark scheme's accent,
  near-white measures 5.00:1 while dark ink measures 3.60:1 and fails AA. Measure before inverting.
- **Every `*-hover` lightens in dark and darkens in light**, because hover must move *away* from the
  on-fill ink and the ink sits at opposite ends in the two schemes. A name like `accent-hi` encodes a
  direction that is only true in one of them. This applies to `--color-danger-hover` exactly as it does
  to `--color-accent-hover`; both are measured on their fills by the contrast spec, because a hover fill
  carries ink too and is easy to forget.
- **`--color-line` is a divider; `--color-line-strong` is a control outline.** `line` on `surface` is
  fine between rows and a WCAG 1.4.11 failure the moment it becomes the edge of an input. Anything a user
  can operate uses `line-strong`. **`line-strong` is the tightest token in the palette against both
  raised surfaces**: do not darken it in dark or lighten it in light without re-running
  `src/styles.contrast.schemes.browser.spec.ts`.
- **Focus rings carry `outline-offset: 2px`, mandatory.** `focus` directly on an `accent` fill is
  1.32:1; offset onto the page background it is 10.94:1. The offset is the contrast.
- **`--color-ok` is an alias of the accent.** Success is distinguished by *shape* (inline text with a
  check glyph), never by a second green surface.
- **`--color-psn` marks a linked PlayStation account.** It is descriptive, not restrictive.

### The failure mode this palette has: a token that still resolves

**A palette defect here takes one shape: a `var()` that still resolves, so nothing fails, while the
thing it expresses quietly stops being true.** Review rarely sees it; a test measuring the value, a
control run, or someone asking why something looks wrong does. The shape is not specific to color:

| Shape | What it means | Why nothing fails |
|---|---|---|
| a card's top rule reading an alias of the accent token | a neutral card edge, with the accent card as the marked variant | the alias resolves to the accent, so **both cards render identically** and the variant stops meaning anything; every token lives once in `@theme` so no alias can do this |
| a hover token aliased to its base, `--x-hover: var(--x)` | a hover that moves away from the ink | it resolves to the base color, so **the button has no hover at all** |
| `--color-line-strong` at `L 0.48` | a control edge clearing 3:1 | it resolves and looks plausible; it measures **2.38:1** |
| `a { text-decoration: none }` | links distinguished by the accent | the accent resolves; links in prose are **color-only**, failing WCAG 1.4.1 |
| `--color-focus` declared, and no `:focus-visible` rule anywhere | every control ringed in the focus token at a 2px offset | the token resolves, and `src/styles.contrast.schemes.browser.spec.ts` **measures it passing** while nothing applies it, so every control falls back to the browser's default ring |
| `--container-prose` in `@theme`, spelled `max-w-prose` | a 720px reading measure | `max-w-prose` is a Tailwind **built-in** pinned to `65ch`; the token is emitted and greppable while the utility ignores it, so the measure is 656px and font-dependent |

Three rules follow, and they are the whole defense:

1. **An alias must point at something that differs.** If `--x-hover` resolves to the same value as `--x`,
   the state it names does not exist. Aliasing a legacy name into a new palette is where this creeps in,
   because the compiler is perfectly happy.
2. **If a token expresses a *relationship* (a hover that must differ, an edge that must clear a ratio,
   a variant that must be distinguishable), the relationship gets a test.** `src/styles.contrast.schemes.browser.spec.ts`
   measures the hover fills as well as the resting ones for that reason.
3. **A contrast spec proves a pair is legible. It cannot prove the pair is used.** `--color-focus` on
   `--color-canvas` measures green whether or not any element is ringed in it. A token needs a test that
   the *rule* exists, separately from the test that its colors work, and the focus-ring tests in
   `src/app/app-shell.layout.browser.spec.ts` are that test. It asserts `outline-style: solid`, because Chromium's fallback ring is `auto`, and
   `auto` ignores `outline-color` entirely: asserting the color alone would pass against the browser
   default.

   **The suite discriminates.** Removing the `:focus-visible` rule at runtime and re-reading the same
   three selectors moves every one of them from `solid/2px/2px` to **`auto/1px/1px`**, so all three
   assertions (style, width, offset) fail without the rule, on every selector. The fallback offset is
   `1px`, not `0`.

**The spec, not this file, is the authority on every ratio.** `src/styles.contrast.schemes.browser.spec.ts` resolves each token
through a 1×1 canvas in **both** schemes and checks each pair against its WCAG bar: 4.5:1 for text, 3:1
for a control edge or icon under 1.4.11. A figure written here is a claim that rots; the spec is a
measurement that cannot. The table above is the palette; the spec is the proof.

The canvas is pre-set to a magenta sentinel before every fill, because **Canvas2D ignores an invalid
color silently**: without the sentinel a token that failed to parse would inherit the previous pixel
and quietly pass.

## Typography

| Level | Font | Size | Weight | Line height | Use |
|---|---|---|---|---|---|
| h1 | Space Grotesk | 2.25rem | 700 | 1.25 | Page titles |
| h2 | Space Grotesk | 1.5rem | 700 | 1.25 | Section headings |
| h3 | Space Grotesk | 1.25rem | 700 | 1.25 | Card/subsection headings |
| h4 | Space Grotesk | 1.125rem | 700 | 1.25 | Minor headings |
| body | Inter | 1rem | 400 | 1.6 | Everything else |
| `appCatalogTitle` | Space Grotesk | inherit | 600, italic | inherit | Game titles |
| `appCatalogMeta` | JetBrains Mono | 0.85rem | 400 | inherit | Metadata: dates, PSN ids, ratings, completion % |
| `appStampLabel` | JetBrains Mono | 0.8rem | 400, uppercase, `letter-spacing: 0.06em` | inherit | Captions: a heading over a block, a state on a record |
| `appSpineLabel` | Inter | 0.7rem | 600, uppercase, `letter-spacing: 0.06em` | inherit | Genre/platform classification tags |

**Anything the eye compares down a column is monospace, and that is the whole rule.** Counts,
percentages, dates, ids and scores are set in JetBrains Mono so their digits align between rows; prose is
Inter; headings are Space Grotesk because they label controls rather than open paragraphs. All three are
**variable** faces from the `@fontsource-variable/*` packages, imported by `styles.css` and bundled with
the app, so no request leaves for a font host and no `@font-face` is authored here. Fontsource registers
each family with a ` Variable` suffix, so the tokens name `'Inter Variable'`.

```css
--font-heading: 'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif;
--font-body: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;

--text-display: 2.25rem;
--text-section: 1.5rem;
--text-subsection: 1.25rem;
--text-minor: 1.125rem;
--text-body: 1rem;
--text-meta: 0.85rem;
--text-small: 0.8rem;
--text-label: 0.7rem;
--text-inline-code: 0.9em;

--tracking-label: 0.06em;
```

The sizes are named by role, not by value, and each is a Tailwind utility (`text-meta`, `text-label`).
Weights are Tailwind's own `font-normal` through `font-bold`, which this `@theme` does not redefine.
**Every `font-size`, `font-weight`, `letter-spacing` and `font-family` in `styles.css` reads a token,
enforced by `npm run lint:css`**, and a size between two steps is rounded to the nearer step rather than
added as a ninth: two sizes 0.8px apart at a 16px root are a difference nobody can see and everybody has
to maintain.

`--text-inline-code` is deliberately the one relative value. Inline `<code>` should track whatever
text surrounds it, so a snippet inside an `h3` stays proportional to that heading; pinning it to a `rem`
step would shrink it there. A token that resolves differently by context is correct here and nowhere
else in the scale.

- **Headings and game titles**: `Space Grotesk`. Its tight apertures and near-mechanical forms read as
  labeling rather than prose, which is what a heading does in a scanning tool. Game titles take the same
  face at 600 rather than a separate treatment: the title is the primary thing on a card, so it needs
  weight, not decoration.
- **Body**: `Inter`. A quiet reading face that does not compete with the headings for attention.
- **Metadata and numbers**: `JetBrains Mono` for anything compared down a column: acquisition dates, PSN
  account identifiers, completion percentages, platform codes, ratings. Alignment is the point: a
  proportional face makes `98%` and `100%` different widths and the eye has to re-find the decimal on
  every row. Lives in `appCatalogMeta`, and in the Library table's rating columns.
- **Classification labels**: a small-caps, letter-spaced treatment (`appSpineLabel`) for genre and
  platform tags: uppercase, `letter-spacing: 0.06em`, small size, `Inter` at 600, not a filled pill.
  A filled badge would spend color, and color is reserved for the accent.
- **Captions**: `appStampLabel` is the same small-caps idea in the *metadata* family: monospace, without
  the spine's bottom rule. It labels a thing rather than classifying it: the "On this page" heading over
  a table of contents, or a `private`/`shared` state on a collection. Reach for `appSpineLabel` when the
  text says what a work *is*, and `appStampLabel` when it says what a block *is called* or *is currently*.

## Layout

```css
--container-narrow: 480px;       /* max-w-narrow */
--container-reading: 720px;      /* max-w-reading */
--container-data: 960px;         /* max-w-data */

--rail-width: 15rem;             /* the desktop rail's width */
--tabbar-height: 3.75rem;        /* the mobile bottom tab bar's height */
--header-height: 3.5rem;         /* the slim brand bar above both */
--container-page: 1100px;        /* crgPageContainer's measure */
--card-rule: 3px;                /* crgCard's top rule */
```

**Spacing is Tailwind's own scale** (`--spacing`, 0.25rem a step): `p-6` is a card's inner padding,
`gap-2/3/4` the in-component gaps, and `--spacing(N)` the same step inside an arbitrary value.

**The rail and the tab bar are sized by separate tokens**, `--rail-width` (a width) and
`--tabbar-height` (a height), and the tab bar adds `env(safe-area-inset-bottom)` to both its own height
and `main`'s bottom padding, so it never sits under an iOS home indicator.

**Anything fixed to the bottom edge on mobile clears the bar *and* the inset, in three places.** The tab
bar's own height, `main`'s padding, and `app-page-toc`'s back-to-top button, whose offset is
`calc(var(--tabbar-height)_+_env(safe-area-inset-bottom)_+_--spacing(4))`. A fourth bottom-anchored
element needs the same treatment, and no test emulates a safe area.

- **Grid model**: a centered outer column (`crgPageContainer`: `max-w-page`, `mx-auto`, horizontal
  padding `px-6`, `px-4` below the `sm` breakpoint), not a multi-column app-shell grid. Catalog uses a
  responsive card grid within that column (`grid-cols-[repeat(auto-fit,minmax(220px,1fr))]`); Library's
  table becomes a stacked card list on narrow viewports (see Components).
- **Measure**: `1100px` is the *shell*, not the reading measure. Each page sets its own inner
  `max-width` sized to its content, and **every one of them must also center itself** (`mx-auto`): an
  inner column narrower than the shell that does not center leaves the page visibly weighted to the left
  on wide viewports. The three permitted measures:

  | Token | Value | Used by | Why |
  |---|---|---|---|
  | `max-w-narrow` | `480px` | `/account`, `/profile/settings`, `/profile/followers`, `/profile/following`, and the `/u/:sub` equivalents | Form and settings pages, and single-column lists: one column of labeled controls or rows |
  | `max-w-reading` | `720px` | `/faq`, `/privacy`, 404, the two `collections` explainer cards | Long-form reading text |
  | `max-w-data` | `960px` | `/library`, `/profile`, `/u/:sub` | The data table, and the profile's stat grid: both need four columns to read as a grid rather than a list |

  **Each is a `--container-*` theme token, so `max-w-data` is the only spelling** and an arbitrary
  `max-w-[60rem]` stands out in review. `/profile` and `/library` share the data measure, and
  `src/library/library.layout.browser.spec.ts` and `src/profile/profile-view.layout.browser.spec.ts` each
  assert the page's width equals the resolved `--container-data` token rather than a literal, so changing
  the token moves both and the tests still mean something.

  **The reading measure is `max-w-reading`, not `max-w-prose`, and the name is load-bearing.**
  `max-w-prose` is a Tailwind **built-in static utility pinned to `65ch`**, and a `--container-prose`
  theme variable does *not* override it: both declarations land in the same emitted rule and the
  built-in comes last, so it wins:

  ```css
  max-w-prose{max-width:var(--container-prose);max-width:65ch}   /* the token loses */
  ```

  A token named `prose` therefore renders a 656px measure instead of 720px while staying declared,
  emitted and greppable: the palette's characteristic defect (a token that still resolves) in the layout
  scale. `65ch` is also a **font-dependent** measure where every other measure here is `px`. A built-in
  static utility cannot be removed, so the token name is the only fix. **Do not name it `prose`.**

  **`max-w-data` is `960px` by arithmetic rather than taste.** At `xl` (1280px) the content column is
  `1280 − 240 (rail) − 48 (padding) = 992px`, so a 1000px measure clips. 960px fits with 32px spare and
  the four-column stat grid still lands (`4×200 + 3×16 = 848`).

  Add a fourth measure only for a need none of these three covers.
- **Breakpoints are `@theme` tokens: `sm: 480px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.** Tailwind
  resolves `--breakpoint-*` at build time, so in a template `lg:` *is* the token and there is no pixel
  value to typo. `sm` is **480px deliberately**, overriding Tailwind's 640px default, because this app's
  `sm` marks the point where `crgPageContainer` padding tightens on a large phone. No component has a
  stylesheet to hand-write an `@media` condition in, so a breakpoint only ever appears as a variant;
  `styles.css` is the one file that writes pixel values, and it takes them from this list. The nav switch
  point is **`lg` (1024px)**, not `md`: Playwright's default `Desktop Chrome` viewport is 1280×720, so
  putting the switch at `xl` would sit every unviewported test exactly on the boundary.
- Keep paddings and margins on Tailwind's spacing steps for a cohesive rhythm; don't introduce one-off
  pixel values for spacing that already has a step close enough.

## Elevation & Depth

**On a near-black canvas a drop shadow is a no-op, so depth is carried by lightness and an edge instead.**
`--color-canvas` sits at `L 0.18`; a shadow cast onto it has almost nothing left to darken, and a shadow
scale built for a light ground does not survive the inversion.

Depth is therefore **three surface levels plus a mandatory hairline**:

| Token | Role |
|---|---|
| `--color-canvas` | the page itself |
| `--color-surface` | a raised plane: cards, the rail, the tab bar |
| `--color-surface-2` | a plane raised above *that*: hover states, recessed wells, the sheet |

The steps are deliberately small (roughly 1.10:1 and 1.15:1 against each other), because a surface
ladder that reads as *contrast* starts competing with the content for attention. Lightness alone is not
enough to say where a plane stops, so **every raised surface also carries `1px solid var(--color-line)`**.
Lightness says "different plane"; the hairline says "this is where it ends".

`--shadow-overlay` is the one shadow that expresses depth, and it exists for the More sheet alone:
something that genuinely floats over the page rather than sitting in it. The other shadow tokens are not
depth: `--shadow-focus` is the text inputs' focus halo, `--shadow-card` is transparent so the shared
`crgCard` casts nothing here, and `--shadow-sm` is the small lift on each Library row's stacked card below `md`.

- No glow, no colored shadows, no blur-heavy "neumorphic" effects.
- **A z-index ladder, stated as tokens and enforced, never a literal:**

  ```css
  --z-header: 10;
  --z-back-to-top: 15;
  --z-tabbar: 20;
  --z-loading-overlay: 1100;
  ```

  **`stylelint` rejects any `z-index` in `styles.css` that is not `var(--z-*)`** (bare `auto` and `0`
  aside), and `lint:utilities` rejects a template `z-*` utility that does not read a `--z-*` token,
  because a ladder documented in prose is a ladder nobody has to obey: a rung added elsewhere joins at a
  number nobody chose, and a collision only shows when two of them happen to overlap, which is exactly
  the defect that survives review. **Adding a rung means adding a token here first.**

  A modal `<dialog>` renders in the browser's *top layer*, above every z-index, so the sheet needs no rung
  at all. The loading overlay is **not** in the top layer, and it sits above the sheet on purpose: its
  whole job is to swallow input during an in-flight request, and a sheet drawn over it would accept taps
  it must not.

## Shapes

```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 12px;
```

- **Radius stays small and restrained.** A heavily rounded UI reads as a friendly consumer app; this is
  an instrument for scanning a collection, and its edges should be quiet. `--radius-lg` exists for exactly
  one thing: the top corners of the More sheet, where the curve reads as "this slid up over the page".
- **A card is defined by its edge, not by a shadow.** `crgCard` is `--color-surface` with the mandatory
  hairline and a `--card-rule` (3px) **neutral** top border; `crgCardAccent` recolors that border to
  `--color-accent` to mark an entry that deserves attention. That accent border is one of the few places
  chroma is spent, so it has to mean something.
  **The 3px lives on `crgCard`, not on `crgCardAccent`, deliberately**: moving it to the variant would
  make an accented card 2px taller than its neighbors in a grid. The variant changes color only, and the
  neutral rule must read a neutral token: if it read an alias of the accent, both directives would render
  identically and the variant would stop meaning anything, with nothing failing.
- **Cover art is the only saturated thing on the page, by design.** Every surface stays within `0.02`
  chroma of neutral precisely so a grid of 1:1 box art reads as the content and the chrome recedes.

## Components

The shared primitives are directives from `@crgolden/modules/primitives` whose host carries a literal
utility list; this app's `@theme` supplies the tokens they name. The app's own typography primitives are
directives in `src/shared/primitives/typography.ts`. Everything else below is a utility list written
where it is used.

- **`crgPageSection`**: the standard vertical rhythm between a page's top-level blocks (`pt-8 pb-12`).
- **Form actions** (`flex gap-3`): the trailing row of buttons on a form.
- **`crgCard` / `crgCardAccent`**: the base surface primitive (see Shapes): `--card-rule` sets this
  app's 3px top rule and `--shadow-card` is transparent. Used by every status card, the Catalog grid
  item, and the Library page's mobile card-per-row layout. A card whose accent is conditional is
  `crgCard` plus `[class.border-t-accent]`.
- **`crgButtonPrimary`**: solid `--color-accent` fill, `--color-on-fill` ink, `--radius-sm`. The default
  action button. **Never `#fff` for the ink** (see Colors).
- **`crgButtonSecondary`**: accent outline and accent text on a transparent fill, for an action that
  sits beside a primary without competing with it.
- **`crgButtonGhost`**: transparent fill, `--color-line-strong` outline, `--color-text-muted` text.
  Secondary actions. **`crgButtonGhostDanger`**: the same shape with `--color-danger` text and border, for
  destructive actions (unfollow, remove a key, delete). The outline takes `line-strong`, not `line`,
  because it is the edge of a control and `line` fails WCAG 1.4.11 there.
- **`crgButtonDanger`**: solid `--color-danger` fill with `--color-on-fill` ink, for the *confirm* step
  of a destructive action only; the button that opens the confirmation is `crgButtonGhostDanger`. Every
  variant is its own directive and two never share an element: stacked, danger-colored text lands on the
  accent fill at a contrast far below 4.5:1.
- **`…Small` variants** (`crgButtonPrimarySmall`, `crgButtonGhostSmall`, `crgButtonGhostDangerSmall`):
  the smaller padding and `--text-small` size, as separate directives rather than a modifier. Every
  button variant dims and shows a not-allowed cursor when disabled.
- **A group of three or more peer buttons is a grid, never `flex flex-wrap`.** Buttons are content-sized
  and `white-space: nowrap`, so a wrapping flex row spaces them by label length: the gaps are uniform
  while the buttons are not, which reads as arbitrary rhythm, and the last one drops to a row of its own
  as soon as the labels outgrow the measure (three buttons, then a lone fourth). Use
  `grid grid-cols-1 sm:grid-cols-2 gap-3 w-full`: grid tracks are equal by construction, both button
  directives are `justify-center` so they center inside a stretched track, and four actions fall
  into two rows of two with no orphan. **`w-full` is load-bearing**: these cards are
  `flex flex-col items-start`, so without it the grid shrink-wraps and the tracks are unequal again.
  `src/home/home.layout.browser.spec.ts` asserts one distinct width and exactly two rows.

  **In such a group the first action is the primary one, and that is the only thing order encodes.**
  Home renders its four actions from a single array and marks `$first` as the primary button, so promoting
  an action is a reordering rather than a second class list to keep in sync, the same "one array,
  rendered" shape the nav uses. While no PSN account is linked, the card says nothing has been catalogued,
  and a primary pointing at **My Library** would send the reader to a page that is empty precisely because
  of what the card just said, so **Manage PSN Link** leads until `linked` is true. The promotion tests
  `linked === false` explicitly, not falsiness: `linked` is `boolean | null`, and `null` means the `/me`
  call degraded, where offering the link step would push PSN linking at someone who is already linked.
  `home.component.spec.ts` pins all three states and that exactly one action is primary.
- **Form inputs** (`input[type=text|email|password|number|search]`, `select`, `textarea`): flat fill,
  `--color-line-strong` outline, `--radius-sm`, an accent border and `--shadow-focus` halo on focus, and
  the global `--color-focus` ring with **`outline-offset: 2px`** on keyboard focus. The defaults are
  type-selector rules in `@layer base`, so a new input `type` must be added to that selector list or it
  renders unstyled next to its neighbors.
- **`appSpineLabel`**: genre and platform classification tag (see Typography).
- **`appStampLabel`**: typed caption in the metadata family (see Typography), on the `app-page-toc`
  heading and the Collections visibility state.
- **Size source** (utilities keyed on `data-size-source`): the provenance tag on a packed size, naming
  which rung produced the `size_gb` it sits beside. Curator's ladder has five rungs and they group into
  three treatments. `measured` and `download` take `--color-ok`: one is a figure somebody measured, the
  other is Sony's own, and both are facts. `estimated` and `capped_default` take `--color-warn`: a band
  and a platform media ceiling are both derivations, and a reader deciding whether a fill will fit needs
  to see that. The bare `default` rung takes the base `text-text-muted` with no `data-size-source` variant
  of its own, and **that base is the load-bearing part**. Curator seeds estimate bands for PS5 and PS4
  only, so a great many PS3, Vita, PSP, PS2 and PS1 titles fall to the unmeasured rung: it is a common
  case, not an edge one, and painting it `--color-danger` would render much of a catalog as broken. It is
  ordinary metadata: the rungs that carry information are marked, and the absence of information is
  simply not. Labels read `measured`, `download size`, `estimated`, `media ceiling` and `not measured`
  rather than the raw wire values, and the rung is mirrored onto a `data-size-source` attribute, which is
  what the color variants select on (`data-[size-source=measured]:text-ok` and so on). **A new rung on
  the wire needs an entry in `SIZE_SOURCE_LABELS` or the label renders `undefined`**, and only the bare
  `default` rung counts toward the "contribute a real size" prompt.
- **`appCatalogTitle` / `appCatalogMeta`**: game title and stamped-metadata treatments (see
  Typography), on the Catalog grid, Collections list, and Library table.
- **Catalog list** (`m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-0`): a
  list of catalogued entries as a responsive card grid, used by the Catalog grid, the Collections detail
  list and the public shared-collection view.
- **Cover art** (`block aspect-square rounded-sm object-cover`, plus the surface's own width): box art
  on a catalogued entry, used by the Catalog grid, the game detail page, the Collections detail list,
  the Library table, and the public shared-collection view. Every surface uses the same square treatment
  and sets only its width. It sits *beside* the catalog title rather than replacing it: the title is
  the catalog entry, the cover is provenance, so a row with no artwork must still read as a complete
  entry rather than a gap. Nothing stands in for a missing cover: no placeholder box, no silhouette,
  no "no image" label. The absence is not an error state and must not be dressed as one. The Library
  table's stacked layout below `md` keeps that relationship: its row is a two-column grid with the
  cover in the first column and the title beside it, and the cover cell carries no `data-label`
  because it is provenance rather than a captioned field.
- **Library table column priority.** The `max-w-data` card is 960 wide, so from 960 up the table's scroll
  container is 910 and a wider viewport buys the table nothing; between `md` and 960 the card is
  viewport-bound and narrower, so no band above `md` fits more columns than 910 does, and nine columns
  at their widest do not fit it with the Cover column shown. Three decisions close that, in priority
  order, and `src/library/library.layout.browser.spec.ts` asserts the fit with every column at its widest at the `xl` measure;
  the band between `md` and 960 relies on the fallback named at the end of this entry. A control never
  widens a column past its label: the `% Completed` header's "Turn on trophies" link is `block` and
  `whitespace-normal`, so it wraps inside the column instead of setting its width. The Cover column
  yields wherever the table layout renders (`md:hidden` on its cell and header), because it is
  provenance rather than data and the stacked layout below `md` keeps it as the row's first cell. And the
  cells take the tighter `p-2` padding step unconditionally, with the stacked layout below `md` as
  `max-md:` utilities on the same cells. Horizontal scroll is the fallback below that, which WCAG 1.4.10
  permits for a data table, never the design. The row controls (Hide, Show again, Remove) take a row of
  their own under a `block` title so a short and a long title lay out alike, and a control inside the
  `items-stretch` table card opts out with `self-start`, as `#library-show-hidden` does; the same
  `self-start` is what keeps the collection detail's back link and its rename, run and delete buttons
  content-sized inside their flex columns.
- **The game page is a two-column card above `md`.** The cover (`#catalog-detail-cover`, 320px) sits
  beside the metadata column rather than above it, so the card holds its content instead of stretching
  a 320px image across a 977px surface; below `md` it stacks. Utilities only (`md:flex-row`,
  `md:shrink-0`, `min-w-0` on the text column).
- **Unavailable entry** (`opacity-60`): the one de-emphasis treatment for a catalogued entry that is
  present but not part of the result: an entry the owner no longer has access to, and a collection
  preview's *excluded* list. Added to the entry, never a replacement for it, so the entry still reads as
  an entry.
- **PSN badge** (`before:` utilities drawing the dot): PSN-linked-account indicator only (see Colors'
  `--color-psn` rule). A small dot and label in `--color-psn`.
- **Stat grid**: a divided grid of label and figure stats, used by the profile overview. The grid
  reflows **4 → 3 → 2 → 1 columns with no media query** (`repeat(auto-fit, minmax(200px, 1fr))`); at the
  960px data measure four tracks fit, and each narrower arrangement falls out of `auto-fit` rather than
  out of a breakpoint. A tile is hairline-divided by `border-t` rather than boxed: the tiles are one table
  of figures, not a row of cards, so `crgCard` is deliberately *not* used here. A tile's head pairs an
  `ng-icon` with an `appStampLabel` caption (not `appSpineLabel`: the text says what the block *is
  called*, not what a work *is*). A tile whose value is unknown or not permitted **must not render at
  all**, but `0` is a real value and must render, so guards test `!== null`, never truthiness. Tiles that
  navigate are `<a>` elements and carry their own `aria-label`, because the visible label and figure read
  as two separate nodes. That name opens with the visible caption and then the figure
  (`statTileAccessibleName`, one `StatTileCaptions` entry feeding both), because WCAG 2.5.3 Label in Name
  fails a name that does not contain the visible text in order; axe checks it as
  `label-content-name-mismatch`, so a name such as `1 follower` under a `Followers` caption fails the
  page scan. Two tiles carry prose and links in place of a figure: the trophies-off notice
  and the "Elsewhere" list of declared PlayStation profiles. Both still satisfy the rule above: each
  renders only when it has something real to say, and neither is a figure with the number left out.
- **Pager** (`mt-3 flex flex-wrap items-center justify-center gap-3`): the Previous, position and Next
  row under a paged list, used by the Catalog grid, the Library table and a collection's item list, all
  reading `from–to of total`. **`items-center` is load-bearing and must not be dropped**: without it the
  count `<span>` stretches to the buttons' height while its line box stays pinned to the top, so the text
  sits about 6px high. That failure is invisible to a test comparing element *centers*, because stretched
  children all report the same center; assert the span's own height instead (content-sized, not the
  buttons' height). The position label is `from–to of total` in a `text-text-muted` span, and the buttons
  are `crgButtonGhost`.
- **Quiet scroll** (`overflow-y-auto overscroll-contain [scrollbar-width:none]
  [&::-webkit-scrollbar]:hidden`): a scroll container that scrolls without showing a scrollbar. **This is
  nav chrome only, never content.** The desktop rail uses it because the brief asked for a mobile-app
  navigation idiom, and a mobile drawer does not carry a persistent scrollbar; the page's own scrollbar
  stays visible, because a reader of `/faq` needs to know how much is left. On the rail the default
  `auto` scrollbar consumes 16px of layout width, `scrollbar-width: thin` 11px, and hidden 1px, and hiding
  changes nothing about scrolling itself, which still works by wheel, touch, keyboard and
  `scrollIntoView`. Moving the bar to the left (`direction: rtl` on the container and a reset on every
  child) keeps the 11px cost, shifts the content, and needs a `direction` override on each child, so it
  buys nothing the hidden bar does not.
- **`ng-icon`**: the icon element, from `@ng-icons/core` with glyphs out of `@ng-icons/lucide`
  (see Appendix: Iconography & Imagery for the pack decision and the concept-to-glyph map). Color
  inherits from context and the glyph holds its size in a flex row, both set by the `ng-icon` element
  rule in `@layer base`; the default `1.5rem` size comes from `provideNgIconsConfig` in `app.config.ts`.
  Register glyphs per component through `provideIcons({ … })` in `viewProviders`, so unused ones
  tree-shake away; never register a whole pack. Every `ng-icon` carries `aria-hidden="true"`: the
  accessible name belongs to the control around it, so an icon-only nav link needs its own `aria-label`.
- **`app-site-nav`** (`src/app/nav/site-nav.component.ts`) renders the single sitewide nav-link data source
  (`PRIMARY_NAV_LINKS` in `src/app/nav/nav-links.ts`) **three** ways from one array: a persistent left **rail** at `lg` and
  above, a fixed bottom **tab bar** below it, and a **More sheet** holding whatever the tab bar cannot.
  `tab: true` marks the four destinations that earn a tab; the rest fall to the sheet, so tabs ∪ sheet is
  always exactly the rail. The active route carries `aria-current="page"` (`ariaCurrentWhenActive` on
  every rail, tab and sheet link), and an `aria-[current=page]:` utility paints it `--color-accent`:
  the attribute assistive technology reads is the same one the style keys on, so the two cannot
  disagree. `src/app/app-shell.layout.browser.spec.ts` asserts the attribute and that the active link's ink differs from an
  inactive one's.
  **The nav is a vertical rail for a structural reason, not an aesthetic one.** A horizontal header
  inside `crgPageContainer` has a usable width pinned at 963px for every viewport at or above 1100px, so
  a wider window buys the nav no room and each new destination eats into a fixed budget until the row
  wraps. A vertical rail has no such budget: appending a ninth destination moves nothing sideways, so the
  admin and non-admin shapes cannot diverge. **Do not reintroduce a layout that varies with an async
  signal**: `admin.isAdmin()` resolves after first paint, so a layout keyed on it visibly re-lays out
  about a second in.
  **The rail's failure mode is vertical, so the tests are too.** `src/app/app-shell.layout.browser.spec.ts` asserts a single
  column, `min(top) >= 0`, and `max(bottom) <= innerHeight` (a destination below the fold is a rail's
  version of a wrapped row), and it loops over viewport *height* rather than width.
  **The More sheet is a native `<dialog>`.** `showModal()` gives modal semantics, a focus trap, Escape,
  focus restore to the trigger, and `::backdrop` for free; only backdrop-click dismiss is written by hand,
  and `@angular/cdk` is not a dependency. Two things the platform does *not* give: a `<dialog>` survives
  navigation, so the component closes it on `NavigationEnd`; and it renders in the browser's **top
  layer**, above every z-index (see Elevation for why the loading overlay still has to sit above it).
  **`app-avatar` loads eagerly, deliberately.** `loading="lazy"` is wrong for a 28px image that is always
  above the fold: the browser defers a request it will make anyway, and inside a `display: none`
  ancestor may never make it at all, so the avatar's `<img>` never reaches `complete` while the chip is
  hidden. The host box is pinned to `size` (`HostBinding`) with `overflow: hidden` (the component's `host`
  class metadata, `inline-flex shrink-0 overflow-hidden rounded-full`, which is how a component classes
  its own host element without a stylesheet), and **that box is what makes eager loading safe**. It is
  also load-bearing for a second reason: a *broken* image renders its `alt` text at whatever width that
  text needs, and the alt is an email address.
- **The signed-in chip** (`src/app/app.component.ts`): it **lives in the header, not in the rail**
  (`app.component.html`), so it has its own entry: `app-site-nav` above does not own it, and a reader who
  goes looking for the chip under the nav component will not find it. `#header-inner` is
  `flex justify-between`, so the chip right-aligns against the brand with no new layout rule, and above
  `lg` that edge is the viewport's own because `#header-inner`'s `lg:max-w-none` drops its
  `crgPageContainer` cap there. **The chip is deliberately not a link**: `/profile` is already a
  `PRIMARY_NAV_LINKS` destination, and a second affordance for it a few rows away is navigation noise.
  What the chip is for is saying *which* account is signed in.
  **The chip renders at every width.** The rail is `display: none` below `lg`, and in the header the chip
  shares a roughly 350px row with the brand on a phone, so the cap is `16ch` below `sm` and `22ch` above it
  rather than one number. At the narrowest viewport the cap must still render a full address, and the
  space available to it is whatever the brand leaves in that row. Measure the brand-to-chip gap before
  narrowing either value: the binding constraint is the brand's width, not the cap.
  **The cap is load-bearing and must not be deleted.** Without it the layout depends on how long the
  signed-in address is, the one unbounded, data-dependent element in the header. A wrap-based test cannot
  catch its removal, because the row has room to spare and would pass against the very bug it exists to
  catch. **`src/app/app-shell.layout.browser.spec.ts` therefore asserts the cap directly**: computed `max-width` is not `none`,
  `overflow` is `hidden`, and the fixture address actually overflows it (`scrollWidth > clientWidth`),
  plus a desktop assertion that the address never grows leftwards into the brand, and a mobile one that
  the chip stays inside the header and does not widen the document. **The fixture address is what keeps
  the first of those honest**: `e2e/fixtures.ts` builds it as `${sub}@test.invalid`, a GUID plus 13
  characters, so it overflows a `22ch` cap by a wide margin. Do not use a wrap-based assertion, and
  re-measure rather than quoting a pixel figure: the `ch` unit depends on `--font-mono`.
  **The chip renders the whole address and lets the cap clip it**, rather than rendering a shortened form.
  A local-part-only chip reads better but costs the regression test its teeth: the e2e identity's local
  part fits uncapped, so nothing would fail if the cap were removed. `#user-email` carries a `title`, the
  only place a sighted user can read their own full address; truncation affects exactly the group the
  DOM-based accessibility argument does not cover.
- **`app-page-toc`** (`src/app/shared/toc/page-toc.component.ts`): client-side-only in-page table
  of contents and back-to-top link, generated from a page's own headings via a CSS selector input.
  Used on `/faq` and `/privacy`.
- **`app-breadcrumb`** (`src/app/shared/breadcrumb/breadcrumb.component.ts`): a small "go up" trail
  for nested sub-routes (`/profile/followers`, `/collections/:sub`, `/library/:sub`, `/u/:sub/...`)
  back to their logical parent (the owning profile). Not sitewide: the persistent nav handles
  top-level cross-navigation.
- **`app-loading-overlay`** (`src/shared/loading-overlay/loading-overlay.component.ts`): a transparent
  full-viewport layer that swallows clicks and announces `aria-busy` while an in-page request is in
  flight. It deliberately does not dim the page: it exists to stop input, not to signal progress, and
  the content underneath stays readable. Takes a classic `@Input()`, not a signal input: the Vitest
  harness JIT-compiles without ngtsc, where signal inputs silently fail to bind (`NG0303`).
- **`app-rawg-attribution`** (`src/app/shared/attribution/rawg-attribution.component.ts`): one muted
  line carrying a live hyperlink to RAWG. It is a license term rather than a design choice: RAWG's API
  terms require attribution **and** "an active hyperlink from every page where the data of RAWG is
  used". **"Where the data is used" is the whole rule, so the line is conditional, never
  unconditional**: a page rendering no RAWG value must not claim RAWG as a source, which would be a false
  statement of provenance on a page that also states what it collects. Each host owns its own predicate,
  and they differ because the two APIs do: `/library` (and `/library/:sub`, the same component) asks
  `rawg_enriched`, the stored per-row flag Curator reads as a column and never reconstructs from the
  ratings, or a completed refresh listing `rawg_enriched_titles`; `/catalog` and `/catalog/:gameId` have
  no such flag on `GameSummaryResponse` and ask `critical_score !== null`, which is the value those
  pages label "RAWG". A component rather than three copies of the markup, because a legal notice that
  drifts between pages is worse than one that lives in a single file.

## Do's and Don'ts

- **Do** keep `--color-accent` as the only color driving buttons, links, focus rings and active-nav
  state. One accent is the whole point; a second one costs the first its meaning.
- **Do** keep every surface, line and text token within `0.02` chroma of neutral. This is checkable by
  reading the number.
- **Do** take the ink on any fill from `--color-on-fill`, and use `--color-line-strong` (never `line`)
  for the edge of anything a user can operate.
- **Do** keep radii small: `--radius-lg` is for the sheet's top corners and nothing else.
- **Do** maintain WCAG AA contrast (4.5:1 body text, 3:1 large text, 3:1 non-text per 1.4.11) for every
  pair **in both schemes**, and let `src/styles.contrast.schemes.browser.spec.ts` be what proves it.
- **Do** drive nav-link data from a single source (`PRIMARY_NAV_LINKS`); never duplicate the link list
  between the rail, the tab bar and the sheet.
- **Don't** spend chroma on a surface. Cover art is the saturated thing on the page; chrome recedes.
- **Don't** reach for a drop shadow to express depth: the ladder is three surface levels plus a
  hairline, and `--shadow-overlay` exists for the sheet alone.
- **Don't** use gradients, glow, or neon: flat color fills only.
- **Don't** use scale-up hover bounce or elastic easing: motion is deliberate, not springy (see
  Appendix: Motion).
- **Don't** add a manual light/dark toggle: the schemes are `prefers-color-scheme`-only.
- **Don't** use Tailwind's `dark:` variant. Dark is the *base*, so `dark:` either no-ops or inverts the
  model; the light scheme is a token re-binding, not a variant.
- **Don't** use `@theme inline` for a color. It bakes the value into every utility and the light
  re-binding silently stops working.
- **Don't** use CSS to decide whether something renders, and don't key a selector off an attribute
  another feature owns (see Where styling lives).
- **Don't** write a component stylesheet. A one-off arrangement is utilities in the template; a reused
  appearance becomes a directive plus a Components entry here, in the same change (see "One primitive,
  one definition").
- **Don't** restate a directive named in Components. One primitive, one definition; vary size and
  placement with utilities on the element, never shape, radius, fit or color.
- **Don't** vary a layout on an async signal. `admin.isAdmin()` resolves after first paint, and a
  layout keyed off it visibly re-lays out a second in.
- **Don't** remove the underline from a link that sits inside a sentence. A link in a text block must be
  distinguishable from the prose around it by something other than color (WCAG 1.4.1), unless the two
  colors differ by 3:1, which an accent and body text on the same surface generally do not. `a` is
  underlined by default for exactly this reason; a link that is a **control** rather than prose (the
  brand, breadcrumb, rail and tab links, anything carrying a `crgButton*` directive) opts out with
  `no-underline`, because it is not in a text block.
- **Don't** render a rejected set identically to an accepted one. A collection preview's *excluded*
  list is what the filters turned down, not more of the collection; styled the same as the included
  cards it reads as part of the result and makes the stated count look wrong. It composes
  `opacity-60`, the same de-emphasis an entry the owner no longer has access to takes.

---

## Loading & hydration

**A data-backed route resolves its first payload before it activates; everything after that is an
overlay.** These are two different problems and each has exactly one answer.

- **First payload: route resolver.** A page that activates empty and fills in a moment later renders
  a placeholder the user reads, then replaces it. Worse, it makes "still loading" and "there is nothing
  here" indistinguishable, for the user and for tests alike. Resolvers remove the ambiguity by making
  activation wait.
- **Every later fetch: `app-loading-overlay`.** Paging, filtering, sorting and refreshing are still
  async, and the page is still unstable while they run. Keep the current data on screen and block
  interaction over it; do not blank the view back to a loading string. A user who can click a sort
  header mid-fetch can queue a request against a state that no longer exists.

**A resolver degrades, it never redirects.** Resolve to `null` on failure and let the component render
its own error state: there is rarely a better page to send someone to, and a failed navigation loses
the URL they were trying to reach.

Two consequences follow: there is **no** "Loading…" text anywhere in a data-backed page, and no
per-feature loading flag beyond the one driving the overlay. If a page needs a second loading concept,
that is a signal its first payload belongs in a resolver.

**A server-rendered page is interactive before Angular is, and a link clicked in that window is a
native navigation.** Event replay queues the click for after hydration but never stops the browser
following the `href`, so the destination arrives as a fresh document (correct, since every anonymous
page is server-rendered too), and Back is then a document traversal rather than a popstate. The router's
in-memory restoration cannot serve that traversal, and it has set the entry's
`history.scrollRestoration` to `manual`, so `provideBrowserScrollRestorationWhenLeavingTheDocument()`
from `@crgolden/modules/angular` hands the mode back to the
browser on `beforeunload` and the browser restores the reader's position itself. The mechanism and its
two E2E paths are in [Librarian.md](../AGENTS/REPOS/Librarian.md) § `/catalog`.

## Where styling lives

### There is deliberately no `scroll-behavior: smooth`

Smooth scrolling is driven by animation frames, so anywhere frames are not running (a throttled
background tab, a stalled GPU process, a scroll-hijacking extension) the scroll is dropped entirely
rather than degrading to a jump. Anchor navigation and programmatic scrolls have to land
unconditionally, and the animation is not worth making them fail closed. This matters more here than
in most apps because `/faq` and `/privacy` are built around deep links to authored heading ids.

### Tailwind is imported whole, Preflight included

`styles.css` opens with `@import 'tailwindcss'`, which brings the theme, **Preflight** (Tailwind's base
reset, in `@layer base`) and the utilities. Preflight zeroes every element's margin and resets heading
and list defaults, so anything that relies on a UA default has to state it again. A modal `<dialog>` is
the case that bites: the UA centers it with `margin: auto`, Preflight removes that, and it renders
against the top-left inset unless it carries `m-auto` (see "Declarations that look removable and are
not"). The element defaults this stylesheet authors (`html`, `body`, the headings, `p`, `a`, the
focus-visible ring, the text inputs, `select`, `textarea`, `code`, `ng-icon`) sit in `@layer base`, after
Preflight, which is where Tailwind's documentation places them (tailwindcss.com/docs/adding-custom-styles,
"Adding base styles"), so a template utility overrides them. There is no `@layer components`: the
primitives are directives whose host carries utilities.

**CSS decides how something looks. The component decides whether it exists.** Presence, absence and
conditional rendering belong in the template (`@if`), never in a selector that reaches into markup
shape to hide things. A rule like `td[data-label='Cover']:not(:has(img)) { display: none }` looks
economical and is the opposite: it couples two unrelated features through an attribute one of them
owns, and it buries a decision about what an entry *is* somewhere nobody looking for that decision
would think to search.

**A page's own arrangement lives in utilities in its template, and nowhere else.**
`flex flex-col gap-4 max-w-data mx-auto` says what a one-off column is without inventing a class name
that then has to be maintained, documented and checked for forking. Four questions before writing any
rule, in order:

1. **Can utilities express this?** Almost always yes for a page's own layout. The spacing scale maps
   exactly (a card's padding is `p-6`, its gaps `gap-2/3/4`), and the page measures are theme
   tokens, so `max-w-data` stays greppable where `max-w-[60rem]` would not.
2. **Does a token already express this?** Use `var(--color-*)`, `var(--radius-*)`, `var(--container-*)`.
   A literal color, a one-off pixel spacing, or a bespoke shadow is a defect, not a shortcut.
3. **Does a named primitive already express this?** `crgCard`, the `crgButton*` directives,
   `appSpineLabel`, `appCatalogTitle`, `appCatalogMeta`, and the utility lists Components names. Reach
   for the vocabulary before inventing beside it.
4. **Is this actually structure rather than style?** If the rule's job is to make something disappear
   or appear, it is the component's job instead.

Appearance that repeats across unrelated features becomes a **directive with an entry in Components
above, added in the same change**: in `@crgolden/modules/primitives` when Churches or Inventory renders
it too, in `src/shared/primitives` when only this app does. Appearance one feature repeats stays a
utility list in that feature's templates.

**Motion comes from Tailwind's own animations** (`animate-spin` on the loading spinner, with
`motion-reduce:animate-none`); a custom one is a `--animate-*` token with its `@keyframes` nested inside
`@theme`. An element the template cannot address, such as a descendant of projected content, is reached
with an arbitrary variant (`[&_p]:mt-4`) on the element the template does own.

**A class can be a *selector contract*; check before deleting one as "just styling".** `app-page-toc`
takes a heading selector, so `/faq` and `/privacy` expose an `id` for it rather than a class, which
cannot be restyled away.

### One primitive, one definition

**Every directive named in Components is defined exactly once.** Utilities on the element may
position a primitive and size it; nothing may restate what the primitive *is*. A copied utility list is
a fork that drifts silently, so a primitive used beside its own copy is a defect.

- **A per-page variation is utilities beside the directive, never a second directive.** Size and
  placement differ legitimately between a 48px table thumbnail and a 320px detail image; shape, radius,
  fit and color do not.
- **A state that changes a directive's color keys on the element's own state** (`aria-current`, a
  `data-*` attribute) with a variant, because two plain utilities setting one property are decided by
  stylesheet order. `lint:utilities` fails a plain utility that sets a property the directive on the same
  element already sets.

### Curator's vocabulary tokens are rendered verbatim; only the column is capped

Curator's `genre` values are raw vocabulary tokens (`ROLE_PLAYING_GAMES`, `MUSIC/RHYTHM`), and **every
surface renders the token exactly as it arrives.** There are six of them: the Catalog card's
`appSpineLabel`, the Catalog Genre filter's options, the Library table's Genre cell, the Library genre
filter's options, the collection builder's genre listbox, and the two routing-genre listboxes on
`/consoles`. **Do not add a display-name lookup on the Librarian side.** The token is simultaneously the
label and the value the filter posts back: `<option [value]="option">{{ option }}</option>` submits that
same string as the `genre` parameter, so a prettified label needs a parallel key-to-label table, which is
a second source of truth for a vocabulary that is deliberately data. The token is the fact; a nicer
spelling of it is a claim.

**What the raw token costs is layout, and only in the Library table.** Under `table-layout: auto` a
column is sized from its widest cell's max-content width, so one `ROLE_PLAYING_GAMES` anywhere in the
page sets the Genre column for every row and takes space the header row needs. That is the one place
the presentation layer pushes back, and it does so **in CSS, on the displayed text only**:

- **The genre span's `inline-block max-w-[12ch] truncate align-bottom` caps the cell content at `12ch`
  and ellipsizes it.** `12ch` is the measure a readable label (`Role-playing`) would need, so the column
  keeps the budget a display-name mapping would spend and the token clips inside it.
- **The cap sits on a `<span>` inside the `<td>`, never on the `<td>`.** CSS 2.1 §17.5.2 leaves the
  effect of `max-width` on a table cell **undefined**, and the automatic table layout algorithm is free
  to ignore it. An ordinary inline-block inside the cell has no such exemption, and the column then
  sizes to the capped span.
- **CSS truncates; TypeScript must not.** A sliced string loses the token from the DOM, and with it the
  accessible name, in-page find, and copy-paste. An ellipsis keeps the whole value where every consumer
  of the page can still reach it. The span also carries a `title`, on the `#user-email` precedent: a
  sighted user has no other way to read what was clipped.
- **The cap is two-sided and the spec proves both sides.** `library.spec.ts` asserts the raw token
  clips (`scrollWidth > clientWidth`), that an ordinary genre does **not** (a cap tight enough to
  clip `Action RPG` is a regression, not a fix), and, clearing `max-width` at runtime and re-measuring
  the header, that the column is genuinely narrower with the cap than without it. Without that control
  run the first assertion would pass against a cap that does nothing.

**Nothing else is truncatable, and that is a measurement rather than a decision.** A native `<option>`
renders its text in UA chrome that `text-overflow` cannot reach, so the two `<select>` filters could not
be capped even if they needed it, and they do not: `styles.css` gives every `select` `width: 100%`, so
both the single-selects and the two multi-selects take their container's width and no option can widen
them. The Catalog card's `appSpineLabel` is measured instead of assumed: `catalog.spec.ts` asserts the
raw token's rendered width fits a card at the grid's own `minmax(220px, 1fr)` floor, which is the
narrowest tile the layout can produce.

**Measuring how wide a piece of text renders is not `scrollWidth`.** `appSpineLabel` is a flex item
stretched to its line, so `scrollWidth` reports the *box* (440px on a wide viewport), and an assertion on
it fails against a token that fits comfortably. The text's own width comes from a `Range` over the
element's contents; the spec pairs it with a `> 0` assertion, because a `Range` that selects nothing
measures zero and would satisfy any "it fits" bound.

### There are no component stylesheets

Every component styles itself with utilities in its template, and a component classes its own host through
its `host` metadata (`app-avatar`, `app-page-size`), never a `:host` rule. A `*.component.css` is a
code-style catalog row under rule 14, and deleting it is the only way to close that row.

**The cascade decides what a utility can override, so the layers are the design.** `@import
'tailwindcss'` declares `theme, base, components, utilities`. `styles.css` authors only `@theme` tokens,
the light scheme's `:root` re-binding of those tokens, and element defaults in `@layer base`, so any
utility overrides any default this file sets.

**Structure the template emits is still the template's to style.** The library table's stacked layout
below `md` is `max-md:` utilities on its `thead`, `tr` and `td`, and each cell's caption is
`max-md:before:content-[attr(data-label)]`, so the rule and the element it styles are one line apart.

**The stacking ladder is four `--z-*` tokens, read in templates as `z-(--z-header)`,
`z-(--z-back-to-top)`, `z-(--z-tabbar)` and `z-(--z-loading-overlay)`.** `stylelint` holds
`styles.css` to `var(--z-*)`, and `lint:utilities` fails any template `z-*` utility whose built rule
does not read a `--z-*` token, so a `z-50` cannot join the ladder at a rung nobody chose. Adding a rung
is adding the token to Elevation & Depth.

### Declarations that look removable and are not

A utility can exist to *cancel* a global or UA default, so it reads as noise and deletes cleanly with no
visible failure until the page is measured.

- **`#library-genre-filter`'s `flex-[0_1_14rem] min-w-40`.** `styles.css` gives every `select`
  `width: 100%`. Without its own flex basis the filter inherits that, takes a whole line to itself in the
  library's controls row, and opens a native dropdown as wide as the card, above the `md` breakpoint
  only. `#library-search` beside it carries the same pair of utilities for the same reason.
- **The Store-match dialog's `text-text`.** The UA stylesheet sets `dialog { color: CanvasText }`,
  which **breaks inheritance from `body`**: a `<dialog>` does not take the page's ink unless something
  says so. The utility looks redundant beside a `crgCard` background that is already correct, because
  `crgCard` sets no `color`. The More sheet (`#nav-sheet`) carries `text-text` for the same reason; a new
  `<dialog>` anywhere in this app needs one or the other. `library.spec.ts` pins it by comparing the
  dialog's computed color with `body`'s, which asserts the inheritance the UA rule breaks rather than
  naming any token.
- **The Store-match dialog's `m-auto`, `w-[min(var(--container-narrow),calc(100vw_-_2*--spacing(4)))]`
  and `max-h-[calc(100vh_-_2*--spacing(4))]`.** **A modal `<dialog>` is centered by `margin: auto` in the
  UA stylesheet, and Preflight resets every element's margin to `0`**, so a `<dialog>` here is not
  centered unless it carries `m-auto`. `max-height` keeps a long Store proposal inside the viewport, and
  `width` is the measure, since a `<dialog>` is `width: fit-content` and otherwise sizes to its
  candidates. `library.spec.ts` pins each by what it does rather than by restating it: the dialog is
  centered and holds the resolved `--container-narrow` on a wide screen, keeps equal gutters on a phone
  (the `100vw` arm of the `min()`), and at a short viewport a proposal that overflows
  (`scrollHeight > clientHeight`, asserted first so the bound cannot pass vacuously) stays inside the
  viewport. **Any future `<dialog>` here needs all three**; the More sheet escapes it only because it is
  deliberately edge-anchored rather than centered.
- **`whitespace-nowrap` on the library table's `<th>`.** The sort arrow is a separate `<span>` after a
  space, so a narrow column orphans it onto its own line and doubles the header row's height.
  `#library-table-scroll` carries `overflow-x-auto`, so a header row too wide for the card scrolls instead
  of wrapping, which is the intended behavior. `src/library/library.layout.browser.spec.ts` pins it on the sorted `PS Store` column
  between `md` and the data measure: its label and arrow share one line, and with `white-space` cleared at
  runtime the same header breaks, which proves the fixture loads that column enough for the first
  assertion to be able to fail.

### Enforcing it

Every rule here is enforced by a check, never by this prose. The code-style catalog reports every
authored CSS declaration outside `@theme` tokens, `@font-face`, `@import`, the light-scheme re-binding of
existing tokens, and type-selector rules in `@layer base` as a rule-14 row. `lint:css` runs the shared
`@crgolden/modules/design-gates` stylelint config over `styles.css`: no literal color (hex, a color
function or a named color), and font, shadow and z-index values read `@theme` tokens. `lint:utilities`
runs the shared design-gates check: it fails a template or directive host class the built CSS never
reaches, a non-literal host class, an `@theme` token nothing reads, a `z-*` utility that does not read a
`--z-*` token, and a plain utility that sets a property a directive on the same element already sets.

## Appendix

Content below isn't part of the design.md spec's own section vocabulary, but is kept here as
project-specific guidance that doesn't fit neatly into any of the sections above.

### Motion

Deliberate, not springy. `200ms ease-out` for hover and focus transitions (the text inputs' border and
halo in `@layer base`, and the `crgButton*` directives' fills), and the Catalog card's `-2px` hover
lift: the feel of sliding a card out of a drawer or turning a page, not a bounce. No scale-up hover
effects beyond that lift, no elastic easing. Loading states use the overlay's spinner rather than
spinners styled as gamified progress bars. **`prefers-reduced-motion: reduce` is honored per element,
not by a global reset**: the text inputs drop their transition in `@layer base`, the button directives
carry `motion-reduce:transition-none`, the spinner `motion-reduce:animate-none`, and the Catalog card
`motion-reduce:hover:translate-y-0`. A new transition or animation carries its own `motion-reduce:`
utility.

### Iconography & Imagery

**The pack is Lucide** (`@ng-icons/lucide`, ISC), delivered through `@ng-icons/core`, the only delivery
mechanism peering `@angular/core >=22` (`lucide-angular` itself caps at `13.x - 21.x` and will not install
against this app). Import from the **package root**; there is no subpath.

Gamepad and controller motifs are allowed, so `lucideGamepad2` is available if it is genuinely the right
glyph. The testable constraint is this: **Catalog, Collections and Library sit adjacent in the tab bar at
24px and must read as three different things there.** They therefore take structurally unrelated
silhouettes (a grid, an open folder, a stack of spines) rather than three variations on a rectangle.
Check a new glyph at 24px against its neighbors, not at 48px on its own.

Color inherits from context and the glyph holds its size in a flex row, both defined once in
`styles.css`; the default `1.5rem` size comes from `provideNgIconsConfig` in `app.config.ts`. Register
glyphs per component through `provideIcons({ … })` in `viewProviders` so unused ones tree-shake away;
never register a whole pack.

| Concept | Glyph |
|---|---|
| Home | `lucideHouse` |
| Catalog | `lucideLayoutGrid` |
| Library | `lucideLibraryBig` |
| Collections | `lucideFolderOpen` |
| Profile | `lucideCircleUser` |
| PSN Settings | `lucideSettings` |
| Consoles & Storage | `lucideHardDrive` |
| Enrichment Runs | `lucideSparkles` |
| FAQ | `lucideCircleHelp` |
| Privacy | `lucideShield` |
| More (opens the sheet) | `lucideEllipsis` |
| Close the sheet | `lucideX` |
| Sign out | `lucideLogOut` |
| Purchased / owned | `lucideBookmark` |
| Free-to-play | `lucideDownload` |
| Monthly games | `lucideCalendarDays` |
| Catalog entitlements | `lucideLayers` |
| Trophy level | `lucideTrophy` |
| Trophies earned | `lucideMedal` |
| Followers | `lucideUsers` |
| Following | `lucideUserPlus` |
| Member since | `lucideStamp` |
| Profiles elsewhere | `lucideLink` |

### Voice & Tone

Copy reads like a curator's working notes, not marketing copy. Prefer:

- "12 titles catalogued" over "12 games unlocked"
- "Added to your collection" over "Added to library!"
- "Last catalogued" over "Last synced"

**The preference is flat reporting, and it is a preference rather than a ban.** A curation tool states
what is true and lets the reader draw the conclusion. "Trophies earned / 180" is a count; "You've earned
180 trophies!" is a celebration, and celebrating is not this app's job.

PSN's own domain nouns (trophy, tier, level, *earned*) are the names of the data being reported, and
reporting them flatly is not gamification. Do not paraphrase PSN's own terms to avoid them.

### Accessibility

- All text/background pairs in **both schemes** must hold WCAG AA contrast (4.5:1 body, 3:1 large text).
- **Icons, borders and control edges are non-text content and answer to WCAG 1.4.11: 3:1 against their
  own background**, not the 4.5:1 body-text bar. `--color-line` and `--color-line-strong` are two tokens
  rather than one for this reason: `line` measures 1.42:1 on `surface`, which is correct for a divider
  between rows and a failure the moment it becomes the edge of an input. The tightest pair in the palette
  is `line-strong` on `surface-2`; re-measure it before touching either token. An icon that is the *only*
  carrier of meaning (an icon-only rail link, a status glyph) also needs a text alternative (see the
  `ng-icon` entry in Components).
- Focus rings use `--color-focus` **with `outline-offset: 2px`**, from one `:focus-visible` rule in
  `@layer base` covering `a`, `button`, `input`, `select`, `textarea` and `summary`, which reads the width
  and offset from the `--focus-ring-width` and `--focus-ring-offset` tokens. `src/app/app-shell.layout.browser.spec.ts` holds
  each ringed control to those tokens and holds the width token to WCAG 2.4.13's two-pixel minimum, so
  the 2px is stated once, in the stylesheet. The offset is what makes the ring legible: the same ring
  sitting directly on an accent fill is far tighter than the same ring offset onto the surface behind the
  control. Because the offset paints on that surface rather than on the control, `src/styles.contrast.schemes.browser.spec.ts`
  measures the ring against **`canvas`, `surface` and `surface-2`**: canvas alone would leave the rail
  and the cards unmeasured. Text inputs also take an accent border and the `--shadow-focus` halo on any
  focus, and they keep the outline, so forced-colors mode, which drops box shadows, still shows a ring.
  Never rely on color alone for a state: error and success text carries an icon or a label too, which is
  also why success is the accent rather than a second hue.
- `prefers-reduced-motion` is honored per element (see Appendix: Motion).

---

This document is the source of truth for all future Librarian UI work, and is linked from both
`AGENTS/REPOS/Librarian.md` and the repo `README.md` so it is reachable from wherever someone starts. Any
new page or component should be checked against it before merging, the same way `COVERAGE/METHOD.md`
governs testing conventions at the workspace root. The live route list is `src/app/app.routes.ts`: read
it there rather than restating a count here.
