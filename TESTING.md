# Testing

The Librarian test suite covers **frontend unit tests** (Vitest) and **browser E2E + smoke tests**
(TypeScript Playwright). This repo tests the Angular SSR + Node BFF stack. The Curator API has its
own suite in the [Curator](https://github.com/crgolden/Curator) repo.

Unit test coding standards (no control-flow in tests, etc.) are in the workspace-level
[Unit Test Standards](../AGENTS/TESTING.md#unit-test-standards).

## Test tiers

| Tier | Tool | Location | Requires live servers? | Runs in CI |
|------|------|----------|------------------------|------------|
| Frontend unit | Vitest | `src/**/*.spec.ts` | No | Every push/PR |
| E2E (regression) | Playwright (`--project=e2e`) | `e2e/` | No — Playwright manages the Node SSR server + mock Curator API | Every push/PR |
| Smoke (post-deploy) | Playwright (`--project=smoke`) | `e2e/smoke/` | Yes — targets the deployed stack | Post-deploy only |

---

## Frontend unit tests

```powershell
npx vitest run             # one-shot
npx vitest run --coverage  # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads`, `testTimeout: 15000`, and vitest's default `isolate: true`. Angular 22
is zoneless — always call `fixture.detectChanges()` manually.

**`isolate: true` is load-bearing; `fileParallelism` was not.** Isolation gives each file its own jsdom,
which this suite depends on because `document.title` and `<meta>` tags persist between tests within a
file (the catalog-detail and public-collection specs rely on that). Test files run in parallel — the
inherited `fileParallelism: false` was scaffold boilerplate with no recorded reason, and removing it kept
all 469 tests green across three full runs. See `AGENTS/PARKING_LOT.md` §8e for the measurements and for
what to check first if CI time regresses.

**Signal inputs (`input()` / `input.required()`) do not bind under this runner — use the `@Input()`
decorator in any component a spec renders.** Vitest transpiles TypeScript without Angular's `ngtsc`
pass, and it is `ngtsc` that turns an `input()` field into component input metadata; the decorator is a
runtime construct and survives, `input()` does not. Converting `AvatarComponent` to signal inputs made
every binding on it silently inert, and the only signal was `NG0303: Can't bind to 'sub' since it isn't
a known property of 'app-avatar'` on **stderr** — not a failure, and easy to scroll past in a 48-file
run. The template compiles, the component renders, and every input reads its declared default.

**A collaborator call that issues no HTTP is invisible to these specs unless you provide a stub for it.**
Most component specs here assert through `HttpTestingController` and close on `httpMock.verify()`, so
they only see behaviour that reaches the network. `MeService.invalidate()` is a bare field assignment;
when `psn-settings.component.spec.ts` let the real root-provided `MeService` be injected, the whole
suite passed whether or not the component called it — deleting the call broke the app and broke no
test. Override the collaborator (`{ provide: MeService, useValue: { invalidate: vi.fn() } }`) and
assert the call. Stub only the members the component actually touches: a stub missing a method the
component *does* call throws across every test in the file.

---

## E2E tests (regression)

Selectors follow the fleet-wide rule in [AGENTS/TESTING.md](../AGENTS/TESTING.md#e2e-selector-strategy--select-by-id-never-by-position): select by `id`, never by column position or CSS class. Rows built in an Angular `@for` get `[attr.id]="'<name>-' + $index"` and are matched by id prefix.

No live servers needed. Playwright manages three local servers for the test run, started in this order
— the mock Curator API and mock OIDC provider must both be up before the SSR server starts, since SSR's
warmup request hits Curator during Angular bootstrap and `/bff/login` performs real OIDC discovery
against the mock authority on first use:

1. **Mock Curator API** (`e2e/mocks/curator-server.ts`, backed by `e2e/mocks/curator.ts`) — handles
   `/me`, `/psn/link` (POST/DELETE), `/me/psn-preferences` (GET/PUT), `/trophies/summary`, `/identity`,
   `/presence`, `/devices` (each enforcing the same 404-unlinked/403-flag-off semantics as the real
   backend), the profile/follow routes (`/me/profile-settings`, `/me/profile-link-sites`,
   `/me/profile-links[/{site_key}]`, `/users/{sub}/profile`,
   `/users/{sub}/follow`, `/users/{sub}/followers`, `/users/{sub}/following`, `/users/{sub}/library`,
   `/users/{sub}/collections`), and the `/_test/*` control API used by test helpers (`e2e/fixtures.ts`,
   including `seedPsnPreferences` and the multi-user profile/follow seed methods).

   **Never assert "this row did not wrap" from `offsetTop`, and read the failure screenshot in
   `playwright-artifacts/` before believing any layout number.** Items of differing height in an
   `align-items: center` row have different `offsetTop`s on the same visual line, so distinct-value
   counts overstate the row count — the header's `.btn-ghost.btn-sm` Sign out does exactly this.
   Compare rounded vertical centres (`rect.top + rect.height / 2`).

   **"Asserts visible" is not "asserts fits", and the difference cost a shipped bug.** A responsive
   test that checks an element is visible at some width proves the media query fired; it says nothing
   about whether the row overflowed. The nav had exactly that at 1281px and 1100px and stayed green
   while the non-admin header was wrapping `Sign out` onto a second line. Every width band whose layout
   you care about needs a row count, not a visibility assertion.

   **Seed the configuration the code does *not* special-case.** Both original wrap tests called
   `store.seedAdmin()` on the reasoning that eight links is the tightest case — but `.nav-crowded` was
   bound to `admin.isAdmin()` and stripped every label, so those tests measured eight *icons* in a row
   that cannot wrap. They could not fail. Before trusting a layout test, ask which branch the
   mitigation turns on and point the test at the branch where it is **off**. (`.nav-crowded` is gone —
   the header is one shape now — so the current specs measure both the admin and non-admin link counts,
   and neither is special-cased.)

   **A row count does not catch a row that left the viewport.** The same header, during the window
   before admin status settled, wrapped to two rows *and* rode up past the top edge, so the first row
   was sliced through horizontally. Both rows still counted as rows. Pair every row-count assertion
   with `min(top) >= 0` across the links.

   **A layout measurement taken in fallback metrics is not a measurement of the shipped layout, and
   `document.fonts.ready` is not enough to prevent one.** `src/styles.css` pulls Lora, Inter and IBM
   Plex Mono from `fonts.googleapis.com` with `display=swap`, so the row is laid out in fallback
   metrics until the files land. Measured, not reasoned: blocking the font hosts at 1281px draws the
   non-admin header at 767px of content instead of 806px, and `.user-email` at 75px instead of its
   82px cap — a 39px understatement against 31px of real headroom, so a row that wraps in production
   fits in the measurement. `fonts.ready` does not close this: when the requests fail, the faces
   settle to `error` and it resolves *immediately* on fallback metrics, giving byte-identical numbers.
   That is the same "cannot fail on the configuration it polices" defect one level up, and it fires on
   any runner that cannot reach Google Fonts. `e2e/nav.spec.ts`'s `settleWebfonts()` therefore awaits
   `document.fonts.ready` **and** asserts `document.fonts.check()` for all three families, so a
   font-starved runner fails loudly instead of publishing a different layout's numbers.

   **A broken image is not a missing image — it renders its `alt` text, at whatever width that text
   needs.** `app-avatar` sets explicit `width`/`height`, and that still does not contain a failed load:
   the browser lays out the alt string instead. This wrapped the non-admin header at 1281px the moment
   the nav's initial-letter fallback became an `<img>`, because the alt is the user's email address —
   the chip measured **294px against an expected ~110px**, 35px past the row's capacity. Two things
   follow. The component pins its own box (`:host` carries the width/height with `overflow: hidden`),
   so a failed load can never resize a layout — this is a production property, not a test convenience,
   since the avatar endpoint can fail in production too. And the **mock OIDC server serves
   `/avatar/:sub`** (a 1×1 GIF): without it the redirect 404s and every avatar in the suite is a broken
   image, so the measured layout is not the shipped one. Same class of defect as measuring in fallback
   font metrics.

   **Make layout failures self-diagnosing.** Asserting a bare row count tells you it broke, not why.
   Return the per-child widths, the container width and the content total, and pass them as the
   `expect` message — that is what identified `.user-email` at 232px against a 131px runner-up, and
   showed the header's width was a function of the user's email length rather than a fixed overflow.

   **`store.seedAdmin()` (`POST /_test/admin`) is what grants admin.** `is_admin` reaches the app only
   through `GET /me` — `AdminService` ignores the BFF's claims array — so nothing else surfaces
   `/admin/enrichment` or its nav link. Like every other `/_test/*` seeder, it writes to `DEFAULT_SUB`
   regardless of the caller's `X-E2E-Sub`, so it cannot make `secondAuthedPage` an admin; granting a
   second identity would need a sub-aware handler that does not exist yet.

   The mock has no real bearer-token validation, so it identifies "who is calling" via an `X-E2E-Sub`
   header that each authenticated Playwright fixture injects on every `/curator/api/**` request (see
   `e2e/fixtures.ts`'s module docstring). `authedPage` and `secondAuthedPage` (a second, distinct
   identity, each on its own browser context) let a single test drive two simultaneously signed-in
   users — needed for follow/unfollow and cross-viewer profile tests.
2. **Mock OIDC provider** (`e2e/mocks/oidc-server.ts`) — real discovery/authorize/token/userinfo/jwks
   endpoints over real HTTPS (a self-signed cert generated by `npm run e2e`'s pre-step, see
   `e2e/mocks/generate-oidc-cert.ts`), so `authedPage` fixtures perform a genuine `/bff/login` round
   trip instead of mocking `/bff/user` directly. See `e2e/mocks/oidc.ts`. The SSR server trusts this
   cert for its own process only via `NODE_EXTRA_CA_CERTS` — `src/bff/oidc.ts` itself carries no
   insecure-transport allowance; discovery there always requires HTTPS.
3. **Node SSR + BFF server** — starts the built `dist/librarian.client/server/server.mjs` with an
   in-memory session store, `CuratorApiAddress` pointing at the mock, and `OidcAuthority` pointing at
   the mock OIDC provider.

Every `/bff/**` and `/curator/api/**` call is either handled by a mock server or intercepted by
Playwright route mocks — no real Identity or Curator is contacted.

The `e2e` project runs single-worker, non-parallel (`fullyParallel: false`, `workers: 1`, matching the
C# suites' xUnit `Collection` behavior): every spec file shares the same mock server's in-memory state,
so concurrent spec files would race on it.

The mock Curator server auto-registers the calling identity (from `X-E2E-Sub`) on every non-control
route — mirroring how a real bearer token always implies an existing `app_users` row by the time a
call reaches Curator (Identity account creation + Curator's own upsert-on-first-authenticated-request
precede it). This means a freshly-signed-in user's own `/me`/`/library`/`/users/{ownSub}/profile` call
never spuriously 404s just because no seed/control call touched their sub first. A *target* sub named
in a path parameter is still resolved through a non-mutating lookup, so an unseeded/unknown target
still correctly 404s.

`e2e/fixtures.ts`'s `authedPage`/`secondAuthedPage`/`anonymousPage` fixtures each open their own
`BrowserContext` rather than sharing the base `page` fixture when combined with another identity in
the same test — Playwright evaluates `page.route()` interceptors most-recently-registered-first, so
two fixtures sharing one page would let the second identity silently win every request. The mock OIDC
authorize redirect is handled via a cookie scoped to the mock OIDC origin rather than a `page.route()`
intercept, because Playwright cannot intercept the *target* of an HTTP redirect, only the request that
produced it ([microsoft/playwright#34994](https://github.com/microsoft/playwright/issues/34994)) — a
cookie rides along on the browser's automatic redirect navigation instead.

**Prerequisites (one-time):** install the Playwright Chromium browser:

```powershell
npx playwright install chromium
```

**Run:**

```powershell
npm run e2e   # self-builds the ci configuration (allowedHosts=localhost), then runs Playwright
```

> `npm run e2e` builds the `ci` configuration itself, so it always runs against a correct SSR build
> regardless of what is currently in `dist/` (a prior `npm run build` production build won't break it).

Failure artifacts (screenshot, trace, video) are written to `playwright-artifacts/`.

**E2E coverage (`e2e/`):** `home.spec.ts` (public landing), `psn.spec.ts` (auth guard redirect,
link/unlink flows, and the per-category data-harvest preference toggles — all off by default after
linking, toggling a category on shows its card and persists across reload, toggling off hides it
immediately — against the mock Curator API), `faq.spec.ts`/`privacy.spec.ts` (SSR + anonymous access to
the trust pages), `catalog.spec.ts`, `collections.spec.ts` (create/preview/save, a capacity_fill run's
console-install toggle including its 404-after-ownership-change case, and the detail view's
rename/visibility/share-link/delete flow), `consoles.spec.ts` (auth guard; console + storage-device
CRUD, attach/detach, and the auto-assigned-default-capacity flag), `public-collection.spec.ts` (the one
anonymous route in the app — an owner publishes a collection and shares its link; an anonymous visitor
opens it with no account; a second signed-in user follows it from the share page and sees it in
"Collections I follow"; setting visibility back to private immediately breaks the old link),
`library.spec.ts` (owner mode — ratings/category/PS-Store-link rendering, server-driven title search,
category filter, column-header sort with direction toggling, paging, and a combined search+sort+page
interaction, all against the mock's real query-param handling, not a client-side array; sub-keyed viewer
mode covered jointly with `profile.spec.ts` below), and `profile.spec.ts` (owner vs.
viewer profile rendering; a private-by-default profile shows only account-id-or-"Unlinked user" plus
follower/following counts; a fully public profile with every `show_*`/`harvest_*` flag on shows every
gated section; a viewer with no PSN link of their own sees trophies silently omitted, not an error;
follow/unfollow and the resulting count changes; no Follow button on your own profile; the followers/
following list pages; `/profile/settings` toggle persistence; the `/psn` cross-reference copy and the
absence of the removed region field; `/library/:sub` and `/collections/:sub` rendering owner vs.
read-only viewer mode for two seeded users, including a 403-to-inline-message case; and the
own-sub-canonicalization redirects — `/u/{own sub}`, `/u/{own sub}/followers`, `/u/{own sub}/following`,
`/library/{own sub}`, `/collections/{own sub}` all silently redirect (`replaceUrl`) to their bare-path
equivalents, while the same paths keyed to a *different* user's sub render viewer mode without
redirecting).

### Local runs never reuse a server, and a `setup` project proves the environment before any test runs

Two guards exist because of one incident: a leftover SSR server on port 4100 made every local run after
the first one lie. Every authenticated test failed on a *nav* locator while the anonymous ones passed, so
the reported symptom named the nav and the real fault was login. It cost four full E2E cycles and three
wrong root-cause diagnoses (a scope change, a component change, and a CSS change — none at fault).

**Guard 1 — `reuseExistingServer: false` on all three webServer entries.** Playwright now starts its own
servers, so local behaviour matches CI and no run can adopt a stale process. If something already holds
4100/4101/4102 the run aborts immediately naming the port:

```
Error: http://localhost:4101 is already used, make sure that nothing is running
on the port/url or set reuseExistingServer:true in config.webServer.
```

That is deliberate: an adopted server is either running the *previous build's bundle*, or — for a manual
`serve:ssr` — loading `.env.local` and pointing `OidcAuthority` at the **real** Identity instead of the
mock on 4102. **You can no longer keep a manual `serve:ssr` on 4100 while running E2E**; stop it first.

**Teardown is not instant — back-to-back runs collide.** Starting a second run the moment the first
exits reproducibly hits either the "already used" error above or, when the check races the release,
`Error: Timed out waiting 30000ms from config.webServer`. The ports do free themselves; wait a few
seconds, or clear them:

```powershell
Get-NetTCPConnection -LocalPort 4100 -State Listen |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**A `webServer` timeout usually means broken OIDC config, not a slow machine.** The SSR server fails to
start if `OidcAuthority` is unreachable or `NODE_EXTRA_CA_CERTS` points at a missing file — both
measured — and Playwright reports only the generic timeout. Check those two env values in
`playwright.config.ts` before suspecting load.

```powershell
Get-NetTCPConnection -LocalPort 4100 -State Listen |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Guard 2 — the `setup` project (`e2e/setup/environment.setup.ts`).** It resets the mock Curator and
performs one real `/bff/login` round trip, asserting `/bff/user` returns 200 carrying the expected `sub`.
The `e2e` project declares `dependencies: ['setup']`, so a broken environment aborts the whole suite in
seconds with a message naming the port and the cause, rather than 21 × 30s of timeouts blaming a nav
locator. Measured: the guard costs **~1.8s** on an idle machine, and a failing guard skipped all 117 e2e
tests and reported in 26.8s.

**Its `timeout` is 60s deliberately, not tuned to that 1.8s.** On a heavily loaded box the same login
round trip was measured at **24.3s**, so a tight bound would abort the whole suite spuriously — the one
failure a guard must never have. The goal is a *correct* fast abort (~1 min instead of ~10), not the
fastest possible one.

This is a **setup project, not `globalSetup`** — Playwright runs `globalSetup` *before* `webServer` is
ready, so a login attempt there cannot work. Project dependencies run as tests, after the servers are up.
`--grep` does not filter dependency projects, so the guard still fires during
`npm run e2e -- --grep "..."`.

Guard 2 is defence in depth, not the fix for the original incident — Guard 1 removes that failure mode
outright by refusing to adopt the stale server at all. Two things Guard 2 does **not** catch, both
measured rather than assumed: a broken `OidcAuthority`/`NODE_EXTRA_CA_CERTS` stops the SSR server
starting, so the run aborts at `webServer` before any test executes; and **the mock OIDC provider does
not validate the client secret**, so a deliberately wrong `LibrarianClientSecret` still passes the guard
and the full suite. No test here covers client-credential misconfiguration.

**Changing `SCOPES` in `src/bff/routes.ts` breaks every authenticated E2E test, and the symptom points at
the wrong thing.** Every authenticated test times out on a locator and the page snapshot shows the
*anonymous* page — it reads like a nav bug when it is a login bug. Check `/bff/user` and the mock
provider's discovery document before touching a component. **The same hazard is far worse in production**:
requesting a scope the live Identity client has not been granted fails sign-in for every user, so a scope
change is a deploy-ordering one-way door. Prefer `accessTokenClaims`' allowlist in `src/bff/routes.ts`,
which surfaces a claim the access token already carries and needs no Identity change at all.

**`store.seedAdmin()` alone no longer makes a page an admin — use `signInAsAdmin(page)`.** Admin status
reaches the browser as the `curator.admin` OIDC claim, settled once during the login round trip the
`authedPage` fixture performs before the test body runs. Seeding Curator mid-test cannot retro-fit a claim
onto a session that already exists, so `signInAsAdmin` sets the mock provider's `e2e_admin` cookie and
re-runs `/bff/login`. Call `store.seedAdmin()` *as well* when the test also hits a `require_admin`
endpoint, since Curator enforces that from the access token independently of the UI claim. The failure
mode if you forget is quiet: the nav simply renders without the admin destination, and an assertion for
it times out with no clue as to why.

**A dynamic `<title>` can only be proved from the SSR response body.** The router applies
`TitleStrategy.updateTitle()` *after* component construction, so a `setTitle` in a constructor is
silently overwritten by the route's own static `title`. A `TestBed` with `provideRouter([])` runs no
`TitleStrategy`, and `page.title()` reads post-router DOM — **both pass either way**. The one
discriminating assertion is an anonymous `request.get('/catalog/g1')` reading `<title>` out of the raw
body, which is also the branch a crawler actually takes. Verified by moving
`CatalogDetailComponent`'s title call back into the constructor: the unit spec stayed green and
`e2e/catalog.spec.ts`'s SSR assertion went red, with the served body carrying `<title>Game</title>`.

---

## Smoke tests (post-deploy)

`e2e/smoke/api.spec.ts` targets a **deployed** stack. Tests are skipped unless `SmokeBaseUrl` is set.

```powershell
npm run e2e:smoke
```

Smoke tests exercise `GET /health` (must return `Healthy`) and basic reachability of the deployed app.

---

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-librarian.yml`) runs on every push and PR:

1. `npm ci` → lint
2. `npx vitest run --coverage` (LCOV → `coverage/lcov.info`)
3. `npm run e2e` (self-builds the `ci` configuration, then runs Playwright E2E; Chromium cached by version)
4. SonarCloud analysis via `sonarsource/sonarcloud-github-action` (JS LCOV only; no C# paths)
5. `npm run build` (production configuration) → `npm prune --omit=dev` → deploy to `crgolden-librarian` (Linux)
6. Post-deploy smoke (`npm run e2e:smoke` against `webapp-url`)

ADO test results and Azure Monitor telemetry are published from the Playwright JUnit XML
(`playwright-results.xml`), which is written by the `junit` reporter in `playwright.config.ts`.

There is no SQL dacpac in this pipeline.

---

## Local SonarCloud analysis

A single SonarCloud project, `crgolden_Librarian`, covers the Angular client (Vitest LCOV). There is
no C# surface. Use the global sonar-scanner CLI:

**Iterating on tests: use `npm run e2e:run`, which skips the ~85s rebuild.**

| Script | Does | Use when |
|---|---|---|
| `npm run e2e` | `build:ci` → cert → Playwright | source changed, and in CI |
| `npm run e2e:run` | cert → Playwright | only `e2e/` changed |

`e2e:run` reuses whatever is in `dist/`, so **it does not pick up `src/` edits** — that is the trade for
skipping the build. If a source change appears to do nothing, you wanted `npm run e2e`.

**Never call `playwright test` directly.** Both scripts chain
`npx tsx e2e/mocks/generate-oidc-cert.ts` first, and the mock OIDC provider needs that cert to serve
HTTPS discovery. Skipping it fails as `Error: Timed out waiting 30000ms from config.webServer` — which
names the SSR server, not the cert, and looks exactly like a slow cold start.

**To run a subset, pass `--grep` through either script**: `npm run e2e -- --grep "some describe"`. Both
end at the `playwright test` invocation, so npm forwards the argument rather than consuming it as its
own flag — this is why neither script delegates to the other.

**Generate coverage with the *whole* suite.** A filtered run (`vitest run --coverage src/home`)
overwrites `coverage/lcov.info` with only the files that run touched, so a scan straight afterwards
publishes a collapsed coverage number — an 80% gate reads ~1.5% — with nothing in the scanner output
to suggest anything is wrong.

```powershell
# Generate coverage first
npx vitest run --coverage

# Run the scanner (uses global sonar-scanner.properties; override token via env)
$env:SONAR_TOKEN = '<token>'
sonar-scanner `
  -Dsonar.projectKey=crgolden_Librarian `
  -Dsonar.organization=crgolden `
  -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info `
  -Dsonar.exclusions="**/node_modules/**,**/*.d.ts,e2e/**,instrumentation.mjs" `
  -Dsonar.coverage.exclusions="e2e/**,scripts/**,**/*.config.*,src/test-setup.ts,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts" `
  -Dsonar.test.inclusions="**/*.spec.ts"
```

**These flags and the `SonarCloud analysis` step in
`.github/workflows/main_crgolden-librarian.yml` are the only definition of the project's analysis
scope** — this fleet keeps no `sonar-project.properties`, and a CLI flag overrides whatever the
SonarCloud UI has. Keep them in step: when they drift, a local run measures a different denominator
than CI and then *publishes* it, because a local scan with no `-Dsonar.branch.name` replaces the
main-branch analysis until the next push. A narrower local list once understated coverage by several
points and made a passing gate look failed.

**Sync them by fixing whichever is wrong, not by copying one into the other.** Every
`sonar.coverage.exclusions` entry must answer *"could a unit test catch a bug in this file?"* — if
yes, it stays measured however inconvenient the number. Prefer category globs (`scripts/**`,
`**/*.config.*`) over file extensions or filename lists: a glob states the reason and keeps covering
files nobody has written yet, while `**/*.mjs` silently drops any future application module that
happens to use that extension.

The three composition roots — `src/main.ts`, `src/main.server.ts` and `src/server.ts` — answer *no*
together and are excluded together. Each is top-level wiring whose every branch is an import or an
`app.use`; the logic they assemble lives in `src/bff/*` and `src/app/*`, which are measured. A
passing gate is not itself an argument for measuring one of them, and treating `server.ts`
differently from its two siblings is drift, not a decision.

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method table
only when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**.
See `../AGENTS/DESIGN-LANGUAGE.md` and `../AGENTS/TESTING-COVERAGE.md`.
