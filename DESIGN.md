---
version: alpha
name: Librarian — Reading Room / After Hours
colors:
  primary: "#1F4D3D"
  neutral:
    bg: "#F6F1E7"
    surface: "#FFFDF8"
    surfaceAlt: "#EFE7D8"
    text: "#241C15"
    textMuted: "#7A6F5E"
    border: "#E4D9C5"
  semantic:
    error: "#A3342A"
    success: "#3E6B4F"
    warning: "#B8752E"
  accent: "#B4790A"
  psn: "#2C4A7C"
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
  spineLabel:
    fontFamily: Inter
    fontSize: 0.7rem
    fontWeight: 600
    letterSpacing: 0.06em
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

    --color-error: #C1584A;
    --color-error-rgb: 193, 88, 74;
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
| `.spine-label` | Inter | 0.7rem | 600, uppercase, `letter-spacing: 0.06em` | inherit | Genre/platform classification tags |

```css
--font-heading: 'Lora', Georgia, serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-meta: 'IBM Plex Mono', ui-monospace, monospace;
```

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

- **Grid model**: a single centered content column (`.page-container`, `max-width: 1100px`,
  `margin: 0 auto`, horizontal padding `1.5rem` — `1rem` below the `sm` breakpoint), not a
  multi-column app-shell grid. Catalog uses a responsive card grid within that column
  (`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`); Library's table becomes a
  stacked card list on narrow viewports (see Components).
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
- **`.btn-sm`** — a smaller padding/font-size variant, composed with `.btn-primary`/`.btn-ghost`.
- **Form inputs** (`input[type=text|email|password|number]`, `select`, `textarea`) — flat fill,
  `--color-border` outline, `--radius-sm`, `--color-primary` focus ring.
- **`.spine-label`** — genre/platform classification tag (see Typography).
- **`.catalog-title` / `.catalog-meta`** — game title and stamped-metadata treatments (see
  Typography). Live in production on the Catalog grid, Collections list, and Library table.
- **`.psn-badge`** — PSN-linked-account indicator only (see Colors' `--color-psn` rule). A small dot
  + label in `--color-psn`.
- **`app-site-nav`** (`src/app/nav/site-nav.component.ts`) — the single sitewide nav-link data
  source, rendered two ways from one array: a desktop header (`.site-nav-desktop`, horizontal links
  + user chip + PSN Settings + Sign out) above the `md` breakpoint, and a fixed bottom tab bar
  (`.site-nav-tabbar`, 5 primary destinations: Home/Catalog/Collections/Library/Profile) below it.
  Active route gets `routerLinkActive="nav-active"` → `--color-primary` text.
- **`app-page-toc`** (`src/app/shared/toc/page-toc.component.ts`) — client-side-only in-page table
  of contents + back-to-top link, generated from a page's own headings via a CSS selector input.
  Used on `/faq` and `/privacy`.
- **`app-breadcrumb`** (`src/app/shared/breadcrumb/breadcrumb.component.ts`) — a small "go up" trail
  for nested sub-routes (`/profile/followers`, `/collections/:sub`, `/library/:sub`, `/u/:sub/...`)
  back to their logical parent (the owning profile). Not sitewide — the persistent nav handles
  top-level cross-navigation.

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

No cover-art/imagery exists on the Catalog page today — `GameSummaryResponse` (the catalog API
response) has no image field, so the card grid is typography-and-metadata-only by design, not a
missing feature.

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
- Focus rings use `--color-primary` at 3px — never rely on color alone for any state (error/success
  text also carries an icon or label, not just a color change).
- `prefers-reduced-motion` collapses all transitions/animations to near-instant, wired globally in
  `styles.css`.

---

This document is the source of truth for all future Librarian UI work. As of this writing the app
has 17 live routes (`/`, `/psn`, `/catalog`, `/collections[/:sub]`, `/library[/:sub]`,
`/profile[/followers|/following|/settings]`, `/u/:sub[/followers|/following]`, `/faq`, `/privacy`) —
this is a working, multi-page app, not the two-page (Home, PSN settings) state this document once
described. Any new page or component should be checked against this document before merging, the
same way `DESIGN-LANGUAGE.md` governs testing conventions at the workspace root.
