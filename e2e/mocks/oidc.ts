
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
  isAdmin: boolean;
}

export async function createOidcApp(issuer: string): Promise<Express> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = 'e2e-mock-key';
  const jwk: JWK = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

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
      claims_supported: ['sub', 'email', 'name', 'curator.admin'],
    });
  });

  app.get('/jwks', (_req: Request, res: Response) => {
    res.json({ keys: [jwk] });
  });

  app.get('/authorize', (req: Request, res: Response) => {
    const redirectUri = req.query['redirect_uri'];
    const state = req.query['state'];
    const sub = readCookie(req, 'e2e_identity');
    if (!sub || typeof redirectUri !== 'string' || typeof state !== 'string') {
      res.status(400).json({ error: 'missing e2e_identity cookie, redirect_uri or state' });
      return;
    }
    const email = readCookie(req, 'e2e_email') ?? `${sub}@test.invalid`;
    const name = readCookie(req, 'e2e_name') ?? email;
    const isAdmin = readCookie(req, 'e2e_admin') === 'true';

    const code = `mock-code-${Math.random().toString(36).slice(2)}`;
    codes.set(code, { redirectUri, sub, email, name, isAdmin });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.href);
  });

  app.post('/token', async (req: Request, res: Response) => {
    const body = req.body as Record<string, string>;
    const grantCode = body['code'];
    const record = grantCode === undefined ? undefined : codes.get(grantCode);
    if (record === undefined || grantCode === undefined) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    codes.delete(grantCode);

    const clientId = body['client_id'] ?? null;
    const now = Math.floor(Date.now() / 1000);
    const accessToken = `mock-access-${record.sub}-${Math.random().toString(36).slice(2)}`;
    sessions.set(accessToken, record);

    const idToken = await new SignJWT({
      email: record.email,
      name: record.name,
      ...(record.isAdmin ? { 'curator.admin': 'true' } : {}),
    })
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
    const authorization = req.headers.authorization;
    const record =
      authorization === undefined ? undefined : sessions.get(authorization.replace(/^Bearer\s+/i, ''));
    if (record === undefined) {
      res.status(401).end();
      return;
    }
    res.json({
      sub: record.sub,
      email: record.email,
      name: record.name,
      ...(record.isAdmin ? { 'curator.admin': 'true' } : {}),
    });
  });

  app.get('/avatar/:sub', (_req: Request, res: Response) => {
    res.type('gif').send(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    );
  });

  app.get('/end-session', (_req: Request, res: Response) => {
    res.status(200).send('<html><body><p>Logged out (mock)</p></body></html>');
  });

  return app;
}
