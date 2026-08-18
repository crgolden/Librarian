---
version: alpha
name: Librarian — Reading Room / After Hours
colors:
  primary: "#1F4D3D"
  primaryDark: "#163B2E"
  neutral:
    bg: "#F6F1E7"
    surface: "#FFFDF8"
    surfaceAlt: "#EFE7D8"
    text: "#241C15"
    textMuted: "#7A6F5E"
    border: "#E4D9C5"
  semantic:
    error: "#A3342A"
    errorHover: "#82291F"
    errorContrast: "#FFFDF8"
    success: "#3E6B4F"
    warning: "#B8752E"
  accent: "#B4790A"
  psn: "#2C4A7C"
  afterHours:
    primary: "#3E7A5C"
    primaryDark: "#316148"
    accent: "#D4A017"
    psn: "#4C6FA5"
    neutral:
      bg: "#19140F"
      surface: "#241C15"
      surfaceAlt: "#2E251C"
      text: "#EDE3D3"
      textMuted: "#A6957D"
      border: "#3A2E22"
    semantic:
      error: "#CB7367"
      errorHover: "#D1847A"
      errorContrast: "#19140F"
      success: "#5FA57E"
      warning: "#D99A4E"
typography:
  h1:
    fontFamily: Lora
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.25
  h2:
    fontFamily: Lora
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.25
  h3:
    fontFamily: Lora
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.25
  h4:
    fontFamily: Lora
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  catalogTitle:
    fontFamily: Lora
    fontStyle: italic
    fontWeight: 600
  catalogMeta:
    fontFamily: IBM Plex Mono
    fontSize: 0.85rem
  stampLabel:
    fontFamily: IBM Plex Mono
    fontSize: 0.8rem
    fontWeight: 400
    letterSpacing: 0.06em
    textTransform: uppercase
  spineLabel:
    fontFamily: Inter
    fontSize: 0.7rem
    fontWeight: 600
    letterSpacing: 0.06em
    textTransform: uppercase
---

# Design Language

## Overview

Librarian is not a storefront and not a companion app. It is a personal archivist for a PlayStation
collection — the same relationship a librarian has to a collection of books: custodianship,
classification, provenance, care. Every design decision below is a consequence of taking that
metaphor seriously rather than treating it as a naming pun.

This has two direct implications:

1. **Librarian does not borrow PlayStation's brand identity.** A blue-and-black reskin would read as
   an unofficial reproduction of Sony's own visual system, and it would also be the less interesting
   design — it says "PlayStation app" instead of saying anything about what this particular tool is
   for. PlayStation Network is a data source Librarian connects to, not Librarian's own identity.
   Where PSN needs to be acknowledged visually (a linked-account indicator, for instance), it gets a
   single restrained accent color — never the dominant palette.
2. **Librarian does not borrow generic SaaS/dashboard identity either.** Rounded cards, indigo
   gradients, and Inter-everywhere is the default look of every admin panel and B2B product built in
   the last decade. It's neutral to the point of saying nothing. A library card catalog has a
   specific, tactile visual vocabulary — paper, ink, cloth binding, brass fixtures, stamped dates,
   spine labels, hand classification — and that vocabulary is distinct enough to build a real
   identity from.

