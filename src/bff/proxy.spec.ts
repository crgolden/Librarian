import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response, NextFunction } from 'express';

vi.mock('openid-client', () => ({
  refreshTokenGrant: vi.fn(),
}));

import { refreshTokenGrant } from 'openid-client';
import { ProxyLogMessages, createCuratorProxy, csrfForMutating } from './proxy';
import { SESSION_COOKIE_NAME } from './session';
import { environment } from '../environments/environment';
import { HttpHeaderNames } from '../testing/http-header-constants';
import { newCount, newHttpsAddress, newId, newText, randomIntBetween } from '@crgolden/modules/testing';
import { BffSettingKeys, InvalidSettingError } from './settings';
import { CuratorApi } from '../curator/curator-api';
import { COOKIE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE, MISSING_CSRF_ERROR } from '../shared/bff-contract';
import { AUTHORIZATION_HEADER, BEARER_SCHEME, HopByHopHeaders, WWW_AUTHENTICATE_HEADER, bearerAuthorization } from './http-headers';
import { ContentTypes } from '../shared/content-types';
import { HttpMethods } from './http-headers';

const ISSUER = newHttpsAddress();
const CURATOR_ADDRESS = newHttpsAddress();
const ACCESS_TOKEN = newText();
const REFRESH_TOKEN = newText();

const getOidcConfig = vi.fn().mockResolvedValue({ issuer: ISSUER });
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const curatorProxy = createCuratorProxy({ getOidcConfig, logger });

interface SessionLike {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  save: (cb: (err: unknown) => void) => void;
}

function makeReq(overrides: {
  method?: string;
  headers?: Record<string, string>;
  session?: Partial<SessionLike>;
  originalUrl?: string;
  body?: Buffer;
} = {}): Request {
  const method = overrides.method ?? HttpMethods.get;
  const hasBody = !([HttpMethods.get, HttpMethods.head] as string[]).includes(method);
  const bodyChunk = overrides.body ?? (hasBody ? Buffer.from(JSON.stringify({})) : undefined);

  const originalUrl = overrides.originalUrl ?? CuratorApi.me;
  const url = originalUrl.replace(/^\/curator\/api/, '') || '/';

  const req: Record<string, unknown> = {
    method,
    headers: overrides.headers ?? {},
    originalUrl,
    url,
    session: {
      accessToken: undefined,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      ...overrides.session,
    },
    [Symbol.asyncIterator]: async function* () {
      if (bodyChunk) yield bodyChunk;
    },
  };

  return req as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  return res;
}

const mockNext = vi.fn() as unknown as NextFunction;

function stubFetch(responses: { status: number; headers?: Headers; body?: ArrayBuffer }[]) {
  const mocks = responses.map(r => ({
    status: r.status,
    headers: r.headers ?? new Headers({ [HttpHeaderNames.contentType]: ContentTypes.json }),
    arrayBuffer: vi.fn().mockResolvedValue(r.body ?? new ArrayBuffer(0)),
  }));
  let call = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(mocks[call++])));
}

