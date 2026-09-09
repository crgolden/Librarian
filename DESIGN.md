---
version: alpha
name: Librarian
description: A reading light over a large, dark collection — dark-first OKLCH, one accent, an instrument-panel type pairing.
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
  1: 0.25rem
  2: 0.5rem
  3: 0.75rem
  4: 1rem
  5: 1.5rem
  6: 2rem
  7: 3rem
  8: 4rem
components:
  - card
  - card-accent
  - btn-primary
  - btn-ghost
  - btn-ghost-danger
  - btn-danger
  - btn-sm
  - catalog-list
  - catalog-title
  - catalog-meta
  - cover-art
  - item-unavailable
  - pager
  - psn-badge
  - spine-label
  - stamp-label
  - stat-grid
  - stat
  - stat-head
  - stat-value
---

# Design Language

## Overview

**A reading light over a large, dark collection.**

Librarian is an instrument for scanning a big collection, not a storefront and not a document. Three
consequences follow, and every decision below is one of them:

1. **Dark is the base, not the alternate.** The content *is* the light. A grid of saturated 1:1 cover
   tiles reads as a shelf against near-black and as noise against parchment — the ground has to recede
   so the art can be the brightest thing on screen. Light is a re-binding of the same tokens under
   `@media (prefers-color-scheme: light)`, not a second design.
2. **One accent, because in a scanning tool colour is a pointer.** A palette with four decorative hues
   has no way left to say *look here*. Librarian spends its chroma on exactly one accent and keeps every
   surface within `0.02` chroma of neutral. Success is not a second green — it is the accent, and it is
   distinguished by *shape* (inline text with a check glyph) rather than by hue.

   **That accent is green (hue 155), and the reason is the alias, not the heritage.** Green arrived from
   the retired card-catalog identity ("library green — leather, shelving, brass fixtures") and could have
   left with it. It stayed because **`--color-ok` is an alias of the accent**: this palette has no second
   hue for success, so success *is* the accent. Green is the only candidate where that reads naturally —
   "success is violet" fights a convention every visitor arrives with, and the alias would have to become
   a real second hue, which is the thing rule 2 exists to prevent. Measured, contrast does not decide it:
   at the shipped `L`/`C`, hues 155, 225, 300 and 330 all clear every bar in both schemes, 195 fails the
   light text bar at 4.31:1, and 25 / 75 / 265 are excluded because they collide with `--color-danger`,
   `--color-warn` and `--color-psn` — a single accent indistinguishable from a status colour would be
   worse than any aesthetic objection. **The light accent's headroom is the thing to watch: 4.57:1 against
   a 4.5 bar, 1.6% spare** — the tightest text pair in the palette, so any lightening of
   `--color-accent` in the light scheme fails `e2e/contrast.spec.ts`, by design.
3. **Space Grotesk, because these are labels on an instrument panel.** Headings are controls and
   section markers, not prose. Body copy is Inter; anything the eye compares column-wise — counts,
   percentages, dates, ids — is JetBrains Mono, so digits align.

The palette is expressed in **OKLCH**, and that is load-bearing rather than fashionable: lightness in
OKLCH is perceptually uniform, so `0.22` and `0.26` are a predictable step apart on every hue, which is
what makes the three-surface ladder in Elevation work without a shadow. It also makes a bad value
visible as a number — a surface token with chroma above `0.02` is wrong on sight.

**Theme switching stays `prefers-color-scheme` only.** No JS toggle, and none should be added — see
Do's and Don'ts.

**There is no site footer, and one should not be re-added.** It carried a nav duplicating the rail
(Home / Catalog / FAQ / Privacy — all four already in the rail, and in the More sheet on mobile) plus the
line *"Librarian — game curation frontend for the Curator API"*, which describes the architecture rather
than telling a user anything. It also could not be centred: the footer sits inside `.app-body`, the flex
sibling of the rail, so its `.page-container` centres against the viewport **minus** the rail and reads
as skewed right on every desktop width — the same class of bug as the header brand, which is fixed by
un-capping instead. Three problems, and removing it solves all three while matching the mobile-app idiom
the brief asked for: apps have a tab bar, not a footer. Privacy stays reachable from the rail and the
sheet, which is what actually matters. **Provider attribution is the obvious reason to want one back,
and it is not a good enough one** — RAWG's terms ask for a hyperlink on the pages that render their
data, which is three of them, not all of them, and only when those three are actually showing it;
`app-rawg-attribution` puts the line exactly there (see Components). A footer would attribute RAWG on
`/privacy`, which renders none of their data and makes claims about provenance for a living.

**`:root` also declares the CSS `color-scheme: dark light` property, and it is not the same thing as the
media query.** `prefers-color-scheme` tells *this stylesheet* what the user prefers; `color-scheme` tells
*the browser* what this document supports, and the order lists dark first so dark is what a user with no
preference gets. Without it the UA paints its own chrome — scrollbars, form controls, the canvas behind
the page — from the OS light theme, which on Windows means bright scrollbars with stepper arrows against
a near-black UI. **No token, contrast or layout assertion can see that**, because none of it is the
page's own CSS; `e2e/theme.spec.ts` asserts the declared property directly.

## Colors

Dark is the base and lives in Tailwind's `@theme`. Light re-binds the *same* token names in a plain
`:root` rule inside the media query — plain, not `@theme inline`, because `@theme inline` bakes the value
into every utility and the re-binding would then do nothing.

| Token | Dark (base) | Light |
|---|---|---|
| `--color-canvas` | `oklch(0.18 0.012 265)` | `oklch(0.97 0.004 265)` |
| `--color-surface` | `oklch(0.22 0.014 265)` | `oklch(1 0 0)` |
| `--color-surface-2` | `oklch(0.26 0.016 265)` | `oklch(0.945 0.006 265)` |
| `--color-line` | `oklch(0.32 0.016 265)` | `oklch(0.89 0.008 265)` |
| `--color-line-strong` | `oklch(0.48 0.02 265)` | `oklch(0.68 0.014 265)` |
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
  (its linear-red component is negative), so a browser silently gamut-maps it — and every contrast ratio
  computed from the token then describes a colour that is not the one rendered. A token you cannot
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
  raised surfaces, and it is the one the contrast spec has actually caught failing** — do not darken it
  in dark or lighten it in light without re-running `e2e/contrast.spec.ts`.
- **Focus rings carry `outline-offset: 2px`, mandatory.** `focus` directly on an `accent` fill is
  1.32:1; offset onto the page background it is 10.94:1. The offset is the contrast.
- **`--color-ok` is an alias of the accent.** Success is distinguished by *shape* — inline text with a
  check glyph — never by a second green surface.
- **`--color-psn` marks a linked PlayStation account.** It is descriptive, not restrictive.

### The failure mode this palette actually has: a token that still resolves

**Every defect found while building this palette had the same shape — a `var()` that still resolved, so
nothing failed, while the thing it expressed quietly stopped being true.** Six of them, and **only one was
visible in review**: the rest were found by a test measuring them, by a control run, or by an operator
asking why something looked wrong. Recorded together because the *shape* is the reusable part, not the
individual bugs. Note the last two are not colour at all — the shape generalises to any token:

| What was written | What it meant | Why nothing failed |
|---|---|---|
| `.card { border-top: … var(--color-primary) }` | a neutral card edge, with `.card-accent` as the marked variant | `--color-primary` aliases `--color-accent`, so **both classes rendered identically** and the variant stopped meaning anything |
| `--color-error-hover: var(--color-danger)` | a hover that moves away from the ink | it resolved to the base colour, so **destructive buttons had no hover at all** |
| `--color-line-strong` at `L 0.48` | a control edge clearing 3:1 | it resolved fine and looked plausible; it measured **2.38:1** |
| `a { text-decoration: none }` | links distinguished by the accent | the accent resolved; links in prose were **colour-only**, failing WCAG 1.4.1 |
| `--color-focus` declared, and no `:focus-visible` rule anywhere | every control ringed in the focus token at a 2px offset | the token resolved, and `e2e/contrast.spec.ts` **measured it passing** — while nothing applied it, so every control fell back to the browser's default ring at offset 0 |
| `--container-prose` in `@theme`, spelled `max-w-prose` | a 720px reading measure | `max-w-prose` is a Tailwind **built-in** pinned to `65ch`; the token was emitted and greppable while the utility ignored it, so the measure was 656px and font-dependent |

Two rules follow, and they are the whole defence:

