/**
 * Mock OpenID Connect provider — stands in for Duende IdentityServer during E2E tests, exercising
 * the *real* `openid-client` authorization-code + PKCE flow (`src/bff/routes.ts`'s `/login` and
 * `/callback`) end to end, including a real signed ID token and a real session cookie.
 *
 * This exists because browser-level `page.route()` mocking of `/bff/user` (the previous approach)
 * can only intercept requests made *by the browser*. Angular's SSR HttpClient issues that same
 * call from Node during rendering, invisible to Playwright, so a mocked `/bff/user` never proved
 * the session was real — it only proved the browser's own client-side calls carried a cookie.
 * Only a genuine `/bff/login` → provider → `/bff/callback` round trip produces a real
 * `librarian.sid` cookie backed by a real server-side session, which is what's needed to catch
 * regressions in cookie forwarding during SSR (see `src/app/app.interceptor.ts`).
 *
 * Identity selection: `/authorize` reads `e2e_identity`/`e2e_email`/`e2e_name` cookies scoped to this
 * origin, not query params. Nothing in the real BFF sends these — `e2e/fixtures.ts` sets them via
 * `page.context().addCookies(...)` before triggering login. A cookie is used rather than
 * `page.route()` query-injection because Playwright's route interception does not see the *target*
 * of an HTTP redirect (only the request that produced it), and `/authorize` is exactly that target
 * (github.com/microsoft/playwright/issues/34994) -- a cookie scoped to this origin, by contrast,
 * rides the redirect navigation automatically, the same way a real browser would carry one.
 *
 * Transport: this module builds a plain Express app; oidc-server.ts serves it over real HTTPS with
 * a self-signed cert (see oidc-tls-paths.ts) so the real BFF's unmodified, always-HTTPS discovery
 * (src/bff/oidc.ts) can complete against it without any insecure-transport allowance in that file.
 */

import express, { type Express, type Request, type Response } from 'express';
import { generateKeyPair, exportJWK, SignJWT, type JWK } from 'jose';

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return undefined;
}

interface AuthorizationCodeRecord {
  redirectUri: string;
  sub: string;
  email: string;
  name: string;
}

export async function createOidcApp(issuer: string): Promise<Express> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = 'e2e-mock-key';
  const jwk: JWK = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  // code -> pending record (consumed once by /token); access_token -> record (read by /userinfo).
  const codes = new Map<string, AuthorizationCodeRecord>();
  const sessions = new Map<string, AuthorizationCodeRecord>();

  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      end_session_endpoint: `${issuer}/end-session`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'curator'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      claims_supported: ['sub', 'email', 'name'],
    });
  });

  app.get('/jwks', (_req: Request, res: Response) => {
    res.json({ keys: [jwk] });
  });

  app.get('/authorize', (req: Request, res: Response) => {
    const redirectUri = String(req.query['redirect_uri'] ?? '');
    const state = String(req.query['state'] ?? '');
    const sub = readCookie(req, 'e2e_identity');
    if (!sub) {
      res.status(400).json({ error: 'missing e2e_identity cookie' });
      return;
    }
    const email = readCookie(req, 'e2e_email') ?? `${sub}@test.invalid`;
    const name = readCookie(req, 'e2e_name') ?? email;

    const code = `mock-code-${Math.random().toString(36).slice(2)}`;
    codes.set(code, { redirectUri, sub, email, name });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.href);
  });

  app.post('/token', async (req: Request, res: Response) => {
    const body = req.body as Record<string, string>;
    const record = codes.get(body['code'] ?? '');
    if (!record) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    codes.delete(body['code']);

    const clientId = body['client_id'] ?? '';
    const now = Math.floor(Date.now() / 1000);
    const accessToken = `mock-access-${record.sub}-${Math.random().toString(36).slice(2)}`;
    sessions.set(accessToken, record);

    const idToken = await new SignJWT({ email: record.email, name: record.name })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject(record.sub)
      .setIssuedAt(now)
      .setIssuer(issuer)
      .setAudience(clientId)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    res.json({
      access_token: accessToken,
      refresh_token: `mock-refresh-${record.sub}`,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  });

  app.get('/userinfo', (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const record = sessions.get(token);
    if (!record) {
      res.status(401).end();
      return;
    }
    res.json({ sub: record.sub, email: record.email, name: record.name });
  });

  app.get('/end-session', (_req: Request, res: Response) => {
    res.status(200).send('<html><body><p>Logged out (mock)</p></body></html>');
  });

  return app;
}