describe('csrfForMutating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next for GET requests without checking X-CSRF', () => {
    const req = makeReq({ method: HttpMethods.get });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects POST requests missing the X-CSRF header with 403', () => {
    const req = makeReq({ method: HttpMethods.post });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Forbidden);
    expect(res.json).toHaveBeenCalledWith({ error: MISSING_CSRF_ERROR });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next for POST requests that include the X-CSRF header', () => {
    const req = makeReq({ method: HttpMethods.post, headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE } });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('curatorProxy', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv[BffSettingKeys.CuratorApiAddress] = process.env[BffSettingKeys.CuratorApiAddress];
    delete process.env[BffSettingKeys.CuratorApiAddress];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv[BffSettingKeys.CuratorApiAddress] === undefined) {
      delete process.env[BffSettingKeys.CuratorApiAddress];
    } else {
      process.env[BffSettingKeys.CuratorApiAddress] = savedEnv[BffSettingKeys.CuratorApiAddress];
    }
    vi.unstubAllGlobals();
  });

  it('throws rather than answering when CuratorApiAddress is not configured', async () => {
    const req = makeReq();
    const res = makeRes();

    await expect(curatorProxy(req, res as unknown as Response, mockNext)).rejects.toThrow(
      new InvalidSettingError(BffSettingKeys.CuratorApiAddress),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fetches anonymously (no Authorization header) when session has no token', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const req = makeReq({ session: { accessToken: undefined } });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
  });

  it('attaches Bearer token when session holds an access token', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const req = makeReq({ session: { accessToken: ACCESS_TOKEN } });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBe(bearerAuthorization(ACCESS_TOKEN));
  });

  it('proactively refreshes token when within the refresh window of expiry', async () => {
    const refreshedToken = newText();
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);

    vi.mocked(refreshTokenGrant).mockResolvedValue({
      access_token: refreshedToken,
      refresh_token: newText(),
      expires_in: newCount(),
    } as never);

    const req = makeReq({
      session: {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        tokenExpiresAt: Date.now() + randomIntBetween(1, environment.tokenRefreshWindowMs),
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(refreshTokenGrant).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: ISSUER }),
      REFRESH_TOKEN,
    );
    expect((req.session as unknown as SessionLike).accessToken).toBe(refreshedToken);
  });

  it('retries with a refreshed token on a bearer-token 401 (WWW-Authenticate present)', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    const responses = [
      { status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) },
      { status: HttpStatusCode.Ok },
    ];
    stubFetch(responses);

    vi.mocked(refreshTokenGrant).mockResolvedValue({
      access_token: newText(),
      refresh_token: newText(),
      expires_in: newCount(),
    } as never);

    const req = makeReq({
      session: {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(responses.length);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
  });

  it('forwards the 401 without retry when no refresh token is available', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) }]);

    const req = makeReq({
      session: { accessToken: ACCESS_TOKEN, refreshToken: undefined },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
    expect(refreshTokenGrant).not.toHaveBeenCalled();
  });

  it('does not retry a domain-level 401 lacking WWW-Authenticate (e.g. /psn/link auth_failed)', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Unauthorized }]);

    const req = makeReq({
      method: HttpMethods.post,
      headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE },
      session: { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
    expect(refreshTokenGrant).not.toHaveBeenCalled();
  });

  it('forwards non-dropped response headers and strips hop-by-hop headers', async () => {
    const customHeader = `x-${newText()}`;
    const customValue = newText();
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    const responseHeaders = new Headers({
      [HttpHeaderNames.contentType]: ContentTypes.json,
      [HopByHopHeaders.connection]: newId(),
      [customHeader]: customValue,
    });
    stubFetch([{ status: HttpStatusCode.Ok, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(HttpHeaderNames.contentType, ContentTypes.json);
    expect(res.setHeader).toHaveBeenCalledWith(customHeader, customValue);
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.connection, expect.anything());
  });

  it('strips Content-Encoding and Content-Length since fetch() already decompressed the body', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    const responseHeaders = new Headers({
      [HttpHeaderNames.contentType]: ContentTypes.json,
      [HopByHopHeaders.contentEncoding]: newId(),
      [HopByHopHeaders.contentLength]: String(newCount()),
    });
    stubFetch([{ status: HttpStatusCode.Ok, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(HttpHeaderNames.contentType, ContentTypes.json);
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.contentEncoding, expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.contentLength, expect.anything());
  });

  it('removes stale Authorization from forwarded headers when no session token', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);

    const req = makeReq({
      headers: { [AUTHORIZATION_HEADER]: bearerAuthorization(newId()) },
      session: { accessToken: undefined },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBeUndefined();
  });

  it('never forwards the browser session cookie to Curator', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);

    const req = makeReq({
      headers: { [HttpHeaderNames.cookie]: `${SESSION_COOKIE_NAME}=${newText()}`, [HttpHeaderNames.accept]: ContentTypes.json },
      session: { accessToken: ACCESS_TOKEN },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const forwarded = fetchOptions.headers as Record<string, string>;
    expect(forwarded[COOKIE_HEADER.toLowerCase()]).toBeUndefined();
    expect(forwarded[HttpHeaderNames.accept]).toBe(ContentTypes.json);
  });

  it('joins multi-value request headers into a comma-separated string', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Ok }]);

    const req = makeReq({
      headers: { [HttpHeaderNames.accept]: [ContentTypes.json, ContentTypes.plainText] as unknown as string },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[HttpHeaderNames.accept]).toBe(
      `${ContentTypes.json}, ${ContentTypes.plainText}`,
    );
  });

  it('forwards the 401 and warns when the token refresh during retry fails', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) }]);
    const refreshError = new Error(newText());
    vi.mocked(refreshTokenGrant).mockRejectedValueOnce(refreshError);

    const req = makeReq({
      session: {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(logger.warn).toHaveBeenCalledWith(
      { err: refreshError },
      ProxyLogMessages.refreshOn401Failed,
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
  });

  it('buffers a POST body from string chunks and forwards it', async () => {
    process.env[BffSettingKeys.CuratorApiAddress] = CURATOR_ADDRESS;
    stubFetch([{ status: HttpStatusCode.Created }]);

    const req = makeReq({
      method: HttpMethods.post,
      headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE, [HttpHeaderNames.contentType]: ContentTypes.json },
      session: { accessToken: ACCESS_TOKEN },
      body: undefined,
    });

    (req as unknown as Record<PropertyKey, unknown>)[Symbol.asyncIterator] = async function* () {
      yield JSON.stringify({ [newText()]: newText() });
    };

    const res = makeRes();

    await curatorProxy(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Created);
    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(fetchOptions.body).toBeInstanceOf(Uint8Array);
  });
});
