# Design Language

## Concept

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

## Two Rooms, Not a Light/Dark Toggle

Instead of a generic light/dark theme pair, Librarian has two color moods, each named for what it
evokes, both driven by the same `prefers-color-scheme` mechanism already in place (no JS toggle):

- **Reading Room** (light) — daytime, parchment and ink. A library reading room: cream paper,
  warm dark ink text, forest-green shelving, brass accents.
- **After Hours** (dark) — a reading room after the lights go down except for a desk lamp: deep
  walnut brown (not neutral gray, not blue-black), warm off-white text under lamplight, the same
  green/brass accents brightened just enough to read as lit rather than muted.

Both rooms use warm neutrals (paper/wood undertones), never cool neutral grays — that warmth is
what separates "library" from "generic app shell." Pure black/white and pure gray were deliberately
rejected everywhere in this palette.

### Color Tokens

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
  --color-success: #3E6B4F;          /* same family as primary, darker/desaturated */

  --shadow-sm: 0 1px 2px rgba(36, 28, 21, .10), 0 1px 1px rgba(36, 28, 21, .06);
  --shadow-md: 0 6px 16px rgba(36, 28, 21, .12), 0 2px 4px rgba(36, 28, 21, .08);
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
    --color-success: #5FA57E;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, .30), 0 1px 1px rgba(0, 0, 0, .20);
    --shadow-md: 0 8px 20px rgba(0, 0, 0, .40), 0 3px 6px rgba(0, 0, 0, .24);
  }
}
```

**Usage rules:**

- `--color-primary` (library green) is the workhorse: primary buttons, links, focus rings, active
  nav state. It is the app's actual identity color.
- `--color-accent` (brass) is reserved for things that deserve to look *cataloged and valuable* —
  a title treatment, a "featured" or "recently acquired" marker, a rating/score display. Used
  sparingly, never as a background fill.
- `--color-psn` exists **only** to indicate "this data/state came from or reflects your linked PSN
  account" — a small badge, a linked-account status line, a PSN-sourced data attribution. It must
  never become the button color, the nav color, or a decorative brand nod. If a future page needs
  to visually distinguish "your account" from "the catalog," this is the token for that distinction
  — nothing else.
- `--color-error` / `--color-success` stay in the same warm-ink family as everything else (oxblood /
  moss) rather than stock red/green, so validation states don't look like they were dropped in from
  a different design system.

## Typography

- **Headings & game titles** — `Lora` (serif), already in place. Elevate it beyond "just h1–h4":
  game titles get their own treatment, italicized the way a library catalog italicizes the title of
  a cataloged work (`.catalog-title { font-style: italic; }`). Series/edition subtitles use the same
  serif at a smaller size, roman (not italic), the way a catalog card lists an edition note under
  the italicized title.
- **Body** — `Inter`, already in place. No change; it's a clean, quiet reading face and doesn't
  compete with the serif.
- **Metadata / catalog numbers** — new: a monospace (`IBM Plex Mono`) for anything that reads like a
  stamped catalog entry — acquisition dates, PSN account identifiers, completion percentages,
  platform codes. This is the detail that sells the "index card" metaphor: metadata should look
  *typed*, not styled.
- **Classification labels** — new: a small-caps, letter-spaced treatment (`.spine-label`) for genre
  and platform tags, evoking a book spine label or a card-catalog subject heading — uppercase,
  `letter-spacing: 0.06em`, small size, set in `Inter` at 600 weight, not a filled pill/badge.

```css
--font-heading: 'Lora', Georgia, serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-meta: 'IBM Plex Mono', ui-monospace, monospace;
```

## Shape, Elevation, Texture

- **Radius stays small and restrained**: `--radius-sm: 4px`, `--radius-md: 6px` (down from the
  previous 6/10px). Books and index cards have square-ish edges; a heavily rounded UI reads as
  "friendly consumer app," which undercuts the archival tone this app is going for.
- **Cards are "catalog cards," not generic panels.** A card gets a `3px` top border in
  `--color-primary` or `--color-accent` (like a colored tab divider on a card-catalog drawer) rather
  than relying on shadow alone to read as a distinct object. Shadows stay soft and low — a card
  catalog drawer doesn't float, it sits.
- **No gradients, no glow, no neon.** Flat color fills only. Gradients and glow effects are gaming-UI
  and SaaS-marketing signatures respectively; both are explicitly off-brand here.
- A very subtle paper-grain texture (a tiled, low-contrast noise background, opacity ~3–4%) on
  `--color-bg` is worth trying once there's enough surface area to judge it — skip it for now while
  the app is two pages, revisit when the catalog/library views exist and there's a real background
  to texture.

## Motion

Deliberate, not springy. `180–220ms ease-out` for hover/focus/expand transitions — the feel of
sliding a card out of a drawer or turning a page, not a bounce. No scale-up hover effects, no
elastic easing. Loading states use a simple fade/dim rather than spinners styled as gamified
progress bars.

## Iconography & Imagery

Avoid gamepad/controller iconography as the default visual language — it's the same reflex as
reaching for PlayStation blue, and it's equally generic. Prefer library-native motifs instead:

- "Owned / in your collection" → a bookmark or ribbon marker, not a checkmark badge
- "Search the catalog" → a card-catalog drawer glyph, not a magnifying glass over a game icon
- "Favorite / highlighted" → an ex-libris-style stamp or plate mark
- A future wordmark/favicon should lean on the serif logotype plus a simple bookplate or open-book
  mark — not a controller silhouette.

## Voice & Tone

Copy reads like a curator's working notes, not marketing copy. Prefer:

- "12 titles catalogued" over "12 games unlocked"
- "Added to your collection" over "Added to library!"
- "Last catalogued" over "Last synced"

Avoid exclamation points, gamified verbs ("unlock," "level up," "earn"), and storefront language
("buy," "deal," "sale") entirely — none of that is Librarian's job; Curator's job is cataloging,
not commerce.

## Accessibility

- All text/background pairs in both rooms must hold WCAG AA contrast (4.5:1 body, 3:1 large text) —
  verify new tokens against this before shipping; the palette above was chosen with that in mind but
  needs a real contrast-checker pass once applied.
- Focus rings use `--color-primary` at 3px, same mechanism as before — never rely on color alone
  for any state (error/success text also carries an icon or label, not just a color change).
- `prefers-reduced-motion` should collapse all transitions to instant; not yet wired in
  `styles.css` — add when motion beyond simple hovers is introduced.

## Implementation Notes

This is a token- and utility-class-level system, not a component library — consistent with the
rest of the fleet's plain-CSS approach (Churches/Inventory don't use a CSS framework either).
Applying this to the existing two pages (Home, PSN settings) means:

- Replace the token block in `src/styles.css` with the palette above.
- Reduce `--radius-sm`/`--radius-md` and add the `.card` top-border treatment.
- Add `.spine-label` and `.catalog-title`/`font-meta` utilities now, even with nothing yet using
  `.catalog-title` (no game titles exist in the UI until Curator's catalog endpoints land) — so the
  vocabulary is in place the moment the catalog page is built, instead of being retrofitted later.
- Repoint the PSN "linked account" indicator in `psn-settings.component.html` to use
  `--color-psn` instead of the generic primary/success color, since that's exactly the case this
  token exists for.

This document is the source of truth for all future Librarian UI work, including the eventual
catalog/library pages once Curator exposes those endpoints. Any new page or component should be
checked against it before merging, the same way `DESIGN-LANGUAGE.md` governs testing conventions
at the workspace root.