1. **An alias must point at something that differs.** If `--x-hover` resolves to the same value as `--x`,
   the state it names does not exist. Aliasing a legacy name into the new palette is where this creeps in,
   because the compiler is perfectly happy.
2. **If a token expresses a *relationship* — a hover that must differ, an edge that must clear a ratio,
   a variant that must be distinguishable — the relationship gets a test.** That is why
   `e2e/contrast.spec.ts` now measures the hover fills as well as the resting ones.
3. **A contrast spec proves a pair is legible. It cannot prove the pair is used.** `--color-focus` on
   `--color-canvas` measured green throughout the whole period in which no element was ringed in it. A
   token needs a test that the *rule* exists, separately from the test that its colours work — which is
   what `e2e/theme.spec.ts`'s focus-ring suite is. It asserts `outline-style: solid`, because Chromium's
   fallback ring is `auto`, and `auto` ignores `outline-color` entirely: asserting the colour alone would
   pass against the browser default.

   **The suite was proven to discriminate rather than assumed to.** Reverting the `:focus-visible` rule at
   runtime and re-reading the same three selectors moved every one of them from `solid/2px/2px` to
   **`auto/1px/1px`** — so all three assertions (style, width, offset) fail when the rule is removed, on
   every selector. Note the measured fallback offset is `1px`, not `0`; an earlier version of this section
   said `0`, which is the kind of unmeasured detail this file exists to keep out.

**No ratio is quoted in this file, and that is deliberate.** `e2e/contrast.spec.ts` resolves each token
through a 1×1 canvas in **both** schemes and checks 15 pairs against their WCAG bar — 4.5:1 for text,
3:1 for a control edge or icon under 1.4.11. A number written down here is a claim that rots; the spec is
a measurement that cannot. **This is not hypothetical: the first version of this palette was documented
with ratios of "3.57:1" and "3.11:1" for the `line-strong` pairs, and the spec measured them failing.**
The table above is the palette; the spec is the proof.

The canvas is pre-set to a magenta sentinel before every fill, because **Canvas2D ignores an invalid
colour silently** — without the sentinel a token that failed to parse would inherit the previous pixel
and quietly pass.

## Typography

| Level | Font | Size | Weight | Line height | Use |
|---|---|---|---|---|---|
| h1 | Space Grotesk | 2.25rem | 700 | 1.25 | Page titles |
| h2 | Space Grotesk | 1.5rem | 700 | 1.25 | Section headings |
| h3 | Space Grotesk | 1.25rem | 700 | 1.25 | Card/subsection headings |
| h4 | Space Grotesk | 1.125rem | 700 | 1.25 | Minor headings |
| body | Inter | 1rem | 400 | 1.6 | Everything else |
| `.catalog-title` | Space Grotesk | inherit | 600, italic | inherit | Game titles |
| `.catalog-meta` | JetBrains Mono | 0.85rem | 400 | inherit | Metadata: dates, PSN ids, ratings, completion % |
| `.stamp-label` | JetBrains Mono | 0.8rem | 400, uppercase, `letter-spacing: 0.06em` | inherit | Captions: a heading over a block, a state on a record |
| `.spine-label` | Inter | 0.7rem | 600, uppercase, `letter-spacing: 0.06em` | inherit | Genre/platform classification tags |

**Anything the eye compares down a column is monospace, and that is the whole rule.** Counts,
percentages, dates, ids and scores are set in JetBrains Mono so their digits align between rows; prose is
Inter; headings are Space Grotesk because they label controls rather than open paragraphs. All three are
**variable** faces, self-hosted from `public/fonts/` — one file per family covers every weight in the
scale.

```css
--font-heading: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
--font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;

/* Type scale — named by role, not by value. */
--font-size-display: 2.25rem;      /* h1 */
--font-size-section: 1.5rem;       /* h2 */
--font-size-subsection: 1.25rem;   /* h3, the brand wordmark */
--font-size-minor: 1.125rem;       /* h4 */
--font-size-body: 1rem;            /* body copy, form controls, .btn-primary/.btn-danger */
--font-size-meta: 0.85rem;         /* .catalog-meta, .text-muted, .btn-ghost, breadcrumb, nav chip */
--font-size-small: 0.8rem;         /* .btn-sm, .psn-badge, .stamp-label, tab-bar and stacked-table labels */
--font-size-label: 0.7rem;         /* .spine-label */
--font-size-inline-code: 0.9em;    /* em, not rem — see below */

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

--letter-spacing-label: 0.06em;
```

**Every `font-size`, `font-weight`, `letter-spacing` and `font-family` takes a token — enforced by
`npm run lint:css`.** The table above and the CSS could previously drift in silence, and did: eleven
distinct sizes were in use where this table specifies seven. `0.875rem` and `0.9rem` were collapsed into
`--font-size-meta` and `0.75rem` into `--font-size-small`; at a 16px root those pairs sat 0.8px apart,
which is a difference nobody can see and everybody has to maintain.

`--font-size-inline-code` is deliberately the one relative value. Inline `<code>` should track whatever
text surrounds it, so a snippet inside an `h3` stays proportional to that heading; pinning it to a `rem`
step would shrink it there. A token that resolves differently by context is correct here and nowhere
else in the scale.

- **Headings & game titles** — `Space Grotesk`. Its tight apertures and near-mechanical forms read as
  labelling rather than prose, which is what a heading does in a scanning tool. Game titles take the same
  face at 600 rather than a separate treatment: the title is the primary thing on a card, so it needs
  weight, not decoration.
- **Body** — `Inter`. A quiet reading face that does not compete with the headings for attention.
- **Metadata / numbers** — `JetBrains Mono` for anything compared down a column: acquisition dates, PSN
  account identifiers, completion percentages, platform codes, ratings. Alignment is the point — a
  proportional face makes `98%` and `100%` different widths and the eye has to re-find the decimal on
  every row. Lives in `.catalog-meta`, and in the Library table's rating columns.
- **Classification labels** — a small-caps, letter-spaced treatment (`.spine-label`) for genre and
  platform tags — uppercase, `letter-spacing: 0.06em`, small size, `Inter` at 600, not a filled pill.
  A filled badge would spend colour, and colour is reserved for the accent.
- **Captions** — `.stamp-label` is the same small-caps idea in the *metadata* family: monospace, without
  the spine's bottom rule. It labels a thing rather than classifying it — the "On this page" heading over
  a table of contents, or a `private`/`shared` state on a collection. Reach for `.spine-label` when the
  text says what a work *is*, and `.stamp-label` when it says what a block *is called* or *is currently*.

## Layout

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.5rem;
--space-6: 2rem;
--space-7: 3rem;
--space-8: 4rem;

--card-pad: 1.5rem;              /* standard inner padding for .card surfaces; exactly `p-6` */

--container-narrow: 480px;       /* max-w-narrow */
--container-reading: 720px;      /* max-w-reading */
--container-data: 960px;         /* max-w-data */