Concretely: every game in the collection is treated like a cataloged volume. It has a title (set in
a serif, sometimes italicized the way a card catalog italicizes a work's title), a classification
(genre, rendered as a spine label), and provenance metadata (acquired date, platform, completion
state — rendered in a monospace, like a stamped index card). The UI's job is to make a game
collection feel *catalogued*, not *merchandised*.

Instead of a generic light/dark theme pair, Librarian has two color moods, each named for what it
evokes, both driven by the same `prefers-color-scheme` mechanism (no JS toggle, and none should be
added — see Do's and Don'ts):

- **Reading Room** (light) — daytime, parchment and ink. A library reading room: cream paper,
  warm dark ink text, forest-green shelving, brass accents.
- **After Hours** (dark) — a reading room after the lights go down except for a desk lamp: deep
  walnut brown (not neutral gray, not blue-black), warm off-white text under lamplight, the same
  green/brass accents brightened just enough to read as lit rather than muted.

Both rooms use warm neutrals (paper/wood undertones), never cool neutral grays — that warmth is
what separates "library" from "generic app shell." Pure black/white and pure gray were deliberately
rejected everywhere in this palette.

## Colors

```css
:root {
  /* Reading Room (light) */
  --color-bg: #F6F1E7;              /* parchment */
  --color-surface: #FFFDF8;          /* index card */
  --color-surface-alt: #EFE7D8;      /* recessed / hover surface */
  --color-text: #241C15;             /* ink */
  --color-text-muted: #7A6F5E;       /* pencil */
  --color-border: #E4D9C5;           /* card edge */

  --color-primary: #1F4D3D;          /* library green — leather, shelving, brass fixtures */
  --color-primary-dark: #163B2E;
  --color-primary-rgb: 31, 77, 61;

  --color-accent: #B4790A;           /* brass / gold-leaf title */
  --color-accent-rgb: 180, 121, 10;

  --color-psn: #2C4A7C;              /* muted cobalt — PSN-linked state ONLY, never primary UI */
  --color-psn-rgb: 44, 74, 124;

  --color-error: #A3342A;            /* oxblood ink, not stop-sign red */
  --color-error-rgb: 163, 52, 42;
  --color-error-hover: #82291F;      /* solid destructive hover — moves AWAY from the text colour */
  --color-error-contrast: #FFFDF8;   /* text ON an error fill — never assume white works */
  --color-success: #3E6B4F;          /* same family as primary, darker/desaturated */
  --color-warning: #B8752E;          /* same warm-ink family, between accent and error */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* After Hours (dark) */
    --color-bg: #19140F;             /* walnut, near-dark */
    --color-surface: #241C15;
    --color-surface-alt: #2E251C;
    --color-text: #EDE3D3;           /* lamp-lit page */
    --color-text-muted: #A6957D;
    --color-border: #3A2E22;

    --color-primary: #3E7A5C;
    --color-primary-dark: #316148;
    --color-primary-rgb: 62, 122, 92;

    --color-accent: #D4A017;
    --color-accent-rgb: 212, 160, 23;

    --color-psn: #4C6FA5;
    --color-psn-rgb: 76, 111, 165;

    --color-error: #CB7367;
    --color-error-rgb: 203, 115, 103;
    --color-error-hover: #D1847A;
    --color-error-contrast: #19140F;
    --color-success: #5FA57E;
    --color-warning: #D99A4E;
  }
}
```

**Usage rules:**

- `--color-primary` (library green) is the workhorse: primary buttons, links, focus rings, and the
  active/current-route state in `SiteNavComponent` (desktop header and mobile bottom tab bar alike).
  It is the app's actual identity color.
- `--color-accent` (brass) is reserved for things that deserve to look *cataloged and valuable* —
  a title treatment, a "featured" or "recently acquired" marker (e.g. the Catalog grid's `AAA`-tier
  card top-border), a rating/score display. Used sparingly, never as a background fill.
- `--color-psn` exists **only** to indicate "this data/state came from or reflects your linked PSN
  account" — a small badge, a linked-account status line, a PSN-sourced data attribution. It must
  never become the button color, the nav color, or a decorative brand nod.
- `--color-warning` follows the same warm-ink-family rule as error/success — used sparingly for
  non-error caution states (e.g. an enrichment key that's saved but hasn't been validated yet).
- `--color-error` / `--color-success` stay in the same warm-ink family as everything else (oxblood /
  moss) rather than stock red/green, so validation states don't look like they were dropped in from
  a different design system.
- **`--color-error-contrast` is the text colour to put *on* an error fill, and it is not white in both
  rooms.** After Hours brightens error the same way it brightens primary and accent — error had been
  left behind at `#C1584A`, which reads at only 3.80:1 against the dark surface and fails AA for its
  own label. Lifting it to `#CB7367` clears that at 4.94:1, but a lighter fill then leaves white text
  at 3.39:1, so the dark room puts near-black ink on the fill instead (5.39:1). Reading Room keeps
  paper-white on oxblood at 6.81:1. Never hardcode `#fff` on a destructive button — take the token.
- **`--color-error-hover` moves away from the text colour, which means it darkens in one room and
  lightens in the other.** Reading Room has paper text on an oxblood fill, so hover darkens to
  `#82291F`; After Hours has ink text on a lifted fill, so hover *lightens* to `#D1847A`. Naming it
  `--color-error-dark`, by analogy with `--color-primary-dark`, produced a 3.75:1 hover in the dark
  room — the token has to name its role, not its direction. Every danger pair in both rooms now clears
  AA, worst case 4.94:1.
- **No JS light/dark toggle.** The two rooms are driven entirely by `prefers-color-scheme`. Do not
  reintroduce a manual toggle — this has been discussed and rejected; it complicates state
  management for no benefit this app needs.

## Typography

| Level | Font | Size | Weight | Line height | Use |
|---|---|---|---|---|---|
| h1 | Lora | 2.25rem | 700 | 1.25 | Page titles |
| h2 | Lora | 1.5rem | 700 | 1.25 | Section headings |
| h3 | Lora | 1.25rem | 700 | 1.25 | Card/subsection headings |
| h4 | Lora | 1.125rem | 700 | 1.25 | Minor headings |
| body | Inter | 1rem | 400 | 1.6 | Everything else |
| `.catalog-title` | Lora | inherit | 600, italic | inherit | Game titles — italicized like a card catalog's title entry |
| `.catalog-meta` | IBM Plex Mono | 0.85rem | 400 | inherit | Stamped metadata: dates, PSN ids, ratings, completion % |
| `.stamp-label` | IBM Plex Mono | 0.8rem | 400, uppercase, `letter-spacing: 0.06em` | inherit | Typed captions: a heading over a block, a state stamped on a record |
| `.spine-label` | Inter | 0.7rem | 600, uppercase, `letter-spacing: 0.06em` | inherit | Genre/platform classification tags |

```css
--font-heading: 'Lora', Georgia, serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-meta: 'IBM Plex Mono', ui-monospace, monospace;

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

- **Headings & game titles** — `Lora` (serif). Game titles get their own treatment, italicized the
  way a library catalog italicizes the title of a cataloged work. Series/edition subtitles use the
  same serif at a smaller size, roman (not italic), the way a catalog card lists an edition note
  under the italicized title.
- **Body** — `Inter`. A clean, quiet reading face that doesn't compete with the serif.
- **Metadata / catalog numbers** — `IBM Plex Mono` for anything that reads like a stamped catalog
  entry — acquisition dates, PSN account identifiers, completion percentages, platform codes,
  ratings. This is the detail that sells the "index card" metaphor: metadata should look *typed*,
  not styled. Live in `.catalog-meta`, and used in the Library table's rating columns.
- **Classification labels** — a small-caps, letter-spaced treatment (`.spine-label`) for genre and
  platform tags, evoking a book spine label or a card-catalog subject heading — uppercase,
  `letter-spacing: 0.06em`, small size, set in `Inter` at 600 weight, not a filled pill/badge.
- **Typed captions** — `.stamp-label` is the same small-caps idea in the *metadata* family: monospace,
  and without the spine's bottom rule. It labels a thing rather than classifying it — the "On this page"
  heading over a table of contents, or a `private`/`shared` state stamped on a collection. Reach for
  `.spine-label` when the text says what a work *is*, and `.stamp-label` when it says what a block or a
  record *is called* or *is currently*.

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

--card-pad: 1.5rem;    /* standard inner padding for .card surfaces */
--nav-height: 60px;    /* desktop header height; also the mobile bottom tab bar's height */
```

- **Grid model**: a centered outer column (`.page-container`, `max-width: 1100px`, `margin: 0 auto`,
  horizontal padding `1.5rem` — `1rem` below the `sm` breakpoint), not a multi-column app-shell grid.
  Catalog uses a responsive card grid within that column
  (`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`); Library's table becomes a
  stacked card list on narrow viewports (see Components).
- **Measure**: `1100px` is the *shell*, not the reading measure. Each page sets its own inner
  `max-width` sized to its content, and **every one of them must also centre itself**
  (`margin-inline: auto`) — an inner column narrower than the shell that doesn't centre leaves the
  page visibly weighted to the left on wide viewports. The four permitted measures:

  | Measure | Used by | Why |
  |---|---|---|
  | `480px` | `/psn`, `/profile*` | Form and settings pages — single column of labelled controls |
  | `640px` | `/`, `/collections` | Prose plus a short list |
  | `720px` | `/faq`, `/privacy`, 404 | Long-form reading text |
  | `1000px` | `/library` | The one data table wide enough to need it |

  Don't introduce a fifth value without a reason that isn't already covered above.
- **Breakpoint scale** (CSS custom properties can't be read inside `@media` conditions, so these
  pixel values are what every `@media` query in this app should use directly): `sm: 480px` (large
  phone — tighter `.page-container` padding), `md: 768px` (tablet — the nav pattern switch point:
  desktop header nav above, bottom tab bar below), `lg: 1024px`, `xl: 1280px`.
- Keep paddings/margins on the `--space-*` steps for a cohesive rhythm; don't introduce one-off
  pixel values for spacing that already has a step close enough.

## Elevation & Depth

```css
--shadow-sm: 0 1px 2px rgba(36, 28, 21, .10), 0 1px 1px rgba(36, 28, 21, .06);
--shadow-md: 0 6px 16px rgba(36, 28, 21, .12), 0 2px 4px rgba(36, 28, 21, .08);
--shadow-lg: 0 10px 30px rgba(36, 28, 21, .14), 0 4px 8px rgba(36, 28, 21, .08);
```

(After Hours/dark values use black-based rgba at higher opacity — see the Colors block's dark
`@media` section; the same three-step scale applies in both rooms.)

- `--shadow-sm` is the resting state for every `.card` — cards sit, they don't float.
- `--shadow-md` is for hover/interactive elevation (e.g. the Catalog grid's hover lift) and dropdown
  surfaces.
- `--shadow-lg` is for anything that sits above the page itself — the mobile bottom tab bar's
  top-edge shadow being the current example.
- No glow, no colored shadows, no blur-heavy "neumorphic" effects.

## Shapes

```css
--radius-sm: 4px;
--radius-md: 6px;
```

- **Radius stays small and restrained.** Books and index cards have square-ish edges; a heavily
  rounded UI reads as "friendly consumer app," which undercuts the archival tone this app is going
  for.
- **Cards are "catalog cards," not generic panels.** A `.card` gets a `3px` top border in
  `--color-primary` (`.card`) or `--color-accent` (`.card-accent`) — like a colored tab divider on a
  card-catalog drawer — rather than relying on shadow alone to read as a distinct object.
- A very subtle paper-grain texture (a tiled, low-contrast noise background, opacity ~3–4%) on
  `--color-bg` is still worth trying now that Catalog/Collections/Library have real surface area to
  judge it against — still not implemented, revisit as a follow-up.

## Components

- **`.card` / `.card-accent`** — the base surface primitive (see Shapes). Used by every status card,
  the Catalog grid item, and the Library page's mobile card-per-row layout.
- **`.btn-primary`** — solid `--color-primary` fill, white text, `--radius-sm`. The default action
  button.
- **`.btn-ghost`** — transparent fill, `--color-border` outline, `--color-text-muted` text. Secondary
  actions. **`.btn-ghost-danger`** — the same shape with `--color-error` text/border, for destructive
  actions (unfollow, remove a key, delete).
- **`.btn-danger`** — solid `--color-error` fill with `--color-error-contrast` text, for the *confirm*
  step of a destructive action only; the button that opens the confirmation is `.btn-ghost-danger`.
  It is a peer of `.btn-primary`, not a modifier on it: composing them produced error-coloured text on
  the primary green fill, which measured 1.41:1 in Reading Room and 1.15:1 in After Hours against a
  4.5:1 requirement — the least readable control in the app sitting on its most destructive action.
- **`.btn-sm`** — a smaller padding/font-size variant, composed with `.btn-primary`/`.btn-ghost`.
- **Form inputs** (`input[type=text|email|password|number|search]`, `select`, `textarea`) — flat fill,
  `--color-border` outline, `--radius-sm`, `--color-primary` focus ring. A new input `type` must be added
  to that selector list or it renders unstyled next to its neighbours — `search` was missing until the
  catalog, collection-item and manual-add search boxes exposed it.
- **`.spine-label`** — genre/platform classification tag (see Typography).
- **`.stamp-label`** — typed caption in the metadata family (see Typography). Live on the `app-page-toc`
  heading and the Collections visibility state. It exists because both had reimplemented the treatment
  by hand, at two different sizes and two different letter-spacings, without ever naming a class the
  primitive check could see.
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
- **`.psn-badge`** — PSN-linked-account indicator only (see Colors' `--color-psn` rule). A small dot
  + label in `--color-psn`.
- **`ng-icon`** — the icon element, from `@ng-icons/core` with glyphs out of
  `@ng-icons/phosphor-icons/regular` (see Appendix: Iconography & Imagery for the pack decision and
  the concept-to-glyph map). Colour inherits from context and the glyph holds its size in a flex row,
  both defined once in `styles.css`; the default `1.5rem` size comes from `provideNgIconsConfig` in
  `app.config.ts`. Register glyphs per component through `provideIcons({ … })` in `viewProviders`, so
  unused ones tree-shake away — never register a whole pack. Every `ng-icon` carries
  `aria-hidden="true"`: the accessible name belongs to the control around it, which is why an
  icon-only nav link needs its own `aria-label`.
- **`app-site-nav`** (`src/app/nav/site-nav.component.ts`) — the single sitewide nav-link data
  source, rendered two ways from one array: a desktop header (`.site-nav-desktop`, horizontal links
  + user chip + PSN Settings + Sign out) above the `md` breakpoint, and a fixed bottom tab bar
  (`.site-nav-tabbar`, 5 primary destinations: Home/Catalog/Collections/Library/Profile) below it.
  Active route gets `routerLinkActive="nav-active"` → `--color-primary` text.
  **The desktop bar sheds the whole `.user-chip` (avatar *and* email) at `xl` and narrower.** The chip is
  the widest item in the row, and the row it has to fit into is the non-admin one — seven links carrying
  icon *and* label. The breakpoint was originally justified by an admin's extra "Enrichment Runs" link
  wrapping "Sign out" onto a second line, but that argument describes the state before `.nav-crowded`
  existed; an admin now sheds every label at every desktop width, so for an admin this media query is
  redundant and its live justification is the non-admin row. Drop the pair, never just the email: the avatar exists
  to anchor the address, so alone it reads as a stray image between two nav links rather than an account
  indicator. Who is signed in stays evident from Profile and Sign out. If more top-level links are ever
  added, the next thing to give is the link labels, not the breakpoint — which is what happens at `lg` and
  narrower, where the labels are hidden and each link's `aria-label` becomes its only accessible name.
  **A wider window buys the nav no room.** The header sits inside `.page-container`, so its usable
  width is pinned at `1100px` minus padding for every viewport at or above that. There are therefore
  only three desktop configurations — chip+labels above `xl` (>1280px), labels alone from just above
  `lg` through `xl` (1025–1280px), icons alone from just above `md` through `lg` (769–1024px).
  **The tightest case is the non-admin one above `xl`, not the admin's extra eighth link.** An admin
  has more links but `.nav-crowded` strips every label, so an admin row is eight icons and has room to
  spare; the unmitigated configuration is seven links carrying icon *and* label plus the chip, and that
  is the one that overflowed. Treating the admin case as the worst case is what let a wrapped header
  ship — see the `.user-email` note below. Every rule is a `max-width` media query, so
  each named breakpoint sits in the *narrower* band: at exactly 1280px the chip is already gone. That
  is pinned by `e2e/nav.spec.ts`'s boundary test at 1281/1280/1025/1024 rather than left as prose —
  an off-by-one here is invisible on screen and this passage previously had one.
  Widening the browser makes the widest case *worse*, not better, because that is where the chip returns.
  That is why **an admin sheds both the chip and the labels at every desktop width** — `.nav-crowded`,
  set from `admin.isAdmin()` in the component because CSS cannot count links. Eight labelled links do
  not fit in that pinned width at any viewport, with or without the chip: the row overflows above the
  header and pushes `Sign out` onto a second line. Dropping only the chip was tried and is not enough.
  Adding icons made this case *worse* before `.nav-crowded` existed, since each glyph costs width the
  labels were already using.
  **`.user-email` is capped at `10ch` with an ellipsis, and the cap is load-bearing.** Without it the
  header's width depends on how long the signed-in user's email address is — the one unbounded,
  data-dependent element in the row — so the layout held for short addresses and wrapped for ordinary
  ones. Measured at 1281px with all three webfonts applied: usable width 947px against 1032px of
  content, with the chip alone at 232px for a 24-character address. Capped, the same row measures
  916px — 806px of items plus seven 16px gaps — leaving 31px of headroom. Every figure in this
  paragraph is a webfont measurement and means nothing in fallback metrics, which draw the same row
  39px narrower. `--font-meta` is IBM Plex Mono, so `ch` is an exact unit here and the cap
  is a hard 82px rather than an approximation. The full address stays in the DOM, so screen readers and
  the avatar's `alt` still carry it; only the painted text is clipped.
  **The chip renders the whole address and lets the cap clip it, rather than rendering a shortened form
  of it.** A local-part-only chip was considered and rejected: it reads better, but it also costs the
  regression test its teeth. The e2e identity's address is 24 characters and needs 196px uncapped, which
  is what makes the row wrap when the cap is deleted; its local part is 11 characters and needs 90px,
  which fits — the cap would still be correct for long addresses and nothing would fail if it were
  removed. `e2e/nav.spec.ts` therefore asserts the fixture address still overflows the cap, so
  shortening either the address or the rendered form of it fails loudly instead of quietly retiring the
  detector. `.user-email` carries a `title`, which is the only place a sighted user can read their own
  full address — the truncation affects exactly the group the DOM-based accessibility argument does not
  cover. Do not raise this cap to "show
  more of the address" without re-measuring — a generous cap reintroduces the same bug for long
  addresses, which is precisely how it shipped unnoticed. The non-admin case is the one to measure,
  not the admin one: `.nav-crowded` hides every label for admins, so admin tests count icons in a row
  that cannot wrap and will pass while this is broken. `e2e/nav.spec.ts` counts non-admin rows at both
  label-bearing bands (1281px and 1100px); a test that only asserts an element is *visible* at a width
  does not measure whether the row fits at that width, which is how this survived a passing suite.
  Those measurements wait for the webfonts and assert they applied, because `styles.css` loads all
  three with `display=swap` and the fallback row is narrower than the headroom — see TESTING.md.
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

**CSS decides how something looks. The component decides whether it exists.** Presence, absence and
conditional rendering belong in the template (`@if`), never in a selector that reaches into markup
shape to hide things. A rule like `td[data-label='Cover']:not(:has(img)) { display: none }` looks
economical and is the opposite: it couples two unrelated features through an attribute one of them
owns, and it buries a decision about what an entry *is* somewhere nobody looking for that decision
would think to search.

Three questions before writing any rule, in order:

1. **Does a token already express this?** Use `var(--space-*)`, `var(--color-*)`, `var(--radius-*)`,
   `var(--shadow-*)`. A literal color, a one-off pixel spacing, or a bespoke shadow is a defect, not a
   shortcut.
2. **Does a named primitive already express this?** `.card`, `.btn-*`, `.spine-label`,
   `.catalog-title`, `.catalog-meta`, `.cover-art`, `.psn-badge`. Reach for the vocabulary before
   inventing beside it.
3. **Is this actually structure rather than style?** If the rule's job is to make something disappear
   or appear, it is the component's job instead.

Appearance that repeats becomes a **new named primitive in `styles.css` with an entry in Components
above, added in the same change** — not a rule in one component's stylesheet. Component `.css` files
are for that page's own arrangement: grid and flex layout, its breakpoint behaviour, its spacing
rhythm. They are not where the design language grows.

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

### Enforcing it

This erodes one reasonable-looking exception at a time, so it is worth enforcing mechanically rather
than remembering. A stylelint rule capping component stylesheets to layout properties — and requiring
color, typography, radius and shadow to come from `var(--*)` — turns the review habit into a CI gate.
A second, cheaper check catches the failure above directly: every class named in this document's
Components list must appear exactly once across `src/**/*.css`, and that once must be `styles.css`.

## Do's and Don'ts

- **Do** keep `--color-primary` as the only color driving buttons, links, focus rings, and active-nav
  state.
- **Do** reserve `--color-accent` for "featured/valuable" moments, never as a background fill.
- **Do** reserve `--color-psn` exclusively for PSN-linked-account indication.
- **Do** keep radii small (`--radius-sm`/`--radius-md`) — no heavily rounded "friendly app" shapes.
- **Do** maintain WCAG AA contrast (4.5:1 body text, 3:1 large text) for every text/background pair
  in both rooms.
- **Do** drive nav-link data from a single source (`SiteNavComponent`'s link array) — never duplicate
  the link list between desktop and mobile markup.
- **Don't** reskin toward PlayStation's own blue/black brand identity.
- **Don't** default to generic SaaS/dashboard styling (indigo gradients, Inter-everywhere, heavy
  rounding).
- **Don't** use gradients, glow, or neon — flat color fills only.
- **Don't** use scale-up hover bounce or elastic easing — motion is deliberate, not springy (see
  Appendix: Motion).
- **Don't** add a manual light/dark toggle — the two rooms are `prefers-color-scheme`-only.
- **Don't** use CSS to decide whether something renders, and don't key a selector off an attribute
  another feature owns (see Where styling lives).
- **Don't** grow the design language inside a component stylesheet — a reused appearance becomes a
  named primitive in `styles.css` plus a Components entry here, in the same change.
- **Don't** redefine a class named in Components inside a component stylesheet. One primitive, one
  definition; vary size and placement locally, never shape, radius, fit or color.
- **Don't** use gamepad/controller iconography or storefront/gamified copy (see Appendix:
  Iconography & Imagery, Voice & Tone).

---

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

Avoid gamepad/controller iconography as the default visual language — it's the same reflex as
reaching for PlayStation blue, and it's equally generic. Prefer library-native motifs instead:

- "Owned / in your collection" → a bookmark or ribbon marker, not a checkmark badge
- "Search the catalog" → a card-catalog drawer glyph, not a magnifying glass over a game icon
- "Favorite / highlighted" → an ex-libris-style stamp or plate mark
- A future wordmark/favicon should lean on the serif logotype plus a simple bookplate or open-book
  mark — not a controller silhouette.

**The pack is Phosphor** (`@ng-icons/phosphor-icons`, MIT), regular weight. It won over Lucide,
Tabler, Heroicons and Iconoir because it is the only candidate that carries the motifs above as
drawn glyphs rather than approximations: `phosphorCards` *is* the card-catalog drawer, and
`phosphorStamp` is the ex-libris stamp. It also keeps Catalog, Collections and Library legible as
three different things at 24px, which is the hard constraint — they sit adjacent in the same nav row.

`@ng-icons/core` is the delivery mechanism because it is the only one peering `@angular/core >=22`.
`lucide-angular` caps at `13.x - 21.x` and will not install against this app; `@ng-icons/lucide`
routes around that if the pack is ever revisited. Import from the **`/regular` subpath** — the
package root exports nothing.

| Concept | Glyph |
|---|---|
| Home | `phosphorHouse` |
| Catalog | `phosphorCards` |
| Collections | `phosphorArchive` |
| Library | `phosphorBooks` |
| Profile | `phosphorUserCircle` |
| PSN Settings | `phosphorPlugsConnected` |
| Enrichment Runs | `phosphorSparkle` |
| Sign out | `phosphorSignOut` |
| Purchased / owned | `phosphorBookmarkSimple` |
| Free-to-play | `phosphorDownloadSimple` |
| Monthly games | `phosphorCalendarDots` |
| Catalog entitlements | `phosphorStack` |

Phosphor also ships `phosphorStorefront`, `phosphorShoppingBag`, `phosphorCoins`, `phosphorTicket`
and `phosphorCrown`. Those are off-limits for the same reason storefront copy is — see Voice & Tone.
A glyph existing in the pack is not a licence to use it.

Cover art is the one imagery exception, and it earns its place as provenance rather than decoration:
`GameSummaryResponse` carries `cover_image_url`, and the Catalog grid, the game detail page, the
Library table, the Collections list and the public shared-collection view all render it.

**Square art only — never the 16:9 store hero.** The two sources are different kinds of asset, not
different qualities of one: entitlement artwork is a 1:1 icon and covers effectively the whole
library, while the store cache holds widescreen key art for a minority of titles. Preferring the hero
gave a page whose artwork changed shape from one game to the next. The detail page locks its image to
a 1:1 aspect ratio so a stray non-square source cannot alter the layout. Hero art has no use today; if
one is found later it needs its own treatment, not a substitution into a square slot.

PSN carries no artwork at all for part of the back catalogue, mostly PS3 and Vita titles, and there is
no second source to fall back to. That is the case the `.cover-art` rule in Components exists for: the
entry is complete without it.

### Voice & Tone

Copy reads like a curator's working notes, not marketing copy. Prefer:

- "12 titles catalogued" over "12 games unlocked"
- "Added to your collection" over "Added to library!"
- "Last catalogued" over "Last synced"

Avoid exclamation points, gamified verbs ("unlock," "level up," "earn"), and storefront language
("buy," "deal," "sale") entirely — none of that is Librarian's job; Curator's job is cataloging,
not commerce.

### Accessibility

- All text/background pairs in both rooms must hold WCAG AA contrast (4.5:1 body, 3:1 large text).
- **Icons are non-text content and answer to WCAG 1.4.11: 3:1 against their own background**, not the
  4.5:1 body-text bar. That distinction matters because `--color-primary` on `--color-surface` is
  comfortable in Reading Room and tight in After Hours — the dark room's lifted green is the closest
  pair in the palette to its floor. Measure with `getComputedStyle`, not by eye, and re-measure that
  pair before changing either token. An icon that is the *only* carrier of meaning (an icon-only nav
  link, a status glyph) also needs a text alternative — see the `ng-icon` entry in Components.
- Focus rings use `--color-primary` at 3px — never rely on color alone for any state (error/success
  text also carries an icon or label, not just a color change).
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
