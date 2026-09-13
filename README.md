# Librarian

[![Build and deploy Node.js app to Azure Web App - crgolden-librarian](https://github.com/crgolden/Librarian/actions/workflows/main_crgolden-librarian.yml/badge.svg)](https://github.com/crgolden/Librarian/actions/workflows/main_crgolden-librarian.yml)

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=crgolden_Librarian)](https://sonarcloud.io/summary/new_code?id=crgolden_Librarian)

[![Synthetic walker](https://github.com/crgolden/Librarian/actions/workflows/synthetic.yml/badge.svg)](https://github.com/crgolden/Librarian/actions/workflows/synthetic.yml)

The end-user surface of the PlayStation game-curation project: an **Angular 22 SSR** application
with a **Node.js Express** Backend-for-Frontend (BFF), served by a single Node process. The BFF holds
the OIDC session and proxies every data call to the standalone [Curator](https://github.com/crgolden/Curator)
API; the browser never sees an access token directly.

The visual design language — a dark-first OKLCH palette with a single accent, the type scale, the
catalog-card component vocabulary, and the layout measures each page uses — is documented in
[DESIGN.md](DESIGN.md). Styling is **Tailwind CSS v4**: the design tokens live in a `@theme` block in
`src/styles.css`, the light scheme re-binds them under `prefers-color-scheme`, and the three variable
webfonts are self-hosted rather than fetched from a CDN. There is no theme toggle by design; the browser's
own appearance setting decides.

Navigation adapts rather than reflows: a persistent icon-and-label rail on desktop, and on small screens a
four-item bottom tab bar with a **More** sheet — a native `<dialog>`, so its focus trap, Escape handling
and backdrop come from the platform rather than a component library.

## Sibling Applications

| Repo | Role | How Librarian interacts |
|---|---|---|
| [Identity](https://github.com/crgolden/Identity) | OIDC Identity Provider | OIDC authorization-code flow via `openid-client` in the Node BFF |
| [Curator](https://github.com/crgolden/Curator) | PlayStation game-curation API | BFF proxies `/curator/api/**` via a `fetch`-based proxy (`src/bff/proxy.ts`), attaching the user Bearer token (scope `curator`) |
| [Infrastructure](https://github.com/crgolden/Infrastructure) | Health monitoring dashboard | Polls `GET /health` (returns `Healthy`) |

## Architecture

A single Node process runs both the Angular 22 SSR renderer and an Express BFF. The BFF owns the
OIDC session (`openid-client` v6, PKCE; scopes `offline_access openid profile email curator`),
proxies `/curator/api/**` to the Curator API with the session's Bearer token, and requires
`X-CSRF: 1` on mutating calls. The session cookie uses `sameSite: 'lax'`, not `'strict'` — the OIDC
callback is a top-level GET navigation initiated by a redirect from Identity (a different origin),
and a `Strict` cookie would be withheld on that navigation, so the PKCE verifier/OAuth state would
never reach `/bff/callback` and login would always 400. `Lax` still blocks cross-site subrequests
(CSRF protection intact) while allowing the cookie on top-level GET redirects.

Only `''`, `faq`, `privacy`, and the catch-all `**` render `RenderMode.Server` — the catch-all so
`NotFoundComponent` can set a real HTTP 404 via `RESPONSE_INIT`, which stays `null` (and so can't
carry a status) under `RenderMode.Client`. Every other route, including the anonymous `c/:slug`
share link, renders `RenderMode.Client`: `authGuard` only works in the browser (it reads
`AuthService`'s client-fetched session state and needs the DOM `location` global for its anonymous
redirect), and none of the per-entity pages have an SEO/link-unfurl payoff that would justify paying
for SSR. The app surface covers a home page, an `/account` settings page
(link/unlink a PlayStation Network account via NPSSO token, backed by Curator's `/me` and
`/psn/link` routes, plus per-category data-harvest preferences and bring-your-own-key RAWG/OpenCritic
enrichment key management), `/catalog` (browse the shared game catalog), `/collections` (create, save, and
run curated collections — filterable by genre, minimum score, AAA tier, and minimum trophy completion —
plus a detail view for renaming, editing membership, deleting, and setting a collection's visibility to
private, unlisted, or public with a copyable share link), `/consoles` (manage consoles and swappable
storage devices, attach/detach a device between consoles, and track install state), `/library`
(trigger a refresh and browse the caller's own library — server-side search, genre filtering, sortable
columns, paging, and per-title hide controls with a separate view of what you have hidden; see "The
library page" below), and `/library/ps-plus` (which PlayStation Plus Game Catalog and Classics Catalog
titles you have not claimed, which are leaving, and which of your claimed titles have lapsed) — all
backed by real Curator endpoints. A public
social-profile feature adds `/profile` and its sub-keyed counterpart `/u/:sub`: a viewable, followable
profile with opt-in display toggles for library, collections, PSN trophies, and PSN identity, plus
always-visible follower/following lists — collections can also be followed individually, from a "Collections
I follow" view. The profile also carries your handle on other PlayStation sites, declared from
`/profile/settings`: you pick a site from a short allowlist and type a handle, and the link itself is
built server-side from that site's own URL template. `/library` and `/collections` are themselves now sub-keyed (`/library/:sub`,
`/collections/:sub`) so the same components render a read-only view of another user's library/collections
when their profile makes that section public; the bare paths always mean "mine," and a sub-keyed URL for
your own sub redirects straight back to the bare one. `/c/:slug` is the one page that needs no sign-in at
all — a collection's public share link. Frontend is zoneless Angular. Observability:
OTLP traces/metrics → Grafana Alloy; structured logs → Elasticsearch (`pino-elasticsearch`).
`GET /health` → `Healthy`.

## The library page

`/library` (your own, with a refresh button) and `/library/:sub` (read-only, another user's public
library) render the same table component (`src/library/`), backed by `GET /curator/api/library` and
`GET /curator/api/users/{sub}/library` respectively. Both endpoints are fully server-driven — the
Angular page never fetches the whole library into the browser and sorts/filters it client-side; every
search keystroke (debounced), genre selection, column-header click, and page change issues a
fresh request with `q`/`genre`/`sort`/`sortDir`/`limit`/`offset` query parameters, and the
response carries only that page's rows plus a `total` count.

You can also add a game you own that isn't in your digital entitlements — a disc, typically. Search by
name: anything already in your library is filtered out, so what you are offered is what you can still
add, and if it comes back empty you are told which of the two reasons applies — nothing by that name, or
you already own every match. The shared catalog is only part of the PlayStation Store, so a name the
catalog has never heard of is searched against the Store for you, and when the catalog answers with the
wrong titles you can send the same search to the Store yourself. Either way it proposes what it found and
you accept a match or decline it, in the
shape an address validator uses. Accepting adds the title to the shared catalog and to your library at
once; the match is verified server-side against the Store rather than taken on the browser's word, so
nothing a client types reaches a catalog everyone browses. Searching the Store needs a linked PlayStation
Network account, because it spends that account's own credentials — which is why it happens on a
deliberate search rather than as you type. Manually added rows are marked, only you can remove them, and
a library refresh never takes them away.

Columns:

| Column | Source |
|---|---|
| Title | The game's canonical title |
| Genre | The resolved genre Curator's enrichment pipeline assigned (same resolution `/catalog` uses) — not PSN's raw per-title genre tags |
| RAWG | RAWG's critic score, 0–100 |
| OpenCritic | OpenCritic's top-critic score, 0–100 |
| PS Store | PlayStation Store's own star rating (1–5), from Sony's official catalog API |
| % Completed | How far through the game's trophy list you are — needs a linked PlayStation account with trophy harvesting turned on. The one column that can't be sorted |
| PS Store page | A link to the game's PlayStation Store product page, opens in a new tab |

Any rating that hasn't resolved yet — enrichment still pending, or you haven't configured a
RAWG/OpenCritic key — shows as a dash rather than blocking the row. `% Completed` dashes for three
reasons of its own: no PlayStation account linked, trophy harvesting switched off, or no confident match
between the game and a PlayStation trophy list. It stays blank when you're viewing someone else's
library, and says so on hover. Table structure, sortable
headers, and pagination controls are built on [TanStack Table](https://tanstack.com/table)
(`@tanstack/angular-table`) running in manual (server-driven) mode, not a hand-rolled comparator or
page-slicing implementation.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Node.js 24 / Express 5 |
| Auth / BFF | `openid-client` v6 + `express-session` + `connect-redis` |
| Frontend | Angular 22 SSR (`@angular/ssr`) |
| Observability | OpenTelemetry → Grafana Alloy (OTLP), `pino` → Elasticsearch |
| Hosting | Azure App Service (Linux, Node 24) |
| Secrets | Azure Key Vault (Managed Identity) |

## Getting Started

The full local stack needs the Identity server and the Curator API running, plus local config:

**Environment variables (set in your shell):**

```
OidcAuthority=https://localhost:7261
CuratorApiAddress=<local Curator API URL>
LibrarianClientId=<dev client id>
LibrarianClientSecret=<dev client secret>
SessionSecret=<at-least-32-chars-dev-secret>
```

Session storage defaults to an in-memory store (fine for local dev — sessions just don't survive a
restart). To use a local Redis instance instead, export `RedisHost=localhost` and `RedisPort=6379`
(the code's own default assumes Azure's TLS port, not a local non-TLS Redis) — `session.ts` picks
Redis automatically once `RedisHost` is set.

**Key Vault secrets required at runtime (production):**

Each is wired up as an App Service setting holding a `@Microsoft.KeyVault(SecretUri=...)` reference, so
App Service resolves it from Key Vault at startup using the app's managed identity and hands it to the
process as an ordinary environment variable. The app has no Key Vault SDK dependency and makes no vault
calls of its own.

| Secret name | Description |
|-------------|-------------|
| `LibrarianClientId` | OIDC client ID |
| `LibrarianClientSecret` | OIDC client secret |
| `ElasticsearchUsername` | Elasticsearch basic auth username |
| `ElasticsearchPassword` | Elasticsearch basic auth password |
| `RedisPassword` | Redis TLS password |
| `SessionSecret` | Cookie signing secret (≥ 32 chars) |

## Key pieces

- `src/server.ts` — Express entry: `/health`, request logging, session, `/bff/*`, `/curator/api` proxy, Angular SSR catch-all.
- `src/bff/*` — `openid-client` auth, session (Redis / in-memory), Curator proxy, CSRF.
- `src/environments/*` — per-environment config (notably SSR `allowedHosts`), swapped via `fileReplacements`.
- `instrumentation.mjs` — OpenTelemetry sidecar (OTLP→Alloy); `src/telemetry/logging.ts` — pino→Elasticsearch.

## Commands

```powershell
npm install
npm start            # ng serve — SPA/component dev (no SSR/BFF), http://localhost:4200
npm run build        # SSR production build → dist/librarian.client/{server,browser}
npm run build:ci     # SSR build with the ci environment (allowedHosts=localhost)
npm run serve:ssr    # run the full SSR + BFF: node --import ./instrumentation.mjs dist/librarian.client/server/server.mjs
npm run lint         # ESLint
npx vitest run       # unit tests (Vitest); add --coverage for LCOV
npm run e2e          # build:ci + Playwright E2E vs the real Node server + mock Curator/OIDC (self-builds)
npm run e2e:synthetic # seeded random walk of a deployed stack (WalkerBaseUrl); normally run on a schedule
```

See [TESTING.md](TESTING.md) for the full E2E / synthetic-walker guide and CI configuration.

## Project Structure

```
src/
  server.ts          # Express app: session, BFF routes, SSR catch-all
  bff/                # openid-client auth, session, Curator proxy, CSRF
  app/                # Angular application shell (routing, guard, interceptor)
  auth/               # auth service + claim helpers
  home/               # home page
  curator/            # CuratorService (HTTP wrapper) + shared DTOs
  catalog/            # browse the shared game catalog
  collections/        # create/save/run/edit/delete a collection; visibility + share link; follow
  consoles/           # console + storage-device CRUD, attach/detach
  public-collection/  # /c/:slug — anonymous public share page
  library/            # server-driven library table (own + read-only viewer mode)
  psn/                # PSN link/unlink + per-category data-harvest preferences panel
  profile/            # public social profile: view, followers, following, settings, own-sub redirect
  shared/             # reusable UI pieces (e.g. loading-overlay, a pointer-blocking async-action overlay)
  environments/       # per-environment config (allowedHosts, etc.)
  telemetry/          # pino → Elasticsearch logging
e2e/                  # TypeScript Playwright E2E + synthetic walker
instrumentation.mjs   # OpenTelemetry Node SDK init (loaded via --import)
```

## Deployment

Deployed to Azure App Service (Linux, Node 24) as `crgolden-librarian` via GitHub Actions
(`.github/workflows/main_crgolden-librarian.yml`) — build, SonarCloud analysis, Vitest + Playwright
E2E, then deploy. The deployed app is exercised by the scheduled synthetic walker rather than a
post-deploy job. Secrets are Key Vault-referenced App Service settings
(`@Microsoft.KeyVault(SecretUri=...)`), resolved by the platform via the app's system-assigned managed
identity before the app starts — the app itself never calls the Key Vault SDK. See the workspace-level
[DEPLOYMENT.md](../AGENTS/DEPLOYMENT.md) for the full hosting fleet and Key Vault reference.
