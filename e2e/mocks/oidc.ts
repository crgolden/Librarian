
import { constants } from 'node:http2';
import express, { type Express, type Request, type Response } from 'express';
import { generateKeyPair, exportJWK, SignJWT, type JWK } from 'jose';
import { newId, newPathSegment, newText } from '@crgolden/modules/testing';
import { ADMIN_CLAIM_VALUE, ClaimTypes, IdentityRoutes, OIDC_SCOPES } from '../../src/shared/bff-contract';
import { e2eContract } from './e2e-identity-contract';
import { TransparentGif } from './gif-constants';
import { JoseConstants, OidcConstants } from '../oidc-constants';
import e2eSettings from '../e2e-settings.json';

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

function newEndpointPath(): string {
  return `/${newPathSegment()}`;
}

const OidcEndpointPaths = {
  authorize: newEndpointPath(),
  token: newEndpointPath(),
  userinfo: newEndpointPath(),
  jwks: newEndpointPath(),
  endSession: newEndpointPath(),
} as const;

const AVATAR_SUB_PARAMETER = newText();

const E2eIdentityCookies = e2eContract().identityCookies;

interface AuthorizationCodeRecord {
  redirectUri: string;
  sub: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export async function createOidcApp(issuer: string): Promise<Express> {
  const { publicKey, privateKey } = await generateKeyPair(JoseConstants.algorithms.rs256);
  const kid = newId();
  const jwk: JWK = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = JoseConstants.algorithms.rs256;
  jwk.use = JoseConstants.keyUses.signature;

  const codes = new Map<string, AuthorizationCodeRecord>();
  const sessions = new Map<string, AuthorizationCodeRecord>();

  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get(OidcConstants.discoveryPath, (_req: Request, res: Response) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}${OidcEndpointPaths.authorize}`,
      token_endpoint: `${issuer}${OidcEndpointPaths.token}`,
      userinfo_endpoint: `${issuer}${OidcEndpointPaths.userinfo}`,
      jwks_uri: `${issuer}${OidcEndpointPaths.jwks}`,
      end_session_endpoint: `${issuer}${OidcEndpointPaths.endSession}`,
      response_types_supported: [OidcConstants.responseTypes.code],
      id_token_signing_alg_values_supported: [JoseConstants.algorithms.rs256],
      scopes_supported: OIDC_SCOPES.split(' '),
      token_endpoint_auth_methods_supported: [OidcConstants.tokenEndpointAuthMethods.clientSecretPost],
      code_challenge_methods_supported: [OidcConstants.codeChallengeMethods.s256],
      claims_supported: [ClaimTypes.sub, ClaimTypes.email, ClaimTypes.name, ClaimTypes.admin],
    });
  });

  app.get(OidcEndpointPaths.jwks, (_req: Request, res: Response) => {
    res.json({ keys: [jwk] });
  });

  app.get(OidcEndpointPaths.authorize, (req: Request, res: Response) => {
    const redirectUri = req.query[OidcConstants.parameters.redirectUri];
    const state = req.query[OidcConstants.parameters.state];
    const sub = readCookie(req, E2eIdentityCookies.sub);
    if (!sub || typeof redirectUri !== 'string' || typeof state !== 'string') {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: OidcConstants.errors.invalidRequest });
      return;
    }
    const email = readCookie(req, E2eIdentityCookies.email) ?? `${sub}@test.invalid`;
    const name = readCookie(req, E2eIdentityCookies.name) ?? email;
    const isAdmin = readCookie(req, E2eIdentityCookies.admin) === String(true);

    const code = newId();
    codes.set(code, { redirectUri, sub, email, name, isAdmin });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set(OidcConstants.parameters.code, code);
    redirectUrl.searchParams.set(OidcConstants.parameters.state, state);
    res.redirect(redirectUrl.href);
  });

  app.post(OidcEndpointPaths.token, async (req: Request, res: Response) => {
    const body = req.body as Record<string, string>;
    const grantCode = body[OidcConstants.parameters.code];
    const record = grantCode === undefined ? undefined : codes.get(grantCode);
    if (record === undefined || grantCode === undefined) {
      res.status(constants.HTTP_STATUS_BAD_REQUEST).json({ error: OidcConstants.errors.invalidGrant });
      return;
    }
    codes.delete(grantCode);

    const clientId = body[OidcConstants.parameters.clientId] ?? null;
    const tokenLifetimeSeconds = e2eSettings.mockTimings.tokenLifetimeSeconds;
    const accessToken = newId();
    sessions.set(accessToken, record);

    const idToken = await new SignJWT({
      email: record.email,
      name: record.name,
      ...(record.isAdmin ? { [ClaimTypes.admin]: ADMIN_CLAIM_VALUE } : {}),
    })
      .setProtectedHeader({ alg: JoseConstants.algorithms.rs256, kid })
      .setSubject(record.sub)
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(clientId)
      .setExpirationTime(`${tokenLifetimeSeconds}${JoseConstants.durationUnits.seconds}`)
      .sign(privateKey);

    res.json({
      access_token: accessToken,
      refresh_token: newId(),
      id_token: idToken,
      token_type: OidcConstants.tokenTypes.bearer,
      expires_in: tokenLifetimeSeconds,
    });
  });

  app.get(OidcEndpointPaths.userinfo, (req: Request, res: Response) => {
    const authorization = req.headers.authorization;
    const record =
      authorization === undefined ? undefined : sessions.get(authorization.replace(/^Bearer\s+/i, ''));
    if (record === undefined) {
      res.status(constants.HTTP_STATUS_UNAUTHORIZED).end();
      return;
    }
    res.json({
      sub: record.sub,
      email: record.email,
      name: record.name,
      ...(record.isAdmin ? { [ClaimTypes.admin]: ADMIN_CLAIM_VALUE } : {}),
    });
  });

  app.get(IdentityRoutes.avatar(`:${AVATAR_SUB_PARAMETER}`), (_req: Request, res: Response) => {
    res.type(TransparentGif.expressType).send(Buffer.from(TransparentGif.base64, TransparentGif.encoding));
  });

  app.get(OidcEndpointPaths.endSession, (_req: Request, res: Response) => {
    res.status(constants.HTTP_STATUS_OK).send(newText());
  });

  return app;
}