--rail-width: 15rem;             /* the desktop rail's width */
--tabbar-height: 3.75rem;        /* the mobile bottom tab bar's height */
--header-height: 3.5rem;         /* the slim brand bar above both */
```

**The spacing scale is Tailwind's, which is why the migration was mechanical rather than approximate:**
`--space-2/3/4` are `gap-2/3/4` exactly. The one to watch is `--space-5`, which is `1.5rem` and therefore
**`gap-6`, not `gap-5`**.

**`--nav-height` is gone, and splitting it was a bug fix.** One token named two unrelated things — a
desktop height and a mobile bar height — which is why the rail and the tab bar could not be sized
independently. They are now `--rail-width` (a width) and `--tabbar-height` (a height), and the tab bar
adds `env(safe-area-inset-bottom)` to both its own height and `main`'s bottom padding, so it no longer
sits under an iOS home indicator.

**Anything fixed to the bottom edge on mobile clears the bar *and* the inset — that is three separate
places, not one.** The tab bar's own height and `main`'s padding are two; `app-page-toc`'s back-to-top
button is the third, and it was the one that was missed, because it was written against the old
`--nav-height` and so read as a desktop concern. Its offset is
`calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-4))`. A fourth bottom-anchored
element would need the same treatment, and no test emulates a safe area, so this is the record.

- **Grid model**: a centered outer column (`.page-container`, `max-width: 1100px`, `margin: 0 auto`,
  horizontal padding `1.5rem` — `1rem` below the `sm` breakpoint), not a multi-column app-shell grid.
  Catalog uses a responsive card grid within that column
  (`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`); Library's table becomes a
  stacked card list on narrow viewports (see Components).
- **Measure**: `1100px` is the *shell*, not the reading measure. Each page sets its own inner
  `max-width` sized to its content, and **every one of them must also centre itself**
  (`margin-inline: auto`) — an inner column narrower than the shell that doesn't centre leaves the
  page visibly weighted to the left on wide viewports. The four permitted measures:

  | Token | Value | Used by | Why |
  |---|---|---|---|
  | `max-w-narrow` | `480px` | `/account`, `/profile/settings`, `/profile/followers`, `/profile/following`, and the `/u/:sub` equivalents | Form and settings pages, and single-column lists — one column of labelled controls or rows |
  | `max-w-reading` | `720px` | `/faq`, `/privacy`, 404, the two `collections` explainer cards | Long-form reading text |
  | `max-w-data` | `960px` | `/library`, `/profile`, `/u/:sub` | The data table, and the profile's stat grid — both need four columns to read as a grid rather than a list |

  **Each is a `--container-*` theme token, so `max-w-data` is the only spelling** and an arbitrary
  `max-w-[60rem]` stands out in review. `/profile` and `/library` share the data measure, and
  `e2e/layout.spec.ts` asserts they are *equal to each other* rather than to a literal — so changing the
  token moves both and the test still means something.

  **The reading measure is `max-w-reading`, not `max-w-prose`, and the name is load-bearing.**
  `max-w-prose` is a Tailwind **built-in static utility pinned to `65ch`**, and a `--container-prose`
  theme variable does *not* override it — both declarations land in the same emitted rule and the
  built-in comes last, so it wins:

  ```css
  max-w-prose{max-width:var(--container-prose);max-width:65ch}   /* the token loses */
  ```

  So while the token was named `prose`, every page carrying `max-w-reading`'s predecessor measured
  **656px** rather than the 720px documented here, and `--container-prose` was declared, emitted and
  greppable while nothing consumed it — the palette's characteristic defect (a token that still
  resolves) reappearing in the layout scale. Worse, `65ch` is a **font-dependent** measure in an app
  whose recorded incident is a layout measured 39px narrow in fallback font metrics; every other
  measure here is `px`. Renaming the token is the only fix, because a built-in static utility cannot
  be removed. **Do not rename it back to `prose`.**

  **`1000px` became `960px`, and that is forced arithmetic rather than taste.** At `xl` (1280px) the
  content column is `1280 − 240 (rail) − 48 (padding) = 992px`, so a 1000px measure clips. 960px fits
  with 32px spare and the four-column stat grid still lands (`4×200 + 3×16 = 848`).

  The old `640px` measure is retired — `/` and `/collections` were its only users and neither needed a
  fourth step. Don't introduce one without a reason not already covered above.
- **Breakpoints are `@theme` tokens: `sm: 480px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.** Tailwind
  resolves `--breakpoint-*` at build time, so in a template `lg:` *is* the token and there is no pixel
  value to typo. Note `sm` is **480px deliberately**, overriding Tailwind's 640px default, because this
  app's `sm` marks the point where `.page-container` padding tightens on a large phone.
  **A surviving component stylesheet still hand-writes its `@media` condition** — a `.css` file cannot use
  a variant — so when you write one, take the pixel value from this list rather than inventing a near-miss.
  The nav switch point is **`lg` (1024px)**, not `md`: Playwright's default `Desktop Chrome` viewport is
  1280×720, so putting the switch at `xl` would sit every unviewported test exactly on the boundary.
- Keep paddings/margins on the `--space-*` steps for a cohesive rhythm; don't introduce one-off
  pixel values for spacing that already has a step close enough.

## Elevation & Depth

**On a near-black canvas a drop shadow is a no-op, so depth is carried by lightness and an edge instead.**
`--color-canvas` sits at `L 0.18`; a shadow cast onto it has almost nothing left to darken. The old
three-step `--shadow-sm/md/lg` scale was built for a parchment ground and does not survive the inversion.

Depth is therefore **three surface levels plus a mandatory hairline**:

| Token | Role |
|---|---|
| `--color-canvas` | the page itself |
| `--color-surface` | a raised plane — cards, the rail, the tab bar |
| `--color-surface-2` | a plane raised above *that* — hover states, recessed wells, the sheet |

The steps are deliberately small (roughly 1.10:1 and 1.15:1 against each other), because a surface
ladder that reads as *contrast* starts competing with the content for attention. Lightness alone is not
enough to say where a plane stops, so **every raised surface also carries `1px solid var(--color-line)`**.
Lightness says "different plane"; the hairline says "this is where it ends".

`--shadow-overlay` is the one surviving shadow token, and it exists for the More sheet alone — something
that genuinely floats over the page rather than sitting in it.

- No glow, no coloured shadows, no blur-heavy "neumorphic" effects.
- **A z-index ladder, stated as tokens and enforced — never a literal:**

  ```css
  --z-header: 10;
  --z-back-to-top: 15;
  --z-tabbar: 20;
  --z-loading-overlay: 1100;
  ```

  **`stylelint` rejects any `z-index` that is not `var(--z-*)`** (bare `auto` and `0` aside), because a
  ladder documented in prose is a ladder nobody has to obey: the four rungs were literals in four
  different files, and a fifth added elsewhere would have joined at a number nobody chose. A collision
  only shows when two of them happen to overlap, which is exactly the defect that survives review.
  **Adding a rung means adding a token here first.**

  A modal `<dialog>` renders in the browser's *top layer*, above every z-index, so the sheet needs no rung
  at all. The loading overlay is **not** in the top layer, and it sits above the sheet on purpose: its
  whole job is to swallow input during an in-flight request, and a sheet drawn over it would accept taps
  it must not.

## Shapes

```css
--radius-sm: 4px;
--radius-md: 6px;
```

- **Radius stays small and restrained.** A heavily rounded UI reads as a friendly consumer app; this is
  an instrument for scanning a collection, and its edges should be quiet. `--radius-lg` exists for exactly
  one thing — the top corners of the More sheet, where the curve reads as "this slid up over the page".
- **A card is defined by its edge, not by a shadow.** `.card` is `--color-surface` with the mandatory
  hairline and a `3px` **neutral** top border; `.card-accent` recolours that border to `--color-accent`
  to mark an entry that deserves attention. That accent border is one of the few places chroma is spent,
  so it has to mean something.
  **The 3px lives on `.card`, not on `.card-accent`, and that is deliberate** — moving it to the variant
  would make an accented card 2px taller than its neighbours in a grid. The variant changes colour only.
  This is also the shape of a bug worth remembering: when the palette collapsed to one accent, `.card`'s
  border was `var(--color-primary)`, which now aliases the accent, so **both classes rendered identically
  and the variant silently stopped meaning anything.** Nothing failed; both tokens still resolved.
- **Cover art is the only saturated thing on the page, by design.** Every surface stays within `0.02`
  chroma of neutral precisely so a grid of 1:1 box art reads as the content and the chrome recedes.

## Components

- **`.page-section`** — the standard vertical rhythm between a page's top-level blocks. The most-used
  class in the app, on 16 components; promoted from *Layout utilities* on 2026-08-30 because leaving the
  single most-reused class outside Components meant the "declared exactly once" check could not see it.
- **`.form-actions`** — the trailing row of buttons on a form, used by Collections, Consoles and the
  public-collection view. Promoted alongside `.page-section` for the same reason.
- **`.card` / `.card-accent`** — the base surface primitive (see Shapes). Used by every status card,
  the Catalog grid item, and the Library page's mobile card-per-row layout.
- **`.btn-primary`** — solid `--color-accent` fill, `--color-on-fill` ink, `--radius-sm`. The default
  action button. **Never `#fff` for the ink** — see Colors.
- **`.btn-ghost`** — transparent fill, `--color-line-strong` outline, `--color-text-muted` text.
  Secondary actions. **`.btn-ghost-danger`** — the same shape with `--color-danger` text/border, for
  destructive actions (unfollow, remove a key, delete). The outline takes `line-strong`, not `line`,
  because it is the edge of a control and `line` fails WCAG 1.4.11 there.
- **`.btn-danger`** — solid `--color-danger` fill with `--color-on-fill` ink, for the *confirm* step of a
  destructive action only; the button that opens the confirmation is `.btn-ghost-danger`. It is a peer of
  `.btn-primary`, **not a modifier on it**: composing them produced danger-coloured text on the accent
  fill, measuring 1.41:1 and 1.15:1 in the two schemes against a 4.5:1 requirement — the least readable
  control in the app sitting on its most destructive action.
