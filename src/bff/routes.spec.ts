import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response, NextFunction } from 'express';

const capturedHandlers = new Map<string, ((...args: unknown[]) => unknown)[]>();

function handlersRegisteredFor(path: string): ((...args: unknown[]) => unknown)[] {
  const fns = capturedHandlers.get(path);
  if (fns === undefined) {
    throw new Error(`No handler was registered for ${path}`);
  }
  return fns;
}

vi.mock('express', () => ({
  Router: vi.fn(() => ({
    get: vi.fn((path: string, ...fns: ((...args: unknown[]) => unknown)[]) => {
      capturedHandlers.set(path, fns);
    }),
  })),
}));

vi.mock('openid-client', () => ({
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  buildEndSessionUrl: vi.fn(),
  fetchUserInfo: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  randomState: vi.fn(),
}));

import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  fetchUserInfo,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';
import { newCount, newEmailAddress, newHostname, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';
import { BffErrors, buildBffRouter, ID_TOKEN_HINT_PARAMETER, requireCsrf } from './routes';
import { BffPaths, BffRoutes, ClaimTypes, CSRF_HEADER, CSRF_HEADER_VALUE, MISSING_CSRF_ERROR, SID_QUERY_PARAMETER } from '../shared/bff-contract';
import { AppUrls } from '../app/app-paths';
import { UrlSchemes } from '../testing/url-constants';

const ISSUER = newHttpsAddress();
const AUTHORIZATION_URL = new URL(newHttpsAddress());
const PKCE_VERIFIER = newText();
const OAUTH_STATE = newText();
const ACCESS_TOKEN = newText();
const REFRESH_TOKEN = newText();
const ID_TOKEN = newText();
const USER_SUB = newId();
const EXPRESS_SESSION_ID = newId();
const PROVIDER_SESSION_ID = newId();
const TOKEN_LIFETIME_SECONDS = newCount();

vi.mocked(buildAuthorizationUrl).mockReturnValue(AUTHORIZATION_URL);
vi.mocked(buildEndSessionUrl).mockReturnValue(new URL(newHttpsAddress()));
vi.mocked(randomPKCECodeVerifier).mockReturnValue(PKCE_VERIFIER);
vi.mocked(calculatePKCECodeChallenge).mockResolvedValue(newText());
vi.mocked(randomState).mockReturnValue(OAUTH_STATE);

const getOidcConfig = vi.fn().mockResolvedValue({ issuer: ISSUER });
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

interface Session {
  pkceCodeVerifier?: string;
  oauthState?: string;
  returnTo?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenExpiresAt?: number;
  claims?: { type: string; value: string }[];
  save: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    save: vi.fn((cb: (err: unknown) => void) => cb(null)),
    destroy: vi.fn((cb: (err: unknown) => void) => cb(null)),
    ...overrides,
  };
}

function makeReq(overrides: {
  headers?: Record<string, string>;
  session?: Partial<Session>;
  query?: Record<string, string>;
  originalUrl?: string;
  sessionID?: string;
} = {}): Request {
  return {
    headers: { host: newHostname(), ...(overrides.headers ?? {}) },
    protocol: UrlSchemes.https,
    session: makeSession(overrides.session),
    sessionID: overrides.sessionID ?? newId(),
    query: overrides.query ?? {},
    originalUrl: overrides.originalUrl ?? `${BffPaths.callback}?code=${newText()}&state=${OAUTH_STATE}`,
  } as unknown as Request;
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn(),
    end: vi.fn(),
  };
}

const mockNext = vi.fn() as unknown as NextFunction;

beforeAll(() => {
  buildBffRouter({ getOidcConfig, logger });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireCsrf', () => {
  it('calls next when X-CSRF header is present', () => {
    const req = makeReq({ headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE } });
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 403 when X-CSRF header is absent', () => {
    const req = makeReq();
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Forbidden);
    expect(res.json).toHaveBeenCalledWith({ error: MISSING_CSRF_ERROR });
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe(BffPaths.login, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.login);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('saves PKCE state to session and redirects to the authorization URL', async () => {
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.pkceCodeVerifier).toBe(PKCE_VERIFIER);
    expect(session.oauthState).toBe(OAUTH_STATE);
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith(AUTHORIZATION_URL.href);
  });

  it('responds 500 when OIDC configuration fails', async () => {
    getOidcConfig.mockRejectedValueOnce(new Error(newText()));
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.loginFailed });
  });

  it('stores a same-origin returnTo path from the query string', async () => {
    const req = makeReq({ query: { returnTo: AppUrls.account } });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).returnTo).toBe(AppUrls.account);
  });

  it('falls back to "/" for an unsafe returnTo (open-redirect guard)', async () => {
    const req = makeReq({ query: { returnTo: `//${newHostname()}` } });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).returnTo).toBe(AppUrls.home);
  });

  it('falls back to "/" when returnTo is absent', async () => {
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).returnTo).toBe(AppUrls.home);
  });
});

