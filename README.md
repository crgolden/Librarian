# Librarian

[![Build and deploy Node.js app to Azure Web App - crgolden-librarian](https://github.com/crgolden/Librarian/actions/workflows/main_crgolden-librarian.yml/badge.svg)](https://github.com/crgolden/Librarian/actions/workflows/main_crgolden-librarian.yml)

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=crgolden_Librarian)](https://sonarcloud.io/summary/new_code?id=crgolden_Librarian)

The web front end of a PlayStation game-curation service: browse a shared game catalog, keep your library
in sync with your PlayStation Network account, build and share collections, track consoles and what is
installed on them, and follow other players. It is an **Angular 22 SSR** application and a **Node.js
Express** Backend-for-Frontend (BFF) in one process. The BFF holds the OIDC session and proxies every data
call to the Curator API, so the browser never sees an access token.

How the parts fit together, the server, the render modes and the pages: [ARCHITECTURE.md](ARCHITECTURE.md).
The visual design language and the rules for every UI change: [DESIGN.md](DESIGN.md). Every test tier and
how to run it: [TESTING.md](TESTING.md).

## Technologies

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (`.nvmrc`), Express 5 |
| Front end | Angular 22 with `@angular/ssr`, zoneless; Tailwind CSS v4; TanStack Table |
| Auth and session | `openid-client` v6 (Authorization Code + PKCE), `express-session` with Redis (`connect-redis`) or in memory |
| Shared packages | `@crgolden/modules` from GitHub Packages (design primitives, design gates, the synthetic walker) |
| Observability | OpenTelemetry over OTLP; `pino` logs to Elasticsearch |
| Tests | Vitest (jsdom and browser mode), Playwright with `playwright-bdd`, axe |
| Hosting | Azure App Service (Linux) |

## Prerequisites

- Node.js 24.
- A GitHub personal access token with the `read:packages` scope. `.npmrc` maps the `@crgolden` scope to
  GitHub Packages, which asks for a token even for a public package. Put it in your user `~/.npmrc`, never
  in this repo:

  ```
  //npm.pkg.github.com/:_authToken=<token>
  ```

- To run the tests: nothing else. The E2E tier starts its own mock Curator API and mock OIDC provider, and
  uses ports 4100, 4101 and 4102.
- To sign in to a running copy: an OIDC provider with a confidential client for this app (redirect
  `<origin>/bff/callback`, scopes `offline_access openid profile email curator`) and a running Curator API.
  Redis is optional locally (`SessionStore=memory`).

## Clone and install

```powershell
git clone https://github.com/crgolden/Librarian.git
cd Librarian
npm ci
```

## Configuration

Every setting is an environment variable; `src/bff/settings.ts` validates them at startup, and a missing
required one stops the process. Locally, put them in `.env.local` (gitignored); `npm start` and
`npm run serve:ssr` load it.

```
PORT=4100
OidcAuthority=<your OIDC provider's authority URL>
LibrarianClientId=<client id>
LibrarianClientSecret=<client secret>
CuratorApiAddress=<Curator API base URL>
SessionSecret=<at least 32 characters>
SessionStore=memory
```

| Setting | Required | Purpose |
|---|---|---|
| `PORT`, `SessionSecret` | always | the listening port; the cookie signing secret |
| `OidcAuthority`, `LibrarianClientId`, `LibrarianClientSecret` | always | the OIDC client |
| `CuratorApiAddress` | always | where `/curator/api/**` is proxied and the sitemap reads the catalog |
| `SessionStore` | no | `memory` keeps sessions in process (lost on restart); unset uses Redis |
| `RedisHost`, `RedisPort`, `RedisPassword` and `RedisSocketTimeoutMs`, `RedisPingIntervalMs`, `RedisReconnectStepMs`, `RedisReconnectMaxDelayMs`, `RedisReconnectJitterMs` | unless `SessionStore=memory` | the session store; the five tunables are positive integers, the ping interval shorter than the socket timeout |
| `PublicBaseUrl` | no | the origin the sitemap advertises; otherwise taken from the request |
| `AlloyEndpoint`, `ElasticsearchNode`, `ElasticsearchUsername`, `ElasticsearchPassword` | no | traces, metrics and logs |

In production each secret is an App Service setting holding a Key Vault reference, which the platform
resolves at startup through the app's managed identity; the app makes no vault calls of its own.

## Run locally

```powershell
npm run build:ci
npm run serve:ssr     # http://localhost:4100: SSR, the BFF and the Curator proxy
```

Use the `ci` build to serve locally: the production configuration only accepts the App Service host, so
`localhost` is answered with a one-line `Header "host" ... is not allowed` page. `serve:ssr` runs the built
`dist/`, so rebuild after a change. For template and style work, `npm start` runs `ng serve` on port 56433
with incremental rebuilds; set `ASPNETCORE_URLS=http://localhost:4100` so its proxy reaches the running
BFF.

## Tests

```powershell
npx vitest run           # unit and browser-unit tiers
npm run e2e              # build:ci, then the Integration and E2E tiers against the mocks
```

Free ports 4100 to 4102 before `npm run e2e`. [TESTING.md](TESTING.md) covers every tier, the mocks, the
synthetic walker that exercises the deployed app on a schedule, and the local SonarCloud scan.

## Gate

`gate.ps1` is the maintainers' gate. It loads a private toolkit from a folder beside this repo, so in a
plain clone it stops at once. To gate your own change, run the checks CI runs, in this order:

```powershell
npm ci
npm run lint
npm run typecheck:e2e
npm run typecheck:spec
npm run lint:css
npm run audit
npm run playwright:install
npm run test:coverage
npm run e2e
npm run lint:utilities
npm run build
```

Every command must exit 0. `lint:utilities` reads the built CSS, so it runs after `e2e`. CI additionally
runs a SonarCloud analysis and fails on any open issue.

## Deployment

`.github/workflows/main_crgolden-librarian.yml` runs the checks above on every push and pull request. On
`main` it builds the production configuration, prunes dev dependencies, and deploys to Azure App Service
over OIDC federated credentials, after checking that the App Service Node version matches `.nvmrc`.
`synthetic.yml` walks the deployed app on a schedule.

| Repository secret or variable | Used by |
|---|---|
| `PACKAGES_READ_TOKEN` (secret) | `npm ci` from GitHub Packages, in both workflows |
| `SONAR_TOKEN` (secret); `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` (variables) | the SonarCloud steps |
| `TEST_RESULTS_PGPASSWORD` (secret); `TEST_RESULTS_PGHOST`, `TEST_RESULTS_PGDATABASE`, `TEST_RESULTS_PGUSER`, `TEST_RESULTS_PGSSLMODE`, `TEST_RESULTS_APP` (variables) | publishing the E2E scenario results to a PostgreSQL results store |
| `AZUREAPPSERVICE_CLIENTID_*`, `AZUREAPPSERVICE_TENANTID_*`, `AZUREAPPSERVICE_SUBSCRIPTIONID_*` | the deploy job |
| `WALKER_BASE_URL` (variable); `PASSKEY_CREDENTIAL1`, `PASSKEY_CREDENTIAL2` (secrets) | the synthetic walker |