- **`.btn-sm`** — a smaller padding/font-size variant, composed with `.btn-primary`/`.btn-ghost`.
- **A group of three or more peer buttons is a grid, never `flex flex-wrap`.** Buttons are content-sized
  and `white-space: nowrap`, so a wrapping flex row spaces them by label length: the gaps are uniform
  while the buttons are not, which reads as arbitrary rhythm, and the last one drops to a row of its own
  as soon as the labels outgrow the measure. The home card showed exactly that — three buttons then a
  lone *Manage PSN Link* — and nothing about the arrangement was a decision. Use
  `grid grid-cols-1 sm:grid-cols-2 gap-3 w-full`: grid tracks are equal by construction, both button
  classes are `justify-content: center` so they centre inside a stretched track, and four actions fall
  into two rows of two with no orphan. **`w-full` is load-bearing** — these cards are
  `flex flex-col items-start`, so without it the grid shrink-wraps and the tracks are unequal again.
  `e2e/layout.spec.ts` asserts one distinct width and exactly two rows.

  **In such a group the first action is the primary one, and that is the only thing order encodes.**
  Home renders its four actions from a single array and marks `$first` as `.btn-primary`, so promoting an
  action is a reordering rather than a second class list to keep in sync — the same "one array, rendered"
  shape the nav uses. It earns its place immediately: while no PSN account is linked, the card says
  nothing has been catalogued and the filled primary pointed at **My Library**, a page that is empty
  precisely because of what the card just said. **Manage PSN Link** leads instead until `linked` is true.
  Note the promotion tests `linked === false` explicitly, not falsiness: `linked` is
  `boolean | null`, and `null` means the `/me` call degraded — offering the link step there would push
  PSN linking at someone who is already linked. `home.component.spec.ts` pins all three states and that
  exactly one action is primary.
- **Form inputs** (`input[type=text|email|password|number|search]`, `select`, `textarea`) — flat fill,
  `--color-line-strong` outline, `--radius-sm`, and a `--color-focus` ring with **`outline-offset: 2px`**,
  which is what makes the ring legible against a filled control. A new input `type` must be added to that
  selector list or it renders unstyled next to its neighbours — `search` was missing until the catalog,
  collection-item and manual-add search boxes exposed it.
- **`.spine-label`** — genre/platform classification tag (see Typography).
- **`.stamp-label`** — typed caption in the metadata family (see Typography). Live on the `app-page-toc`
  heading and the Collections visibility state. It exists because both had reimplemented the treatment
  by hand, at two different sizes and two different letter-spacings, without ever naming a class the
  primitive check could see.
- **`.size-source`** — the provenance tag on a packed size: which rung produced the `size_gb` it sits
  beside. `measured` takes `--color-ok`, `estimated` takes `--color-warn`, and the unmeasured rung takes
  the base rule's `--color-text-muted` with no modifier of its own. That base is the load-bearing part.
  Curator seeds estimate bands for PS5 and PS4 only, so every PS3, Vita, PSP, PS2 and PS1 title falls to
  the unmeasured rung — it is the **majority** case, not an edge one, and painting it `--color-danger`
  would render most of a catalogue as broken. It is ordinary metadata: the two known rungs are marked,
  and the unknown one is simply not. The label reads `not measured` rather than the raw `default` the
  wire carries, and the rung is mirrored onto a `data-size-source` attribute, which is what the two
  colour variants select on — the class carries the treatment, the attribute carries the value.
- **`.catalog-title` / `.catalog-meta`** — game title and stamped-metadata treatments (see
  Typography). Live in production on the Catalog grid, Collections list, and Library table.
- **`.catalog-list`** — a list of catalogued entries as a responsive card grid
  (`repeat(auto-fit, minmax(220px, 1fr))`), used by the Catalog grid, the Collections detail list and
  the public shared-collection view. It was byte-identical in all three component stylesheets before
  it was named here, which is the `.cover-art` failure repeating: a shared appearance that no
  primitive check could see, because the checker only knows the classes this section lists.
- **`.cover-art`** — box art on a catalogued entry, used by the Catalog grid, the game detail page,
  the Collections detail list, the Library table, and the public shared-collection view. Defined once
  in `styles.css` as square (`aspect-ratio: 1 / 1`, `object-fit: cover`, `--radius-sm`); each surface
  sets only its own width. It sits *beside* the `.catalog-title` rather than replacing it: the title is
  the catalog entry, the cover is provenance, so a row with no artwork must still read as a complete
  entry rather than a gap. Nothing stands in for a missing cover — no placeholder box, no silhouette,
  no "no image" label. The absence is not an error state and must not be dressed as one. The Library
  table's stacked layout below `md` keeps that relationship: its row is a two-column grid with the
  cover in the first column and the title beside it, and the cover cell carries no `data-label`
  because it is provenance rather than a captioned field.
- **`.item-unavailable`** — the one de-emphasis treatment (`opacity: 0.6`) for a catalogued entry that
  is present but not part of the result: an entry the owner no longer has access to, and a collection
  preview's *excluded* list. Composed onto `.catalog-card`, never a replacement for it — the entry still
  reads as an entry. It was declared twice byte-identically, plus a third time under a different name
  (`.excluded-list .catalog-card`) that said the same thing about the same cards, which is why the
  excluded list now composes this class directly and the wrapper name is gone.
- **`.psn-badge`** — PSN-linked-account indicator only (see Colors' `--color-psn` rule). A small dot
  + label in `--color-psn`.
- **`.stat-grid` / `.stat` / `.stat-head` / `.stat-value`** — a divided grid of label + figure stats,
  used by the profile overview. `.stat-grid` reflows **4 → 3 → 2 → 1 columns with no media query**
  (`repeat(auto-fit, minmax(200px, 1fr))`); at the `1000px` measure four tracks fit, and each narrower
  arrangement falls out of `auto-fit` rather than out of a breakpoint. `.stat` is hairline-divided by a
  `border-top` rather than boxed — the tiles are one table of figures, not a row of cards, so `.card` is
  deliberately *not* composed here. `.stat-head` pairs an `ng-icon` with a `.stamp-label` caption
  (`.stamp-label`, not `.spine-label`: the text says what the block *is called*, not what a work *is*).
  A tile whose value is unknown or not permitted **must not render at all** — but `0` is a real value
  and must render, so guards test `!== null`, never truthiness. Tiles that navigate are `<a class="stat">`
  and carry their own `aria-label`, because the visible label and figure read as two separate nodes.
  Two tiles carry prose and links in place of a `.stat-value` figure — the trophies-off notice and the
  "Elsewhere" list of declared PlayStation profiles. Both still satisfy the rule above: each renders
  only when it has something real to say, and neither is a figure with the number left out.
- **`.pager`** — the Previous / position / Next row under a paged list, used by the Catalog grid, the
  Library table and a collection's item list. Those three previously carried three bespoke names
  (`.catalog-pager`, `.library-pager`, `.collection-item-pager`) and agreed on nothing: one had no
  `align-items`, one had no rule at all, and the library's read `1171 game(s)` where the other two read
  `1–50 of 1171`. **`align-items: center` is load-bearing and must not be dropped** — without it the
  count `<span>` stretches to the buttons' height while its line box stays pinned to the top, so the text
  sits ~6px high. That failure is invisible to a test comparing element *centres*, because stretched
  children all report the same centre; assert the span's own height instead (~21.8px content-sized vs
  34.5px stretched). The position label is `from–to of total` in a `.text-muted` span, and the buttons
  are `.btn-ghost`.
- **`.quiet-scroll`** — a scroll container that scrolls without showing a scrollbar:
  `overflow-y: auto`, `overscroll-behavior: contain`, and the scrollbar hidden via `scrollbar-width: none`
  plus the `::-webkit-scrollbar` fallback. **This is nav chrome only — never content.** The desktop rail
  uses it because the brief asked for a mobile-app navigation idiom, and a mobile drawer does not carry a
  persistent scrollbar; the page's own scrollbar stays visible, because a reader of `/faq` needs to know
  how much is left. Measured cost of the alternatives on the rail: the default `auto` scrollbar consumes
  **16px** of layout width, `scrollbar-width: thin` **11px**, and hidden **1px** — and hiding changes
  nothing about scrolling itself, which still works by wheel, touch, keyboard and `scrollIntoView`.
  Moving the bar to the left instead (via `direction: rtl` on the container and a reset on every child)
  was measured too: it keeps the 11px cost, shifts the content 10px, and needs a `direction` override on
  each child, so it buys nothing the hidden bar does not.