describe(BffPaths.callback, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.callback);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when PKCE verifier or OAuth state is missing from the session', async () => {
    const req = makeReq({ session: { pkceCodeVerifier: undefined, oauthState: undefined } });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionState });
  });

  it('responds 500 when the ID token has no sub claim', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      id_token: ID_TOKEN,
      expires_in: TOKEN_LIFETIME_SECONDS,
      claims: () => ({ iss: ISSUER }),
    } as never);
    const req = makeReq({
      session: { pkceCodeVerifier: PKCE_VERIFIER, oauthState: OAUTH_STATE },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.missingSub });
  });

  it('stores tokens in session and redirects to "/" on success', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      id_token: ID_TOKEN,
      expires_in: TOKEN_LIFETIME_SECONDS,
      claims: () => ({ sub: USER_SUB, email: newEmailAddress() }),
    } as never);
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ sub: USER_SUB, name: newText() });

    const req = makeReq({
      session: { pkceCodeVerifier: PKCE_VERIFIER, oauthState: OAUTH_STATE },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.accessToken).toBe(ACCESS_TOKEN);
    expect(session.refreshToken).toBe(REFRESH_TOKEN);
    expect(session.idToken).toBe(ID_TOKEN);
    expect(session.pkceCodeVerifier).toBeUndefined();
    expect(session.oauthState).toBeUndefined();
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith(AppUrls.home);
  });

  it('redirects to the stored returnTo path and clears it from the session', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      id_token: ID_TOKEN,
      expires_in: TOKEN_LIFETIME_SECONDS,
      claims: () => ({ sub: USER_SUB, email: newEmailAddress() }),
    } as never);
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ sub: USER_SUB, name: newText() });

    const req = makeReq({
      session: { pkceCodeVerifier: PKCE_VERIFIER, oauthState: OAUTH_STATE, returnTo: AppUrls.account },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.redirect).toHaveBeenCalledWith(AppUrls.account);
    expect((req.session as unknown as Session).returnTo).toBeUndefined();
  });

  it('responds 500 when authorizationCodeGrant throws', async () => {
    vi.mocked(authorizationCodeGrant).mockRejectedValueOnce(new Error(newText()));
    const req = makeReq({
      session: { pkceCodeVerifier: PKCE_VERIFIER, oauthState: OAUTH_STATE },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.callbackFailed });
  });

  it('flattens array claim values into one entry per element', async () => {
    const arrayClaimType = newText();
    const arrayClaimValues = [newText(), newText()];
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      id_token: ID_TOKEN,
      expires_in: TOKEN_LIFETIME_SECONDS,
      claims: () => ({ sub: USER_SUB, [arrayClaimType]: arrayClaimValues }),
    } as never);
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ sub: USER_SUB });

    const req = makeReq({
      session: { pkceCodeVerifier: PKCE_VERIFIER, oauthState: OAUTH_STATE },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    const arrayClaims = (session.claims ?? []).filter(c => c.type === arrayClaimType);
    expect(arrayClaims).toEqual(arrayClaimValues.map((value) => ({ type: arrayClaimType, value })));
  });
});

describe(BffPaths.user, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.user);
    return fns[1] as (req: Request, res: Response) => void;
  }

  it('answers an anonymous visitor with 200 and a null body, so the browser logs no failed request', () => {
    const req = makeReq({ session: { claims: undefined } });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('builds bff:logout_url from the provider sid claim, never the express session id', () => {
    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      session: {
        claims: [
          { type: ClaimTypes.sub, value: USER_SUB },
          { type: ClaimTypes.sid, value: PROVIDER_SESSION_ID },
        ],
      },
    });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        { type: ClaimTypes.logoutUrl, value: `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${PROVIDER_SESSION_ID}` },
      ]),
    );
    const [emitted] = vi.mocked(res.json).mock.calls[0] as [{ type: string; value: string }[]];
    expect(JSON.stringify(emitted)).not.toContain(EXPRESS_SESSION_ID);
  });

  it('omits the sid parameter entirely when the provider issued no sid claim', () => {
    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      session: { claims: [{ type: ClaimTypes.sub, value: USER_SUB }] },
    });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([{ type: ClaimTypes.logoutUrl, value: BffPaths.logout }]),
    );
  });
});

describe(BffPaths.logout, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.logout);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when the sid query parameter is absent and the session carries a sid claim', async () => {
    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: {},
      session: { claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('responds 400 when sid carries the express session id rather than the provider sid', async () => {
    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: { sid: EXPRESS_SESSION_ID },
      session: { claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('responds 400 when sid does not match the provider sid claim', async () => {
    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: { sid: newId() },
      session: { claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('destroys the session and redirects with id_token_hint when an ID token is stored', async () => {
    const endSessionUrl = new URL(newHttpsAddress());
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(endSessionUrl);

    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: { sid: PROVIDER_SESSION_ID },
      session: { idToken: ID_TOKEN, claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).destroy).toHaveBeenCalledOnce();
    expect(buildEndSessionUrl).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: ISSUER }),
      expect.objectContaining({ [ID_TOKEN_HINT_PARAMETER]: ID_TOKEN }),
    );
    expect(res.redirect).toHaveBeenCalledWith(endSessionUrl.href);
  });

  it('falls back to redirect("/") when OIDC configuration throws during logout', async () => {
    getOidcConfig.mockRejectedValueOnce(new Error(newText()));

    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: { sid: PROVIDER_SESSION_ID },
      session: { idToken: undefined, claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.redirect).toHaveBeenCalledWith(AppUrls.home);
  });

  it('redirects without id_token_hint when no ID token is in the session', async () => {
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(
      new URL(newHttpsAddress()),
    );

    const req = makeReq({
      sessionID: EXPRESS_SESSION_ID,
      query: { sid: PROVIDER_SESSION_ID },
      session: { idToken: undefined, claims: [{ type: ClaimTypes.sid, value: PROVIDER_SESSION_ID }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const [, params] = vi.mocked(buildEndSessionUrl).mock.calls[0] as [unknown, Record<string, string>];
    expect(params[ID_TOKEN_HINT_PARAMETER]).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledOnce();
  });
});
