# Testing

The Librarian test suite covers **frontend unit tests** (Vitest) and **browser E2E + synthetic-walker tests**
(TypeScript Playwright). This repo tests the Angular SSR + Node BFF stack; every call to the Curator API
and the OIDC provider goes to a mock this repo ships, so no other service is needed.

Unit tests carry no control flow: no `if`, loop or `try` in a test body.

## Test tiers

| Tier | Tool | Location | Requires live servers? | Runs in CI |
|------|------|----------|------------------------|------------|
| Frontend unit | Vitest, `unit` project (jsdom) | `src/**/*.spec.ts` | No | Every push/PR |
| Browser unit | Vitest browser mode, `browser` and `browser-light` projects (Chromium through `@vitest/browser-playwright`) | `src/**/*.browser.spec.ts` | No | Every push/PR, inside `npm run test:coverage` |
| Integration | Playwright (`--project=integration`), the `request` fixture only | `integration/` | No; Playwright manages the Node SSR server + mock Curator API | Every push/PR, inside `npm run e2e` |
| E2E journeys | Playwright + playwright-bdd (`--project=e2e`), Gherkin | `e2e/features/*.feature`, steps in `e2e/steps/` | No; as Integration | Every push/PR |
| Synthetic walker | Playwright (`--project=synthetic`) | `e2e/synthetic/` | Yes; targets the deployed stack | Scheduled (`synthetic.yml`), never a merge gate |

**A test's tier is the interface it drives.** A property of
one rendered component (geometry, computed style, contrast, an axe scan) is a browser unit test; a request
whose answer is the assertion is Integration; a user outcome reached through the app is an E2E scenario.

### Browser unit tier

`vitest.config.mts` declares three projects. `unit` runs every `*.spec.ts` except `*.browser.spec.ts` in
jsdom. `browser` runs every `*.browser.spec.ts` in Chromium with `colorScheme: 'dark'`, except
`*.light.browser.spec.ts`. `browser-light` runs `*.schemes.browser.spec.ts` and `*.light.browser.spec.ts`
with `colorScheme: 'light'`. **The filename picks the scheme**: a spec asserting something true in both
schemes is `*.schemes.browser.spec.ts`, one true only in light is `*.light.browser.spec.ts`, and no spec
branches on `matchMedia` (CODE-STYLE rule 12). Both projects pin `timezoneId: 'UTC'`.

- `src/test-setup.browser.ts` loads `src/styles.css` and initializes the Angular test environment.
  `src/test-setup-resources.browser.ts` resolves every component's `templateUrl` from an `import.meta.glob`
  map and throws on a duplicate basename. A spec that calls `overrideComponent` calls
  `resolveTestComponentResources()` again after `compileComponents()`, because the override re-queues the
  template.
- **A page is measured inside the app shell**, since the rail takes its width: `provideRouter` with one
  route whose `data` holds the resolved payload (typed with `satisfies` against the resolver's own type,
  because `Data` accepts anything), the real `AuthService` fed a session through
  `HttpTestingController.expectOne(BFF_USER_RELATIVE_PATH)`, then `AppComponent` and
  `router.navigateByUrl`.

---

## Frontend unit tests

```powershell
npx vitest run             # one-shot
npx vitest run --coverage  # LCOV → coverage/lcov.info
```

Vitest runs with `pool: threads` and vitest's default `isolate: true`. Angular 22
is zoneless — always call `fixture.detectChanges()` manually.

**A spec reaches a component's `protected`/`private` members through bracket notation, and
`eslint.config.js` relaxes `@typescript-eslint/dot-notation` for `**/*.spec.ts` so it can.** Dot notation
on those members is a TypeScript access-modifier error, so the rule's default would leave a spec no way to
drive a component at all; `allowPrivateClassPropertyAccess` and `allowProtectedClassPropertyAccess` are
scoped to the spec override block and nothing else. Do not widen that relaxation to `src/**` — production
code reaching a protected member by bracket notation is the defect the rule exists to catch.