- **`ng-icon`** — the icon element, from `@ng-icons/core` with glyphs out of `@ng-icons/lucide`
  (see Appendix: Iconography & Imagery for the pack decision and the concept-to-glyph map). Colour
  inherits from context and the glyph holds its size in a flex row, both defined once in `styles.css`;
  the default `1.5rem` size comes from `provideNgIconsConfig` in `app.config.ts`. Register glyphs per
  component through `provideIcons({ … })` in `viewProviders`, so unused ones tree-shake away — never
  register a whole pack. Every `ng-icon` carries
  `aria-hidden="true"`: the accessible name belongs to the control around it, which is why an
  icon-only nav link needs its own `aria-label`.
- **`app-site-nav`** (`src/app/nav/site-nav.component.ts`) — the single sitewide nav-link data source,
  rendered **three** ways from one array (`PRIMARY_NAV_LINKS`): a persistent left **rail** at `lg` and
  above, a fixed bottom **tab bar** below it, and a **More sheet** holding whatever the tab bar cannot.
  `tab: true` marks the four destinations that earn a tab; the rest fall to the sheet, so tabs ∪ sheet is
  always exactly the rail. Active route gets `routerLinkActive="nav-active"` → `--color-accent` text.
  **The rail replaced a horizontal header, and the reason is structural rather than aesthetic.** The old
  header lived inside `.page-container`, so its usable width was pinned at 963px for every viewport at or
  above 1100px — a wider window bought the nav no room, and each new destination ate into a fixed budget
  until the row wrapped. A vertical rail has no such budget: appending a ninth destination moves nothing
  sideways, which is why the admin and non-admin shapes can no longer diverge. That divergence was a real
  defect — `.nav-crowded` stripped labels for admins only, `admin.isAdmin()` resolved after first paint,
  and the header visibly re-laid-out about a second in. **Do not reintroduce a layout that varies with an
  async signal.**
  **The rail's failure mode is vertical, so the tests are too.** `e2e/nav.spec.ts` asserts a single
  column, `min(top) >= 0`, and `max(bottom) <= innerHeight` — a destination below the fold is a rail's
  version of a wrapped row — and it loops over viewport *height* rather than width.
  **The More sheet is a native `<dialog>`.** `showModal()` gives modal semantics, a focus trap, Escape,
  focus restore to the trigger, and `::backdrop` for free; only backdrop-click dismiss is written by hand.
  A component library was measured at +75 kB for the same behaviour and rejected. Two things the platform
  does *not* give: a `<dialog>` survives navigation, so the component closes it on `NavigationEnd`; and it
  renders in the browser's **top layer**, above every z-index — see Elevation for why `.loading-overlay`
  still has to sit above it.
  **`app-avatar` is eagerly loaded, deliberately.** It carried `loading="lazy"`, which is wrong for a 28px
  image that is always above the fold: the browser defers a request it will make anyway, and inside a
  `display: none` ancestor may never make it at all — measured, the avatar's `<img>` never reached
  `complete` while the chip was hidden. The `:host` box is pinned to `size` with `overflow: hidden`, and
  **that box is what makes eager loading safe**. It is also load-bearing for a second reason: a *broken*
  image renders its `alt` text at whatever width that text needs, and the alt is an email address — once
  measured at 294px against an expected 110px.
- **The signed-in chip** (`src/app/app.component.ts`) — it **lives in the header, not in the rail**
  (`app.component.html`, `app.component.css`), which is why it has its own entry: `app-site-nav` above no
  longer owns it, and a reader who goes looking for the chip under the nav component will not find it.
  It sat at the bottom of the rail until 2026-09-06, where a `10ch` cap inherited from the pre-rail
  horizontal header clipped an ordinary address to about nine characters. `.header-inner` was already
  `display: flex; justify-content: space-between`, so the chip right-aligns against the brand with no new
  layout rule, and above `lg` that edge is the viewport's own because `.header-inner` drops its
  `page-container` cap there. **The chip is deliberately not a link**: `/profile` is already a
  `PRIMARY_NAV_LINKS` destination, and a second affordance for it a few rows away is navigation noise. What
  the chip is for is saying *which* account is signed in.
  **The move also made it render at every width.** The rail is `display: none` below `lg`, so the chip used
  to be desktop-only; in the header it shares a ~350px row with the brand on a phone, which is why the cap
  is `16ch` below `sm` and `22ch` above it rather than one number. **Both are measured, not guessed:** at
  the narrowest viewport the cap must still render a full address, and the space available to it is whatever
  the brand leaves in that row. Measure the brand-to-chip gap before narrowing either value — the binding
  constraint is the brand's width, not the cap.
  **The cap is load-bearing and must not be deleted.** Without it the layout depends on how long the
  signed-in address is — the one unbounded, data-dependent element in the header, and an unbounded one there
  is exactly the pre-rail wrapping failure this layout exists to avoid. That used to be proved by deleting
  the cap and watching the row wrap; there is room to spare now, so a wrap-based test would pass against the
  very bug it exists to catch. **`e2e/nav.spec.ts` therefore asserts the cap directly** — computed
  `max-width` is not `none`, `overflow` is `hidden`, and the fixture address actually overflows it
  (`scrollWidth > clientWidth`) — plus a desktop assertion that the address never grows leftwards into the
  brand, and a mobile one that the chip stays inside the header and does not widen the document. **The
  fixture address is what keeps the first of those honest**: `e2e/fixtures.ts` builds it as
  `${sub}@test.invalid`, a GUID plus 13 characters, so it still overflows a `22ch` cap by a wide margin. Do
  not restore a wrap-based assertion, and re-measure rather than quoting a pixel figure — `--font-mono`
  changed with the redesign, so the `ch` unit no longer resolves to the old hard 82px.
  **The chip renders the whole address and lets the cap clip it**, rather than rendering a shortened form.
  A local-part-only chip reads better but costs the regression test its teeth: the e2e identity's address
  needs 196px uncapped while its local part needs 90px and fits, so nothing would fail if the cap were
  removed. `.user-email` carries a `title`, which is the only place a sighted user can read their own full
  address — truncation affects exactly the group the DOM-based accessibility argument does not cover.
- **`app-page-toc`** (`src/app/shared/toc/page-toc.component.ts`) — client-side-only in-page table
  of contents + back-to-top link, generated from a page's own headings via a CSS selector input.
  Used on `/faq` and `/privacy`.
- **`app-breadcrumb`** (`src/app/shared/breadcrumb/breadcrumb.component.ts`) — a small "go up" trail
  for nested sub-routes (`/profile/followers`, `/collections/:sub`, `/library/:sub`, `/u/:sub/...`)
  back to their logical parent (the owning profile). Not sitewide — the persistent nav handles
  top-level cross-navigation.
- **`app-loading-overlay`** (`src/shared/loading-overlay/loading-overlay.component.ts`) — a transparent
  full-viewport layer that swallows clicks and announces `aria-busy` while an in-page request is in
  flight. It deliberately does not dim the page: it exists to stop input, not to signal progress, and
  the content underneath stays readable. Takes a classic `@Input()`, not a signal input — the Vitest
  harness JIT-compiles without ngtsc, where signal inputs silently fail to bind (`NG0303`).
- **`app-rawg-attribution`** (`src/app/shared/attribution/rawg-attribution.component.ts`) — one muted
  line carrying a live hyperlink to RAWG. It is a licence term rather than a design choice: RAWG's API
  terms require attribution **and** "an active hyperlink from every page where the data of RAWG is
  used". **"Where the data is used" is the whole rule, so the line is conditional, never unconditional**
  — a page rendering no RAWG value must not claim RAWG as a source, which would be a false statement of
  provenance on a page that also states what it collects. Each host owns its own predicate, and they
  differ because the two APIs do: `/library` (and `/library/:sub`, the same component) asks
  `rawg_enriched`, the stored per-row flag Curator reads as a column and never reconstructs from the
  ratings, or a completed refresh listing `rawg_enriched_titles`; `/catalog` and `/catalog/:gameId` have
  no such flag on `GameSummaryResponse` and ask `critical_score !== null`, which is the value those
  pages label "RAWG". A component rather than three copies of the markup, because a legal notice that
  drifts between pages is worse than one that lives in a single file. It declares no class of its own
  and carries no stylesheet, so it reaches neither the primitive nor the fork gate.

## Do's and Don'ts

- **Do** keep `--color-accent` as the only colour driving buttons, links, focus rings and active-nav
  state. One accent is the whole point; a second one costs the first its meaning.
