# Librarian

The end-user surface of the PlayStation game-curation project: an **Angular 21 SSR** application
with a **Node.js Express** Backend-for-Frontend (BFF), served by a single Node process. The BFF holds
the OIDC session and proxies every data call to the standalone [Curator](https://github.com/crgolden/Curator)
API; the browser never sees an access token directly.

## Sibling Applications

| Repo | Role | How Librarian interacts |
|---|---|---|
| [Identity](https://github.com/crgolden/Identity) | OIDC Identity Provider | OIDC authorization-code flow via `openid-client` in the Node BFF |
| [Curator](https://github.com/crgolden/Curator) | PlayStation game-curation API | BFF proxies `/curator/api/**` via a `fetch`-based proxy (`src/bff/proxy.ts`), attaching the user Bearer token (scope `curator`) |
| [Infrastructure](https://github.com/crgolden/Infrastructure) | Health monitoring dashboard | Polls `GET /health` (returns `Healthy`) |

## Architecture

A single Node process runs both the Angular 21 SSR renderer and an Express BFF. The BFF owns the
OIDC session (`openid-client` v6, PKCE; scopes `offline_access openid profile email curator`),
proxies `/curator/api/**` to the Curator API with the session's Bearer token, and requires
`X-CSRF: 1` on mutating calls. The current app surface is a home page and a `/psn` settings page
(link/unlink a PlayStation Network account via NPSSO token, backed by Curator's `/me` and
`/psn/link` routes) — Curator has no game/genre catalog endpoints yet, so there's no library UI
to build against until that lands as a follow-up. Frontend is zoneless Angular. Observability:
OTLP traces/metrics → Grafana Alloy; structured logs → Elasticsearch (`pino-elasticsearch`).
`GET /health` → `Healthy`.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Node.js 22 / Express 5 |
| Auth / BFF | `openid-client` v6 + `express-session` + `connect-redis` |
| Frontend | Angular 21 SSR (`@angular/ssr`) |
| Observability | OpenTelemetry → Grafana Alloy (OTLP), `pino` → Elasticsearch |
| Hosting | Azure App Service (Linux, Node 22) |
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
npm run e2e:smoke    # Playwright smoke tests against a deployed stack (SmokeBaseUrl)
```

See [TESTING.md](TESTING.md) for the full E2E / smoke test guide and CI configuration.

## Project Structure

```
src/
  server.ts        # Express app: session, BFF routes, SSR catch-all
  bff/              # openid-client auth, session, Curator proxy, CSRF
  app/              # Angular application shell (routing, guard, interceptor)
  auth/             # auth service + claim helpers
  home/             # home page
  psn/              # PSN link/unlink settings page
  environments/     # per-environment config (allowedHosts, etc.)
  telemetry/        # pino → Elasticsearch logging
e2e/                # TypeScript Playwright E2E + smoke tests
instrumentation.mjs # OpenTelemetry Node SDK init (loaded via --import)
```

## Deployment

Deployed to Azure App Service (Linux, Node 22) as `crgolden-librarian` via GitHub Actions
(`.github/workflows/main_crgolden-librarian.yml`) — build, SonarCloud analysis, Vitest + Playwright
E2E, then deploy and post-deploy smoke test. Secrets fetched from Azure Key Vault via the app's
system-assigned managed identity. See the workspace-level [DEPLOYMENT.md](../DEPLOYMENT.md) for the
full hosting fleet and Key Vault reference.