**`vitest run` type-checks the specs as well as running them, and the explicit `typecheck.tsconfig` is
what makes that true.** Without a `typecheck` block, esbuild strips the types and a `TS2322` in a spec
reaches `main` untouched: `ng lint`, `lint:css`, `vitest run --coverage` and the
production build all pass on it, and `ng test` — the one command CI does not run — is the only thing
that fails. `vitest.config.mts` sets `typecheck: { enabled: true, tsconfig: './tsconfig.spec.json',
include: ['src/**/*.spec.ts'], ignoreSourceErrors: false }`. Naming the tsconfig is load-bearing rather
than tidy: vitest otherwise resolves the nearest `tsconfig.json`, and this repo's root one is
solution-style (`"files": []` plus `references`), which compiles nothing and would report a clean pass
over a broken spec. Two consequences to expect. **The reported counts roughly double**: each spec file
is listed once as a runtime suite and once as a typecheck suite; coverage totals are unaffected, since only
the runtime pass is instrumented. **Do not diagnose the gap between those two figures as a regression**: `ng test` reports
the runtime-only half *and* fails ten server-side specs (`bff/oidc`, `telemetry/*`) that `npx vitest run`
passes, because its pipeline transforms `vi.mock` differently — `TypeError: __spreadValues is not a
function`. A clean `npm ci` does not change it. Those ten failures are an artefact of the wrong runner,
not of the code, and chasing them costs an hour. And
**`ignoreSourceErrors: false` fails the run on a type error anywhere under `src/`, not only one in a
spec** — but it arrives in a different shape, which matters when reading the tail of a CI log: a spec
error is a failed test under `Type Errors`, while a source error is reported as an *unhandled* error
(`Type Errors  no errors` / `Errors  1 error`) with every suite still green. Both exit non-zero. That is
deliberate, so do not flip the flag to get a red run green.

**The palette's numbers live only in its specs.** `src/styles.contrast.schemes.browser.spec.ts` resolves
every color token through a 1×1 canvas and checks each pair in `e2e-settings.json`'s `contrastPairs`
against its WCAG bar (4.5:1 for text, 3:1 for a control edge or icon under 1.4.11), in both schemes
because of its filename. **A ratio written in a doc is a claim that rots**; the spec is the authority. The
canvas is pre-set to a magenta sentinel before each fill because **Canvas2D ignores an invalid color
silently**, so without it a token that failed to parse would inherit the previous pixel and pass.

**A hover fill carries ink, so it needs its own ratio.** When you add a token that expresses a
*relationship* (a hover that must differ, an edge that must clear a bar), add the pair to `contrastPairs`
in the same change, or the relationship is an assumption rather than a fact.

The theme specs cover structure rather than ratios. `src/styles.theme.browser.spec.ts` (dark, the base):
every surface is darker than mid lightness with the ground darkest, and the `color-scheme` property is
declared. `src/styles.theme.light.browser.spec.ts`: light inverts the ladder rather than introducing a
second design. `src/styles.theme.schemes.browser.spec.ts` (both): no surface, line or text token spends
chroma above `theme.neutralChromaCeiling`, and the page paints the scheme's own ground, which catches a
light re-binding that has silently stopped applying. The focus rings are asserted on the shell's own
controls in `src/app/app-shell.layout.browser.spec.ts`.

**`playwright.config.ts` sets `colorScheme: 'dark'` for the E2E project**, because Playwright's default
is `'light'` and this is a dark-first design.

**Playwright's specs are type-checked too, by their own tsconfig.** `tsconfig.spec.json` includes only
`src/**`, and Playwright transpiles `e2e/**` with esbuild, which strips types without checking them.
`tsconfig.e2e.json` (`include: ["e2e/**/*.ts"]`, `noEmit: true`) plus `npm run typecheck:e2e` closes
that; CI runs it immediately after `Lint`, where it is fast and needs no build. Express 5 types
`req.params[x]` as `string | string[]`, so `e2e/mocks/curator.ts` narrows once through
`pathParam(req, name)`, which throws rather than letting an array reach code expecting a value. **Watch for
`const { id } = req.params` destructuring**: it evades a text search for `req.params[`, so those sites
surface only through `tsc`.

**`isolate: true` is required; `fileParallelism: false` is not.** Isolation gives each file its own jsdom,
which this suite depends on because `document.title` and `<meta>` tags persist between tests within a
file (the catalog-detail and public-collection specs rely on that). Test files run in parallel. **If CI
time regresses, check `isolate` before `fileParallelism`**: isolation is the expensive setting and the one
this suite cannot give up.

