# Testing

The Librarian test suite covers **frontend unit tests** (Vitest) and **browser E2E + smoke tests**
(TypeScript Playwright). This repo tests the Angular SSR + Node BFF stack. The Curator API has its
own suite in the [Curator](https://github.com/crgolden/Curator) repo.

Unit test coding standards (no control-flow in tests, etc.) are in the workspace-level
[Unit Test Standards](../TESTING.md#unit-test-standards).

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

Vitest runs with `pool: threads`, `fileParallelism: false`, `testTimeout: 15000`. Angular 21 is zoneless —
always call `fixture.detectChanges()` manually.

---

## E2E tests (regression)

No live servers needed. Playwright manages two local servers for the test run:

1. **Mock Curator API** (`e2e/mocks/curator-server.ts`, backed by `e2e/mocks/curator.ts`) — handles
   `/me`, `/psn/link` (POST/DELETE), `/me/psn-preferences` (GET/PUT), `/trophies/summary`, `/identity`,
   `/presence`, `/devices` (each enforcing the same 404-unlinked/403-flag-off semantics as the real
   backend), the profile/follow routes (`/me/profile-settings`, `/users/{sub}/profile`,
   `/users/{sub}/follow`, `/users/{sub}/followers`, `/users/{sub}/following`, `/users/{sub}/library`,
   `/users/{sub}/collections`), and the `/_test/*` control API used by test helpers (`e2e/fixtures.ts`,
   including `seedPsnPreferences` and the multi-user profile/follow seed methods).

   The mock has no real bearer-token validation, so it identifies "who is calling" via an `X-E2E-Sub`
   header that each authenticated Playwright fixture injects on every `/curator/api/**` request (see
   `e2e/fixtures.ts`'s module docstring). `authedPage` and `secondAuthedPage` (a second, distinct
   identity, each on its own browser context) let a single test drive two simultaneously signed-in
   users — needed for follow/unfollow and cross-viewer profile tests.
2. **Node SSR + BFF server** — starts the built `dist/librarian.client/server/server.mjs` with
   in-memory session store, dummy OIDC values, and `CuratorApiAddress` pointing at the mock.

Every `/bff/**` and `/curator/api/**` call is either handled by the mock server or intercepted by
Playwright route mocks — no real Identity or Curator is contacted.

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
the trust pages), `catalog.spec.ts`, `collections.spec.ts`, `library.spec.ts` (owner mode, plus
sub-keyed viewer mode covered jointly with `profile.spec.ts` below), and `profile.spec.ts` (owner vs.
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
  -Dsonar.coverage.exclusions="e2e/**,src/test-setup.ts" `
  -Dsonar.test.inclusions="**/*.spec.ts"
```

### When to build a truth table

The coverage **score is read from SonarCloud, never hand-maintained** here. Build a per-method table
only when SonarCloud flags a method with **cognitive complexity > 15 AND uncovered conditions > 0**.
See `../DESIGN-LANGUAGE.md` and `../TESTING-COVERAGE.md`.