- **Do** keep every surface, line and text token within `0.02` chroma of neutral. This is checkable by
  reading the number.
- **Do** take the ink on any fill from `--color-on-fill`, and use `--color-line-strong` (never `line`)
  for the edge of anything a user can operate.
- **Do** keep radii small — `--radius-lg` is for the sheet's top corners and nothing else.
- **Do** maintain WCAG AA contrast (4.5:1 body text, 3:1 large text, 3:1 non-text per 1.4.11) for every
  pair **in both schemes**, and let `e2e/contrast.spec.ts` be what proves it.
- **Do** drive nav-link data from a single source (`PRIMARY_NAV_LINKS`) — never duplicate the link list
  between the rail, the tab bar and the sheet.
- **Don't** spend chroma on a surface. Cover art is the saturated thing on the page; chrome recedes.
- **Don't** reach for a drop shadow to express depth — the ladder is three surface levels plus a
  hairline, and `--shadow-overlay` exists for the sheet alone.
- **Don't** use gradients, glow, or neon — flat colour fills only.
- **Don't** use scale-up hover bounce or elastic easing — motion is deliberate, not springy (see
  Appendix: Motion).
- **Don't** add a manual light/dark toggle — the schemes are `prefers-color-scheme`-only.
- **Don't** use Tailwind's `dark:` variant. Dark is the *base*, so `dark:` either no-ops or inverts the
  model; the light scheme is a token re-binding, not a variant.
- **Don't** use `@theme inline` for a colour. It bakes the value into every utility and the light
  re-binding silently stops working.
- **Don't** use CSS to decide whether something renders, and don't key a selector off an attribute
  another feature owns (see Where styling lives).
- **Don't** grow the design language inside a component stylesheet — a reused appearance becomes a
  named primitive in `styles.css` plus a Components entry here, in the same change.
- **Don't** redefine a class named in Components inside a component stylesheet. One primitive, one
  definition; vary size and placement locally, never shape, radius, fit or colour.
- **Don't** vary a layout on an async signal. `admin.isAdmin()` resolves after first paint, and the
  header that keyed off it visibly re-laid-out a second in.
- **Don't** remove the underline from a link that sits inside a sentence. A link in a text block must be
  distinguishable from the prose around it by something other than colour (WCAG 1.4.1), unless the two
  colours differ by 3:1 — which an accent and body text on the same surface generally do not. `a` is
  underlined by default for exactly this reason; a link that is a **control** rather than prose (the
  brand, breadcrumb, rail and tab links, anything `.btn-*`) opts out with `no-underline`,
  because it is not in a text block and was never the violation.
- **Don't** render a rejected set identically to an accepted one. A collection preview's *excluded*
  list is what the filters turned down, not more of the collection; styled the same as the included
  cards it reads as part of the result and makes the stated count look wrong. It composes
  `.item-unavailable`, the same de-emphasis an entry the owner no longer has access to takes.

---

## Loading & hydration

**A data-backed route resolves its first payload before it activates; everything after that is an
overlay.** These are two different problems and each has exactly one answer.

- **First payload — route resolver.** A page that activates empty and fills in a moment later renders
  a placeholder the user reads, then replaces it. Worse, it makes "still loading" and "there is nothing
  here" indistinguishable, for the user and for tests alike. Resolvers remove the ambiguity by making
  activation wait.
- **Every later fetch — `app-loading-overlay`.** Paging, filtering, sorting and refreshing are still
  async, and the page is still unstable while they run. Keep the current data on screen and block
  interaction over it; do not blank the view back to a loading string. A user who can click a sort
  header mid-fetch can queue a request against a state that no longer exists.

**A resolver degrades, it never redirects.** Resolve to `null` on failure and let the component render
its own error state — there is rarely a better page to send someone to, and a failed navigation loses
the URL they were trying to reach.

Two consequences worth stating plainly, because both were live defects before this rule existed: there
is **no** "Loading…" text anywhere in a data-backed page, and no per-feature loading flag beyond the one
driving the overlay. If a page needs a second loading concept, that is a signal its first payload
belongs in a resolver.

## Where styling lives

### There is deliberately no `scroll-behavior: smooth`

Smooth scrolling is driven by animation frames, so anywhere frames are not running — a throttled
background tab, a stalled GPU process, a scroll-hijacking extension — the scroll is dropped entirely
rather than degrading to a jump. Anchor navigation and programmatic scrolls have to land
unconditionally, and the animation is not worth making them fail closed. This matters more here than
in most apps because `/faq` and `/privacy` are built around deep links to authored heading ids.

### Tailwind is imported as layers, and Preflight is deliberately not among them

`styles.css` opens with a `@layer` declaration and two imports rather than the usual single
`@import "tailwindcss"`:

```css
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
```

The one-line form additionally pulls in **Preflight**, Tailwind's base reset, which zeroes heading and
list defaults this stylesheet still relies on. That is a visual change with its own verification, so it
lands as its own step once the templates are converted — not alongside the tooling. **Collapsing these
three lines into `@import "tailwindcss"` is therefore not the tidy-up it looks like**; it restyles every
page.

**CSS decides how something looks. The component decides whether it exists.** Presence, absence and
conditional rendering belong in the template (`@if`), never in a selector that reaches into markup
shape to hide things. A rule like `td[data-label='Cover']:not(:has(img)) { display: none }` looks
economical and is the opposite: it couples two unrelated features through an attribute one of them
owns, and it buries a decision about what an entry *is* somewhere nobody looking for that decision
would think to search.

**A component stylesheet is now the last resort, not the first.** Under Tailwind the default home for a
page's own arrangement is **utilities in its template** — `flex flex-col gap-4 max-w-data mx-auto` says
what a one-off column is without inventing a class name that then has to be maintained, documented and
checked for forking. Four questions before writing any rule, in order:

1. **Can utilities express this?** Almost always yes for a page's own layout. The spacing scale maps
   exactly (`--space-2/3/4` are `gap-2/3/4`, `--card-pad` is `p-6`), and the page measures are theme
   tokens, so `max-w-data` stays greppable where `max-w-[60rem]` would not.
2. **Does a token already express this?** Use `var(--color-*)`, `var(--radius-*)`, `var(--container-*)`.
   A literal colour, a one-off pixel spacing, or a bespoke shadow is a defect, not a shortcut.
3. **Does a named primitive already express this?** `.card`, `.btn-*`, `.spine-label`,
   `.catalog-title`, `.catalog-meta`, `.cover-art`, `.psn-badge`. Reach for the vocabulary before
   inventing beside it.
4. **Is this actually structure rather than style?** If the rule's job is to make something disappear
   or appear, it is the component's job instead.

Appearance that repeats becomes a **new named primitive in `styles.css` with an entry in Components
above, added in the same change** — never a rule copied into a second component stylesheet.

**`.follow-list` and `.follow-list-entry` stay outside Components deliberately, and that is a decision
rather than an oversight.** They live in the *Layout utilities* block of `styles.css`, so only the fork
check guards them — not the stronger "declared exactly once" primitive check, which sees only what
Components lists. Usage decided it, measured across `src/` templates and `[class.x]` bindings 2026-08-30:
both are used by exactly two components, `profile-followers` and `profile-following`, which are one
feature's two faces rather than a shared vocabulary. Promoting a pair used by one feature would have the
vocabulary claim a generality it does not have.