**Signal inputs (`input()` / `input.required()`) do not bind under this runner — use the `@Input()`
decorator in any component a spec renders.** Vitest transpiles TypeScript without Angular's `ngtsc`
pass, and it is `ngtsc` that turns an `input()` field into component input metadata; the decorator is a
runtime construct and survives, `input()` does not. Converting `AvatarComponent` to signal inputs made
every binding on it silently inert, and the only signal was `NG0303: Can't bind to 'sub' since it isn't
a known property of 'app-avatar'` on **stderr** — not a failure, and easy to scroll past in a run this
size. The template compiles, the component renders, and every input reads its declared default.

**A `required` signal input turns that silent failure into a loud one, from the wrong place.**
`input.required()` has no declared default to fall back on, so
reading it throws `NG0950: Input is required but no value is available yet` — raised from inside the
*child's* template, several frames below the parent whose binding never attached. The two errors read as
unrelated problems and neither names the cause. Nothing static catches it either: `ng lint`,
`tsc -p tsconfig.spec.json` and vitest's own type-check pass all stay green, because the defect exists
only in metadata `ngtsc` would have produced. **The fix is always the same — use the decorator** — so
treat `NG0303` plus `NG0950` in one run as this bug until proven otherwise.

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

Select by `id`, never by column position or CSS class. Rows built in an Angular `@for` get `[attr.id]="'<name>-' + $index"` and are matched by id prefix.

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
   `/users/{sub}/collections`), and the control API used by test helpers (`e2e/fixtures.ts`,
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

   **The horizontal header is gone; the same two rules transfer to a vertical rail, rotated.** The
   desktop nav is now a sticky left rail, so the failure it can have is not a wrapped row but a
   destination below the fold. The specs therefore assert a **column** count of 1 (the rail must not
   wrap into two columns), keep `min(top) >= 0` verbatim, and add `max(bottom) <= innerHeight` — and the
   loop varies **height** (900, 700) rather than width, because height is the axis a rail runs out of.
   A rail is also structurally immune to the original bug: appending a ninth destination moves nothing
   sideways, so the admin/non-admin shapes cannot diverge the way the header's did.

   **A layout measurement taken in fallback metrics is not a measurement of the shipped layout, and
   `document.fonts.ready` is not enough to prevent one.** When a face fails to load it settles to
   `error` and `fonts.ready` resolves *immediately*, on fallback metrics, so a width that overflows in
   production fits in the measurement. **`document.fonts.check()` has the same hole**: it answers "can I
   render this text now?", and a family with no `@font-face` at all is satisfied by the fallback. So
   `src/test-setup.browser.ts` runs `loadTheWebfontsOrFail` before every browser spec file: it reads the
   first family of each `--font-heading`, `--font-body` and `--font-mono` token, fails naming any family
   no `@font-face` declares, and calls `load()` on every declared face of those families, which rejects
   rather than falling back when a file does not arrive.

   **A broken image is not a missing image — it renders its `alt` text, at whatever width that text
   needs.** `app-avatar` sets explicit `width`/`height`, and that still does not contain a failed load:
   the browser lays out the alt string instead. This wrapped the non-admin header at 1281px the moment
   the nav's initial-letter fallback became an `<img>`, because the alt is the user's email address —
   the chip measured **294px against an expected ~110px**, 35px past the row's capacity. Three things
   follow.

   The component pins its own box, so a failed load can never resize a layout — a production property,
   not a test convenience, since the avatar endpoint can fail in production too. **The declaration that
   does the pinning is `AvatarComponent`'s `@HostBinding('style.width.px')`, not the stylesheet's
   `overflow: hidden`**, and that was measured rather than assumed: with a genuinely broken image
   (`error` fired, `naturalWidth === 0`) and a 60-character alt, the box stayed 28px with `overflow`
   forced to `visible` **and** with the `<img>`'s own width/height stripped, and only reached **514px**
   when the host's inline dimensions were cleared. `overflow: hidden` earns its place with
   `border-radius: 50%`; it is not the overflow guard. An earlier version of this section named it as
   the guard, which would have sent a future reader to defend the wrong line.

   The **mock OIDC server serves `/avatar/:sub`** (a 1×1 GIF): without it the redirect 404s and every
   avatar in the suite is a broken image, so the measured layout is not the shipped one. Same class of
   defect as measuring in fallback font metrics.

   And a test that breaks the image on purpose must **assert that it broke**: the `error` event fired,
   and the `alt` is long enough to overflow if unconstrained. Without both, the width assertion passes on
   a *working* image, which is indistinguishable from not running at all.
   `src/app/app-shell.layout.browser.spec.ts` asserts both before measuring.

   **axe's `incomplete` array is not a pass.** `src/app/pages.a11y.browser.spec.ts` and the shell's own
   scans assert it is empty alongside `violations`, because axe reporting that it *could not evaluate* a
   rule looks identical to a clean scan in every summary that counts only violations. The More sheet is
   scanned **while open** for the same reason: a closed `<dialog>` is `display: none`, so axe skips it and
   reports success.

   **A page is scanned only once it is known to have rendered, or the scan is decorative.** axe reports an
   error paragraph, a redirect or an empty shell as **perfectly accessible**, because there is nothing
   inaccessible on them. `pages.a11y.browser.spec.ts` renders each page from a resolved payload typed
   against its resolver, and asserts `#enrichment-no-run`, the element the resolved "no run yet" state
   renders, before scanning enrichment runs. **The landmark is the entire test; the scan is the assertion it
   protects.**

   **Make layout failures self-diagnosing.** Asserting a bare row count tells you it broke, not why.
   Return the per-child widths, the container width and the content total, and pass them as the
   `expect` message — that is what identified `.user-email` at 232px against a 131px runner-up, and
   showed the header's width was a function of the user's email length rather than a fixed overflow.

   **Admin needs TWO independent grants, and they are not interchangeable.** This paragraph previously
   claimed the opposite of the truth — that `is_admin` reaches the app only through `GET /me` and that
   `AdminService` ignores the BFF's claims array. **It is the claims array that the app reads:**
   `admin.service.ts` reads `auth.session()`, which is `/bff/user`'s claims; `curator.admin` is
   allowlisted in `src/bff/routes.ts` and emitted by the mock OIDC provider. A grep for `.is_admin` across
   `src/` returns **no matches at all** — nothing consumes `MeResponse.is_admin`.

   So:
   - **`signInAsAdmin(page)`** supplies the OIDC `curator.admin` claim that `adminGuard` reads. Without
     it the route does not activate.
   - **`store.seedAdmin()`** (`POST ControlRoutes.admin`) sets the *mock Curator's* own `isAdmin`, which is what
     the `/enrichment/runs*` routes gate on. Without it the route activates and renders
     "Unable to load the latest enrichment run" — **a green-looking page that tested nothing.**

   Order: `reset()` → `seedAdmin()` → `signInAsAdmin()`. Like every other control-route seeder, `seedAdmin`
   writes to `DEFAULT_SUB` regardless of the caller's identity header, so it cannot make `secondAuthedPage` an
   admin; granting a second identity would need a sub-aware handler that does not exist yet.

   The mock has no real bearer-token validation, so it identifies "who is calling" via an identity
   header that each authenticated Playwright fixture injects on every `/curator/api/**` request
   (`applyAuthRoutes` in `e2e/fixtures.ts`).

   **Every name in this handshake is generated, once per run.** The default sub, the identity header's
   name, the four identity cookie names the mock OIDC reads, and every control route are fields of the
   E2E contract (`e2e/mocks/e2e-identity-contract.ts`). `playwright.config.ts` generates it with
   `newE2eContract()` and stores it as JSON in the `E2E_CONTRACT` environment variable, which the
   runner, its workers and both mock servers inherit, so every process reads the same values through
   `e2eContract()`. A value generated inside any one process instead would differ from the others' and
   the handshake would silently miss. `authedPage` and `secondAuthedPage` (a second, distinct
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
Playwright route mocks; no real OIDC provider or Curator is contacted.

**Curator is mocked as a real HTTP server rather than with `page.route()`, and it has to be.**
`page.route()` intercepts *browser* requests only; the calls to Curator are outbound `fetch` calls made
by the Node SSR/BFF process, which Playwright never sees. So `e2e/mocks/curator.ts` serves the real
route shapes over HTTP and tests drive its state through the control API (`ControlRoutes`). It mounts those
routes with **no path prefix**, because `curatorProxy` resolves the upstream path from `req.url`, which
Express has already stripped of the `/curator/api` mount point.

The `e2e` project runs single-worker, non-parallel (`fullyParallel: false`, `workers: 1`, matching the
C# suites' xUnit `Collection` behavior): every spec file shares the same mock server's in-memory state,
so concurrent spec files would race on it.

The mock Curator server auto-registers the calling identity (from the identity header) on every non-control
route — mirroring how a real bearer token always implies an existing `app_users` row by the time a
call reaches Curator (the provider's account creation and Curator's own upsert-on-first-authenticated-request
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

**E2E journeys (`e2e/features/`), one feature per domain concept:** `home`, `browsing-the-catalog`,
`returning-to-the-catalog`, `server-rendered-pages`, `reading-about-librarian`, `getting-around`,
`my-library`, `playstation-plus-rotation`, `collections`, `sharing-a-collection`, `consoles-and-storage`,
`profiles`, `account-settings` and `enrichment-runs`. Steps live in `e2e/steps/<domain>.steps.ts`, built
with `createBdd` over the fixtures in `e2e/steps/fixtures.ts`, which merges playwright-bdd's base test
with `e2e/fixtures.ts`. Feature text names roles and outcomes; ids, generated data and request counting
live only in the steps.

**Integration (`integration/`):** the answers a crawler or a no-script client gets. `pages.spec.ts`: the
home, FAQ and privacy pages are server-rendered, and FAQ and privacy carry their authored anchors in the
server HTML. `catalog.spec.ts`: the list, a deep-linked page and a game page are server-rendered, the
game page's body carries its own `<title>` and social tags, and the sitemap and `robots.txt` answers.

**Where a presentation check lives.** Layout geometry, the palette, theme structure, focus rings, the
app shell's rail, tab bar and More sheet, and every axe scan are browser unit tests beside the component
they measure: `src/app/app-shell.layout.browser.spec.ts`, `src/app/pages.a11y.browser.spec.ts`,
`src/home/home.a11y.light.browser.spec.ts`, and `src/<area>/*.layout.browser.spec.ts` for the home page,
the catalog grid and game page, the library table and Store-match dialog, the profile, and a collection's
preview and detail view.

**`e2e-settings.json`'s `executedTestFloor` is the Integration plus E2E count**: every scenario, each
Scenario Outline example row, and each integration test. Raise it in the same change that adds one.

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
`serve:ssr`, loading `.env.local` and pointing `OidcAuthority` at a **real** provider instead of the
mock on 4102. **A manual `serve:ssr` on 4100 cannot run alongside E2E**; stop it first.

**`Error: Timed out waiting 30000ms from config.webServer` is the two MOCK servers, not the app.** The
three entries carry different budgets — 30s each for `curator-server.ts` and `oidc-server.ts`, 60s for the
SSR bundle — so a bare "30000ms" narrows it to a mock before you read anything else, and the app is not
implicated. Both mocks boot through `npx tsx`, which is fast on an idle machine and can approach the 30s
budget on a saturated one. **Measure the bind time before concluding anything**: start `npx tsx e2e/mocks/curator-server.ts` with
`MOCK_CURATOR_PORT` and `E2E_CONTRACT` set (the mock refuses to start without the contract
`playwright.config.ts` otherwise generates; `JSON.stringify(newE2eContract())` produces one) and poll `Get-NetTCPConnection -LocalPort 4101 -State Listen` in a loop. If it is
seconds, the timeout was a genuine anomaly worth chasing; if it is twenty-plus, the box is saturated and
the fix is to run the suite when it is not — **do not raise the budget to make this go green**, because
the number is currently the only thing that reports a machine too loaded to trust a timing-sensitive
suite.

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

**Guard 2 — the `setup` project (`e2e/setup/environment.setup.ts`).** It resets the mock Curator and
performs one real `/bff/login` round trip, asserting `/bff/user` returns 200 carrying the expected `sub`.
The `e2e` project declares `dependencies: ['setup']`, so a broken environment aborts the whole suite in
seconds with a message naming the port and the cause, rather than one 30s timeout per test blaming a nav
locator.

**Its `timeout` is 60s deliberately.** The login round trip takes a couple of seconds on an idle machine
and can take over twenty on a heavily loaded one, so a tight bound would abort the whole suite spuriously,
the one failure a guard must never have. The goal is a *correct* fast abort, not the fastest possible one.

This is a **setup project, not `globalSetup`**: a setup project runs as tests, with fixtures, tracing and a
per-project count in the report, none of which `globalSetup` gets (Playwright starts `webServer` before
either). `--grep` selects primary tests only and dependency projects run in full, so the guard still fires
during `npm run e2e -- --grep "..."`.

Guard 2 is defense in depth: Guard 1 removes the stale-server failure outright by refusing to adopt
another process's server at all. Two things Guard 2 does **not** catch: a broken `OidcAuthority`/`NODE_EXTRA_CA_CERTS` stops the SSR server
starting, so the run aborts at `webServer` before any test executes; and **the mock OIDC provider does
not validate the client secret**, so a deliberately wrong `LibrarianClientSecret` still passes the guard
and the full suite. No test here covers client-credential misconfiguration.

**Changing `SCOPES` in `src/bff/routes.ts` breaks every authenticated E2E test, and the symptom points at
the wrong thing.** Every authenticated test times out on a locator and the page snapshot shows the
*anonymous* page — it reads like a nav bug when it is a login bug. Check `/bff/user` and the mock
provider's discovery document before touching a component. **The same hazard is far worse in production**:
requesting a scope the provider has not granted this client fails sign-in for every user, so a scope
change has to reach the provider before the app. Prefer `accessTokenClaims`' allowlist in
`src/bff/routes.ts`, which surfaces a claim the access token already carries and needs no provider change.

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
discriminating assertion is an anonymous `request.get` of a seeded game's `/catalog/{game_id}` reading
`<title>` out of the raw body, which is also the branch a crawler actually takes:
`integration/catalog.spec.ts`. Moving `CatalogDetailComponent`'s title call back into the constructor
leaves the unit spec green and turns that test red, with the served body carrying `<title>Game</title>`.

**An E2E step asserts a timestamp through its attribute, never its rendered date.** `e2e/steps/library.steps.ts`
compares `#library-schedule-next`'s `data-next-run-at` with the seeded `next_run_at`, so the runner's
timezone never enters. The `date: 'medium'` pipe formats in the *browser's* timezone, so a spec that
must read a rendered calendar date generates its instant at midday UTC: a midnight-UTC timestamp lands on
the previous day for every negative offset and fails on a US runner while passing in Europe, and midday
leaves twelve hours of slack in both directions.

### Adding an FAQ or privacy section: append it, or retarget `#toc-link-3`

`app-page-toc` builds its links from `headingSelector` in document order and ids them
`toc-link-{{$index}}`, so **the index is positional, not stable**. `e2e/steps/pages.steps.ts` clicks
`#toc-link-3` and asserts `#faq-get-npsso` scrolls into view; insert a new `<h2>` anywhere above that
heading and the click silently retargets a different section, a *green* scenario asserting the wrong
thing. Append new sections at the end of the page, which leaves every existing index untouched. Privacy's
steps select only authored ids, but the same rule applies to it by symmetry.

Both pages' tests assert structure, never copy: every `<h2>` carries a unique authored id, the
server-rendered HTML already holds those ids, and the cross-links, GitHub links and contact address
resolve. A sentence on either page is a claim about live behaviour that only a reader can check, so a
spec pinning its wording would fail on a rewording and pass on a false statement. A copy edit therefore
needs no spec edit, and a new heading needs only its id.

Give every new heading an authored `id`. `page-toc.component.ts:54` reads
`const base = heading.id || slugify(label) || 'section'` and then **writes it back** at line 61
(`heading.id = id`). Two consequences: without an authored id the anchor is derived from the copy and
moves whenever the wording is edited, and it does not exist in the server-rendered HTML at all — the
component assigns it inside `afterNextRender`, so `/faq#some-anchor` shared from anywhere lands at the
top of the page until hydration runs. That is the defect the authored ids on every FAQ and privacy
heading were added to fix; a new section without one silently reintroduces it.

---

## Synthetic walker

`e2e/synthetic/walker.spec.ts` performs a **seeded random walk of the deployed app**: one real
login through the deployed OIDC provider (`/bff/login?returnTo=…`), then a weighted random sequence of
read-only actions (nav rail, catalog browsing, library search/filter/pagination, FAQ, color-scheme flips;
no mutating POSTs; `#library-refresh` is deliberately excluded because it triggers a real enrichment
run). It runs on a schedule from `.github/workflows/synthetic.yml` (twice daily, plus `workflow_dispatch`
with a `seed` input) and is **never a merge gate**: `e2e:synthetic` is deliberately absent from the CI
step list; do not "complete" that list with it. Tests skip unless `WalkerBaseUrl` is set.

There is no separate post-deploy smoke test: `GET /health` and basic reachability are subsumed by a walk
that actually browses the app.

The walker files live under `e2e/`, so `npm run typecheck:e2e` covers them automatically and they
must pass it on every push even though the walker itself never runs in CI gates. The `synthetic`
project declares no `dependencies: ['setup']` — the mock-OIDC cert machinery is local-only.

Environment contract:

| Variable | Meaning |
|---|---|
| `WalkerBaseUrl` | Deployed app URL; also disables `webServer` |
| `SYNTHETIC_SEED` | **Required** decimal uint32; the whole walk derives from it |
| `SYNTHETIC_STEPS` | Optional step budget override; its default and ceiling are `stepBudget` in `e2e/synthetic/walker-settings.json` |
| `PASSKEY_CREDENTIAL1` | The walker account's passkey, as the five-field JSON Playwright's virtual authenticator returns |

**The walker signs in with a passkey, not a password**, through the provider's ordinary passkey
sign-in rather than an exemption, so no password is stored in CI. Enroll a passkey for the walker
account with your provider and store the virtual authenticator's credential as `PASSKEY_CREDENTIAL1`.

**PSN-dependent actions must read the flags, not assume them.** A walker account may or may not carry a
PSN link, and a link's `harvest_trophies` and `allow_friend_writes` may be off. An action gated on any of
these checks at run time and skips cleanly.

Replay a failed walk with the seed from the job summary / failure message:

```powershell
$env:SYNTHETIC_SEED = '<seed>'; $env:WalkerBaseUrl = '<deployed app URL>'; npm run e2e:synthetic
```

Same seed ⇒ same RNG decisions given the same action availability; divergence caused by live-data
drift is expected — the guarantee is the decision sequence.

- **The seed is a run parameter, not unit-test data**; the rule that unit-test data is generated does
  not apply to it, so do not make the seed unrepeatable.
- **A missing locator is an app defect until proven otherwise, and a timeout is not the answer to
  one.** Because the walker picks a rail link at **random**, a page whose `<h1>` lacks
  `id="page-title"` fails on some seeds and not others, and reads like a slow render. That is the class of
  defect the walker exists to surface, so diagnose a failure before raising any timeout. Every page's
  `<h1>` carries `id="page-title"` unconditionally, error branches included.
- **The engine comes from the `@crgolden/modules` package's `synthetic-walker` entry point**, installed
  from GitHub Packages like the rest of the scope ([README.md](README.md#prerequisites)). A 401 on the
  `@crgolden` scope during `npm ci` means the token is missing.
- Walker traffic is identifiable by the User-Agent suffix `crgolden-synthetic/1.0`; the secret marker
  header goes only to the OIDC provider's origin and, through redirect propagation, this app's own
  origin, never to third-party hosts.
- **GitHub disables scheduled workflows after 60 days without repo activity in public repos**;
  a push, a `workflow_dispatch`, or the Actions UI re-enables it. Schedules fire from `main` only.

---

## CI pipeline

The GitHub Actions workflow (`.github/workflows/main_crgolden-librarian.yml`) runs on every push and PR:

1. `npm ci` → lint → `typecheck:e2e` (runs `bddgen` first) → `typecheck:spec` → `lint:css` →
   `npm run audit` (fails on a high or critical advisory)
2. Playwright browsers installed (Chromium cached by version), because the browser unit tier needs them
3. `npm run test:coverage` (all three Vitest projects; LCOV → `coverage/lcov.info`)
4. `npm run e2e` (self-builds the `ci` configuration, runs `bddgen`, then the `integration` and `e2e` projects)
5. The executed count asserted against `executedTestFloor`
6. `publish-bdd-results` sends `cucumber-report/messages.ndjson` to the PostgreSQL results store the
   `TEST_RESULTS_*` settings name; the Cucumber HTML report is uploaded as the
   `librarian-cucumber-report` artifact
7. `lint:utilities`, then SonarCloud analysis via `sonarqube-scan-action`, then a step that fails on any
   open Sonar issue
8. On `main` only: `npm run build` (production configuration) → `npm prune --omit=dev` → deploy to the
   App Service app

There is no post-deploy step. The scheduled synthetic walker (`synthetic.yml`) is what exercises the
deployed app.

---

## Iterating on E2E

**Use `npm run e2e:run`, which skips the rebuild.**

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
own flag, so neither script delegates to the other.

---

## Local SonarCloud analysis

A single SonarCloud project, `crgolden_Librarian`, covers the Angular client (Vitest LCOV). Use the
SonarScanner CLI with `SONAR_TOKEN` in the environment and `sonar.host.url=https://sonarcloud.io` in its
global `conf/sonar-scanner.properties` or as one more `-D` argument.

**Generate coverage with the *whole* suite.** A filtered run (`vitest run --coverage src/home`)
overwrites `coverage/lcov.info` with only the files that run touched, so a scan straight afterwards
publishes a collapsed coverage number — an 80% gate reads ~1.5% — with nothing in the scanner output
to suggest anything is wrong.

```powershell
# Generate coverage first
npx vitest run --coverage

# Run the scanner with SONAR_TOKEN already in the environment
sonar-scanner `
  "-Dsonar.projectKey=crgolden_Librarian" `
  "-Dsonar.organization=crgolden" `
  "-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info" `
  "-Dsonar.exclusions=**/node_modules/**,**/*.d.ts,e2e/**,integration/**,.features-gen/**,instrumentation.mjs,**/*.spec.ts" `
  "-Dsonar.tests=src" `
  "-Dsonar.coverage.exclusions=e2e/**,integration/**,scripts/**,**/*.config.*,src/test-setup*.ts,gate.ps1,src/proxy.conf.js,src/environments/**,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.routes.server.ts" `
  "-Dsonar.test.inclusions=**/*.spec.ts"
```

**Quote each `-D` argument whole**, as above. Unquoted, PowerShell parses `-Dsonar.projectKey=…` as a
parameter named `-Dsonar` and passes the remainder as a separate token, and the scanner exits 1 with
`Unrecognized option: .projectKey=crgolden_Librarian`. It survives interactively often enough to look
correct, then fails the moment the same lines run from a `.ps1`. Quoting the whole argument, rather than
only the value, is what makes the two cases behave alike.

Add `"-Dsonar.branch.name=<branch>"` whenever you are scanning anything other than the default branch;
without it the analysis replaces the main-branch result, as the paragraph below explains.

**These flags and the `SonarCloud analysis` step in
`.github/workflows/main_crgolden-librarian.yml` are the only definition of the project's analysis
scope**: this repo keeps no `sonar-project.properties`, and a CLI flag overrides whatever the
SonarCloud UI has. Keep them in step: when they drift, a local run measures a different denominator
than CI and then *publishes* it, because a local scan with no `-Dsonar.branch.name` replaces the
main-branch analysis until the next push, so a narrower local list understates coverage and makes a
passing gate look failed.

**Sync them by fixing whichever is wrong, not by copying one into the other.** A file is excluded from
coverage only when no unit test could catch a bug in it. Exclusions name categories (globs over folders
and roles) rather than extensions or filename lists: `**/*.mjs` would silently drop any future
application module that happens to use that extension. A pattern that matches nothing is deleted.

The three composition roots — `src/main.ts`, `src/main.server.ts` and `src/server.ts` — answer *no*
together and are excluded together. Each is top-level wiring whose every branch is an import or an
`app.use`; the logic they assemble lives in `src/bff/*` and `src/app/*`, which are measured. A
passing gate is not itself an argument for measuring one of them, and treating `server.ts`
differently from its two siblings is drift, not a decision.

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method truth
table (one row per combination of the method's conditions, each mapped to the test that exercises it) only
when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**.