`.page-section` (16 components, more than `.card`'s 15) and `.form-actions` (3, across unrelated features)
were promoted out of that block on the same measurement — the cost of promoting, that it constrains future
overrides, is smallest exactly where reuse is highest, since 16 call sites already treat `.page-section`
uniformly and a divergence would be a bug today rather than a freedom given up.

**What still justifies a component stylesheet**, since some do survive: an `@keyframes` block, a rule
that must reach an element the template cannot address (a descendant of projected content), or a
genuinely page-specific responsive table. `.status-card` was none of those — it was `card` plus padding
plus a start-aligned column, duplicated across four files with drifting `gap`, and it became four
utilities at each call site.

**One class of coupling to check before deleting a class as "just styling":** a class can be a *selector
contract*. `app-page-toc` addressed `/faq` and `/privacy` through `headingSelector=".privacy
.privacy-section h2"`, so removing those classes would have silently emptied both tables of contents.
Those pages now expose an `id` instead, which cannot be restyled away.

### One primitive, one definition

**Every class named in Components is defined exactly once, in `styles.css`.** A component stylesheet
may position a primitive and size it; it may not restate what the primitive *is*. The moment a second
file declares the same class, the vocabulary has forked and the two copies will drift apart silently —
nothing fails, nothing warns, and the divergence only surfaces when someone compares two pages.

This is not hypothetical, and `.cover-art` is the worked example. It was listed in Components, and it
existed in **no** shared stylesheet: four component files each declared it independently. Only one of
them constrained `aspect-ratio`, so a non-square source distorted the layout everywhere else; three
carried a `var(--radius-sm, 4px)` fallback for a token that is always defined; and the Catalog grid
used the class while declaring no rule for it at all, rendering box art stretched (`object-fit: fill`)
with square corners. Nobody broke a rule, because no rule existed.

Two consequences worth stating plainly:

- **Using a class the current component doesn't define is not a bug — it is the point.** Global
  primitives are global. If a class appears unstyled, the fix is to define it once in `styles.css`,
  never to paste a local copy.
- **A per-page variation is a modifier, not a redefinition.** Size and placement differ legitimately
  between a 48px table thumbnail and a 320px detail image; shape, radius, fit and color do not.
  Express the difference as a modifier class or a local width, and leave the primitive alone.

### Curator's vocabulary tokens are rendered verbatim; only the column is capped

Curator's `genre` values are raw vocabulary tokens — `ROLE_PLAYING_GAMES`,
`MUSIC/RHYTHM` — and **every surface renders the token exactly as it arrives.** There are six of them:
the Catalog card's `.spine-label`, the Catalog Genre filter's options, the Library table's Genre
cell, the Library genre filter's options, the collection builder's genre listbox, and the two
routing-genre listboxes on `/consoles`. **Do not add a display-name lookup on the Librarian side.** The
token is simultaneously the label and the value the filter posts back: `<option [value]="option">{{
option }}</option>` submits that same string as the `genre` parameter, so a prettified label needs a
parallel key-to-label table, which is a second source of truth for a vocabulary that is deliberately
data. The token is the fact; a nicer spelling of it is a claim.

**What the raw token costs is layout, and only in the Library table.** Under `table-layout: auto` a
column is sized from its widest cell's max-content width, so one `ROLE_PLAYING_GAMES` anywhere in the
page sets the Genre column for every row and takes space the header row needs. That is the one place
the presentation layer pushes back, and it does so **in CSS, on the displayed text only**:

- **`.library-genre` caps the cell content at `12ch` and ellipsises it.** `12ch` is the measure a
  readable label (`Role-playing`) would have needed, so the column keeps the budget the rejected mapping
  would have spent and the token clips inside it.
- **The cap sits on a `<span>` inside the `<td>`, never on the `<td>`.** CSS 2.1 §17.5.2 leaves the
  effect of `max-width` on a table cell **undefined**, and the automatic table layout algorithm is free
  to ignore it. An ordinary inline-block inside the cell has no such exemption, and the column then
  sizes to the capped span.
- **CSS truncates; TypeScript must not.** A sliced string loses the token from the DOM, and with it the
  accessible name, in-page find, and copy-paste. An ellipsis keeps the whole value where every consumer
  of the page can still reach it. The span also carries a `title`, on the `.user-email` precedent — a
  sighted user has no other way to read what was clipped.
- **The cap is two-sided and the spec proves both sides.** `library.spec.ts` asserts the raw token
  clips (`scrollWidth > clientWidth`), that an ordinary genre does **not** (a cap tight enough to
  clip `Action RPG` is a regression, not a fix), and — clearing `max-width` at runtime and re-measuring
  the header — that the column is genuinely narrower with the cap than without it. Without that control
  run the first assertion would pass against a cap that does nothing.

**Nothing else is truncatable, and that is a measurement rather than a decision.** A native `<option>`
renders its text in UA chrome that `text-overflow` cannot reach, so the two `<select>` filters could not
be capped even if they needed it — and they do not: `styles.css` gives every `select` `width: 100%`, so
both the single-selects and the two multi-selects take their container's width and no option can widen
them. The Catalog card's `.spine-label` is measured instead of assumed: `catalog.spec.ts` asserts the
raw token's rendered width fits a card at the grid's own `minmax(220px, 1fr)` floor, which is the
narrowest tile the layout can produce.

**Measuring how wide a piece of text renders is not `scrollWidth`, and the first version of that spec got
it wrong.** `.spine-label` is a flex item stretched to its line, so `scrollWidth` reported the *box* —
440px on a wide viewport — and the assertion failed against a token that fits comfortably. The text's own
width comes from a `Range` over the element's contents; the spec pairs it with a `> 0` assertion, because
a `Range` that selects nothing measures zero and would satisfy any "it fits" bound.

### The nine surviving component stylesheets, one at a time

The Tailwind v4 migration was asked to reach zero custom CSS and did not. Nine component stylesheets
survive. **A justification written about the group is worth nothing** — "they all need a hand-written
`@media` query" is true of most of them and false of some, and once written nobody re-reads the files.
So the reason is recorded per file, and where the reason is weak this says so rather than dressing it up.

Measured over `src/**/*.component.css` **after the `.library-genre` cap above was added**:
**545 lines across 9 files**, 471 excluding blanks (re-measured 2026-08-29, after the `page-size`
control run took its dead `width: auto` out and added a line of comment). Re-measure before quoting
either figure; a count of this shape is a timestamp, not a fact.

**The cascade, not specificity, is what decides whether a utility can replace a rule here — check it
before proposing a deletion.** `styles.css` authors its element defaults *outside* any cascade layer,
while `@import 'tailwindcss'` emits utilities inside `@layer utilities`. Un-layered CSS outranks every
layer regardless of selector specificity, so a `w-auto` class on a `<select>` does **not** beat
`select { width: 100% }`. Verified in the built bundle: the app rule is un-layered, the first utility is
in `utilities`. "A template utility out-specifies it" is therefore the wrong test.

**And the rule is bounded, so it does not excuse every stylesheet.** The complete set of bare element
selectors `styles.css` authors un-layered, read off the built bundle, is:

```
body   h1 h2 h3 h4   p   a   code
input[type=text|email|password|number|search], select, textarea   (+ their :focus)
```

Nothing else — no `label`, no `li`, no bare `input`. A component rule that targets one of *those*
elements cannot be moved to the template (that is `page-size`, and the two cancellations below). A
component rule that targets a class, a `label`, an `li`, or a checkbox competes on ordinary specificity
and **can** be a utility — which is why the bottom three rows below stay "None — a finding" rather than
being reclassified by this note.

| File | Lines | What Tailwind cannot express here | Strength |
|---|---|---|---|
| `shared/avatar/avatar.component.css` | 14 | **`:host`.** A component cannot put a class on its own host element from its own template. The box pinned to `size` with `overflow: hidden` is what makes eager loading safe (see Components → `app-site-nav`), so it has to exist somewhere. | Definitive |
| `app/nav/site-nav.component.css` | 168 | **`::backdrop`.** The sheet's backdrop is not an element, so no class can reach it; the `<dialog>`'s own rules sit beside it. | Definitive |
| `library/library.component.css` | 185 | **The responsive table**, plus **`::backdrop`**. Below `md` the whole table is restructured — `thead` hidden, `table`/`tbody` to `block`, `tr` to a two-column grid — and those are bare structural elements the `@for` emits with no class to hang a variant on. `td[data-label]::before { content: attr(data-label) }` is the caption that replaces the hidden header. Ten rules that only mean anything read together. The Store-match dialog adds the sheet's own argument (`.store-match::backdrop` reaches something that is not an element) and one more a utility cannot express: a `<dialog>` is `width: fit-content` and centres by UA `margin: auto`, so its measure has to sit on the element rather than on a wrapper inside it. Also holds `.library-genre` (above) and the two cancellations below. | Strong |
| `shared/page-size/page-size.component.css` | 17 | **A cancellation of an un-layered global, plus `:host`.** `styles.css`'s bare `select` rule (un-layered) sets the **body font size**, and a Tailwind utility in `@layer utilities` cannot outrank it — see the cascade note above. Remove the `font-size` line and the control renders 16px beside the pager's 13.6px count; `e2e/layout.spec.ts` asserts the two match, and that assertion was proven red by deleting the line. **The same rule's `width: 100%` needs no cancelling here, which is measured rather than assumed** — a `width: auto` was carried for it and deleted once the control run showed the select is 49px either way: it is a flex item of the `:host` box, so the percentage already resolves to content width. Contrast `.library-genre-filter` below, where the identical global *does* bite because that select is not a direct flex item. The `:host` block is `avatar`'s argument: a component cannot class its own host, and both callers drop this into a flex pager. `whitespace-nowrap` on the label fights no global and so lives in the template. | Definitive |
| `app/app.component.css` | 55 | **`z-index: var(--z-header)`.** Everything else in this file is expressible as utilities on elements the template already owns. `lint:css` reads `src/**/*.css` only, so a `z-[var(--z-header)]` utility in a template would leave the stacking-ladder gate entirely. Three of the four rungs are held this way. | Narrow — the z-rung only |
| `app/shared/toc/page-toc.component.css` | 12 | **`z-index: var(--z-back-to-top)`**, same argument. The `bottom: calc(… env(safe-area-inset-bottom) …)` beside it is the whole rest of the file, and nothing about it needs a stylesheet's reach. | Narrow — the z-rung only |
| `psn/psn-settings.component.css` | 62 | **Nothing.** Descendant rules over the section's 13 `<label>`s, its `<input>`s and the action-history `<li>`s. Every one has a utility equivalent; the file buys DRY, not reach. | None — kept for DRY |
| `consoles/consoles.component.css` | 16 | **Nothing.** One rule gives every label inside the page's four `.entity-form`/`.entity-edit-form`s its `flex flex-col gap-1 font-semibold` shape, each one wrapping its own control. Same trade. | None — kept for DRY |
| `collections/collections.component.css` | 16 | **Nothing.** The form's layout and its labels' weight, plus `.sort-active`'s two colour tokens, which a pair of `[class.…]` bindings could carry. | None — kept for DRY |

**The bottom three are a finding, not a justification.** They can be removed: each rule has a utility
equivalent, and the only thing lost is a single declaration standing in for a dozen repetitions of the
same four utilities. That is a real cost and a legitimate reason to defer, but it is not "Tailwind cannot
do this" and must not be recorded as if it were. Deleting them changes rendering, so it is its own change
with its own verification pass, not a tidy-up to fold into something else.

**`app.component.css` and `page-toc.component.css` are a narrower finding.** Both would collapse to two
or three utilities apiece if the z-index rung moved with them — and moving it is what makes it
unacceptable, because `stylelint`'s `z-index must use a var(--z-*) token` rule cannot see a template. A
utility-only Librarian therefore needs the ladder enforced somewhere else first. Adding a rung is still
"add the token to Elevation & Depth, then use it in a `.css` file".

### Declarations that look removable and are not

A rule in a component stylesheet can exist to *cancel* a global default, so it reads as noise and deletes
cleanly with no visible failure — until the page is measured. This one was a live defect found by an
exploratory pass, and it is the reason the global rule is safe to keep.

- **`.library-genre-filter { flex: 0 1 14rem; min-width: 10rem }`.** `styles.css` gives every
  `select` `width: 100%`. Without its own flex basis this one inherits that, takes a whole line to
  itself inside `.library-controls`, and opens a native dropdown as wide as the card. Its two
  neighbours (`.library-search`, `.library-mobile-sort`) already carry the same pair — this one was
  simply missed, which is why it alone broke, and only above the `md` breakpoint.
- **`.library-table th { white-space: nowrap }`.** The sort arrow is a separate `<span>` after a space,
  so a narrow column orphans it onto its own line and doubles the header row's height.
  `.library-table-scroll` already has `overflow-x: auto`, so a header row that no longer fits scrolls
  instead of wrapping — which is the intended behaviour, not a regression.

### Enforcing it

This erodes one reasonable-looking exception at a time, so it is worth enforcing mechanically rather
than remembering. A stylelint rule capping component stylesheets to layout properties — and requiring
color, typography, radius and shadow to come from `var(--*)` — turns the review habit into a CI gate.
A second, cheaper check catches the failure above directly: every class named in this document's
Components list must appear exactly once across `src/**/*.css`, and that once must be `styles.css`.

## Appendix

Content below isn't part of the design.md spec's own section vocabulary, but is kept here as
project-specific guidance that doesn't fit neatly into any of the sections above.

### Motion

Deliberate, not springy. `200ms ease-out` for hover/focus/expand transitions (implemented in
`styles.css`'s form-input, `.btn-primary`, and `.btn-ghost` transitions, plus the Catalog card hover
lift and the mobile tab bar's active-state color change) — the feel of sliding a card out of a
drawer or turning a page, not a bounce. No scale-up hover effects beyond a small `-2px` lift on the
Catalog grid, no elastic easing. Loading states use a simple fade/dim rather than spinners styled as
gamified progress bars. `prefers-reduced-motion: reduce` collapses all transition/animation durations
to near-instant globally (`styles.css`).

### Iconography & Imagery

**The pack is Lucide** (`@ng-icons/lucide`, ISC), delivered through `@ng-icons/core` — the only delivery
mechanism peering `@angular/core >=22` (`lucide-angular` itself caps at `13.x - 21.x` and will not install
against this app). Import from the **package root**; unlike the previous pack there is no `/regular`
subpath.

The earlier prohibition on gamepad and controller motifs is retired along with the rest of the old
identity, so `lucideGamepad2` is available if it is genuinely the right glyph. What replaces the rule is a
constraint that is actually testable: **Catalog, Collections and Library sit adjacent in the tab bar at
24px and must read as three different things there.** They therefore take structurally unrelated
silhouettes — a grid, an open folder, a stack of spines — rather than three variations on a rectangle.
Check a new glyph at 24px against its neighbours, not at 48px on its own.

Colour inherits from context and the glyph holds its size in a flex row, both defined once in
`styles.css`; the default `1.5rem` size comes from `provideNgIconsConfig` in `app.config.ts`. Register
glyphs per component through `provideIcons({ … })` in `viewProviders` so unused ones tree-shake away —
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

**The preference is flat reporting, and it is a preference rather than a ban.** An earlier version of this
section prohibited exclamation points, "storefront language", and gamified framing outright; those rules
were retired with the identity reset that produced the current palette. What survives is the reason they
existed: a curation tool states what is true and lets the reader draw the conclusion. "Trophies earned /
180" is a count; "You've earned 180 trophies!" is a celebration, and celebrating is not this app's job.

PSN's own domain nouns — trophy, tier, level, *earned* — are the names of the data being reported, and
reporting them flatly is not gamification. An even earlier draft banned the verb "earn" entirely, which
was an over-reach: production already violated it on the profile page, and obeying it would have forced a
worse paraphrase of PSN's own term.

### Accessibility

- All text/background pairs in **both schemes** must hold WCAG AA contrast (4.5:1 body, 3:1 large text).
- **Icons, borders and control edges are non-text content and answer to WCAG 1.4.11: 3:1 against their
  own background**, not the 4.5:1 body-text bar. This is exactly why `--color-line` and
  `--color-line-strong` are two tokens rather than one: `line` measures 1.42:1 on `surface`, which is
  correct for a divider between rows and a failure the moment it becomes the edge of an input. The
  tightest pair in the palette is `line-strong` on `surface-2`; re-measure it before touching either
  token. An icon that is the *only* carrier of meaning (an icon-only rail link, a status glyph) also
  needs a text alternative — see the `ng-icon` entry in Components.
- Focus rings use `--color-focus` **with `outline-offset: 2px`**, from a single global `:focus-visible`
  rule in `styles.css`. The offset is what makes them legible: the same ring sitting directly on an accent
  fill is far tighter than the same ring offset onto the surface behind the control. Because the offset
  paints on that surface rather than on the control, `e2e/contrast.spec.ts` measures the ring against
  **`canvas`, `surface` and `surface-2`** — canvas alone would leave the rail and the cards unmeasured.
  Text inputs are the one deliberate exception: they set `outline: none` and take `--shadow-focus`
  instead, because a ring offset outside a bordered field reads as a second border.
  Never rely on colour alone for a state — error and success text carries an icon or a label
  too, which is also why success is the accent rather than a second hue.
- `prefers-reduced-motion` collapses all transitions/animations to near-instant, wired globally in
  `styles.css`.

---

This document is the source of truth for all future Librarian UI work, and is linked from both
`AGENTS/Librarian.md` and the repo `README.md` so it is reachable from wherever someone starts. Any
new page or component should be checked against it before merging, the same way `DESIGN-LANGUAGE.md`
governs testing conventions at the workspace root.

Librarian is a working multi-page app, not the two-page (Home, PSN settings) state this document once
described. The live route list is `src/app/app.routes.ts` — read it there rather than restating a
count here, which is exactly the kind of number that rots quietly (it did: this paragraph claimed 17
routes long after there were 21).
