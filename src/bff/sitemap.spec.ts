import { HttpStatusCode } from '@angular/common/http';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_MAX_ORIGINS,
  CACHE_TTL_MS,
  PAGE_SIZE,
  SITEMAP_BUILD_FAILED_LOG,
  SITEMAP_CONTENT_TYPE,
  STATIC_PATHS,
  createSitemapHandler,
  resetSitemapCache,
  robotsHandler,
} from './sitemap';
import { PRIVATE_PREFIXES, ROBOTS_DISALLOW, ROBOTS_SITEMAP, SITEMAP_PATH } from './sitemap-contract';
import { BffSettingKeys, InvalidSettingError } from './settings';
import { routes } from '../app/app.routes';
import { authGuard } from '../app/auth.guard';
import { catalogGameUrl } from '../app/app-paths';
import { UrlSchemes } from '../testing/url-constants';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const sitemapHandler = createSitemapHandler({ logger });

const REQUEST_PROTOCOL = UrlSchemes.https;

interface Captured {
  status: number;
  type: string;
  body: string;
}

function fakeResponse(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 0, type: '', body: '' };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    type(value: string) {
      captured.type = value;
      return this;
    },
    send(value: string) {
      captured.body = value;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

const newHost = (): string => `${randomUUID()}.test`;

const originOf = (host: string): string => `${REQUEST_PROTOCOL}://${host}`;

const loc = (url: string): string => `<loc>${url}</loc>`;

const gameLoc = (origin: string, gameId: string): string => loc(`${origin}${catalogGameUrl(gameId)}`);

const defaultHost = newHost();

function fakeRequest(headers: Record<string, string> = { host: defaultHost }): Request {
  return {
    protocol: REQUEST_PROTOCOL,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function catalogPage(gameIds: string[], total: number): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return {
    ok: true,
    status: HttpStatusCode.Ok,
    json: () => Promise.resolve({ games: gameIds.map((game_id) => ({ game_id })), total }),
  };
}

const overflowingHosts = Array.from({ length: CACHE_MAX_ORIGINS + 1 }, newHost);

async function askOncePerHost(hosts: readonly string[]): Promise<void> {
  for (const host of hosts) {
    await sitemapHandler(fakeRequest({ host }), fakeResponse().res);
  }
}

const isGuarded = (path: string | undefined): boolean =>
  (routes.find((route) => route.path === path)?.canActivate ?? []).includes(authGuard);

const signedInPaths = routes
  .filter((route) => isGuarded(route.path) || (typeof route.redirectTo === 'string' && isGuarded(route.redirectTo)))
  .map((route) => `/${route.path}/`);

describe('sitemapHandler', () => {
  beforeEach(() => {
    resetSitemapCache();
    logger.error.mockClear();
    process.env[BffSettingKeys.CuratorApiAddress] = `${originOf(newHost())}/${randomUUID()}`;
    delete process.env[BffSettingKeys.PublicBaseUrl];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env[BffSettingKeys.CuratorApiAddress];
    delete process.env[BffSettingKeys.PublicBaseUrl];
  });

  it('lists the static pages and every catalog game as an absolute url', async () => {
    const gameIds = [randomUUID(), randomUUID()];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage(gameIds, gameIds.length)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.status).toBe(HttpStatusCode.Ok);
    expect(captured.type).toBe(SITEMAP_CONTENT_TYPE);
    for (const path of STATIC_PATHS) {
      expect(captured.body).toContain(loc(`${originOf(defaultHost)}${path}`));
    }
    for (const gameId of gameIds) {
      expect(captured.body).toContain(gameLoc(originOf(defaultHost), gameId));
    }
  });

  it('pages until it has every game rather than stopping at the first page', async () => {
    const lastGameId = randomUUID();
    const pages = [
      catalogPage(Array.from({ length: PAGE_SIZE }, () => randomUUID()), PAGE_SIZE + 1),
      catalogPage([lastGameId], PAGE_SIZE + 1),
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(pages[0]).mockResolvedValueOnce(pages[1]);
    vi.stubGlobal('fetch', fetchMock);
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(fetchMock).toHaveBeenCalledTimes(pages.length);
    expect(captured.body).toContain(gameLoc(originOf(defaultHost), lastGameId));
  });

  it('serves the cached document instead of re-querying the catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(catalogPage([randomUUID()], 1));
    vi.stubGlobal('fetch', fetchMock);

    await sitemapHandler(fakeRequest(), fakeResponse().res);
    await sitemapHandler(fakeRequest(), fakeResponse().res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches per origin, so two hosts do not evict each other and pay for the catalog twice', async () => {
    const gameId = randomUUID();
    const hosts = [newHost(), newHost()];
    const [firstHost] = hosts;
    const fetchMock = vi.fn().mockResolvedValue(catalogPage([gameId], 1));
    vi.stubGlobal('fetch', fetchMock);

    await askOncePerHost(hosts);
    const { res, captured } = fakeResponse();
    await sitemapHandler(fakeRequest({ host: firstHost }), res);

    expect(fetchMock).toHaveBeenCalledTimes(hosts.length);
    expect(captured.body).toContain(gameLoc(originOf(firstHost), gameId));
  });

  it('caps the number of origins it keeps, so a varied host header cannot grow the cache without limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(catalogPage([randomUUID()], 1));
    vi.stubGlobal('fetch', fetchMock);

    await askOncePerHost(overflowingHosts);
    await sitemapHandler(fakeRequest({ host: overflowingHosts[0] }), fakeResponse().res);

    expect(fetchMock).toHaveBeenCalledTimes(overflowingHosts.length + 1);
  });

  it('evicts the oldest origin rather than the newest, so the host asking now is not the one that pays again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(catalogPage([randomUUID()], 1));
    vi.stubGlobal('fetch', fetchMock);

    await askOncePerHost(overflowingHosts);
    await sitemapHandler(fakeRequest({ host: overflowingHosts[overflowingHosts.length - 1] }), fakeResponse().res);

    expect(fetchMock).toHaveBeenCalledTimes(overflowingHosts.length);
  });

  it('keeps a document until its time to live runs out, because each rebuild walks the whole catalog at the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(catalogPage([randomUUID()], 1));
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await sitemapHandler(fakeRequest(), fakeResponse().res);
      vi.advanceTimersByTime(CACHE_TTL_MS - 1);
      await sitemapHandler(fakeRequest(), fakeResponse().res);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to the last good document when the catalog goes down', async () => {
    const gameId = randomUUID();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(catalogPage([gameId], 1))
      .mockRejectedValue(new Error(randomUUID()));
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await sitemapHandler(fakeRequest(), fakeResponse().res);
      vi.advanceTimersByTime(CACHE_TTL_MS + 1);
      const { res, captured } = fakeResponse();
      await sitemapHandler(fakeRequest(), res);

      expect(captured.status).toBe(HttpStatusCode.Ok);
      expect(captured.body).toContain(gameLoc(originOf(defaultHost), gameId));
      expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, SITEMAP_BUILD_FAILED_LOG);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a bad gateway when the catalog is unreachable and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(randomUUID())));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.status).toBe(HttpStatusCode.BadGateway);
    expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, SITEMAP_BUILD_FAILED_LOG);
  });

  it('throws rather than answering when CuratorApiAddress is unset', async () => {
    delete process.env[BffSettingKeys.CuratorApiAddress];
    const { res } = fakeResponse();

    await expect(sitemapHandler(fakeRequest(), res)).rejects.toThrow(
      new InvalidSettingError(BffSettingKeys.CuratorApiAddress),
    );
  });

  it('prefers the configured public base url over the request host', async () => {
    const gameId = randomUUID();
    const publicOrigin = originOf(newHost());
    process.env[BffSettingKeys.PublicBaseUrl] = `${publicOrigin}/`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage([gameId], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.body).toContain(gameLoc(publicOrigin, gameId));
  });

  it('keeps the signed-in areas out of the document it publishes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage([randomUUID()], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    for (const prefix of PRIVATE_PREFIXES) {
      expect(captured.body).not.toContain(loc(`${originOf(defaultHost)}${prefix}`));
    }
  });

  it('escapes xml-significant characters in a game id', async () => {
    const before = randomUUID();
    const after = randomUUID();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage([`${before}&${after}`], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.body).toContain(gameLoc(originOf(defaultHost), `${before}%26${after}`));
    expect(captured.body).not.toContain(`${before}&${after}`);
  });
});

describe('robotsHandler', () => {
  afterEach(() => {
    delete process.env[BffSettingKeys.PublicBaseUrl];
  });

  it('points crawlers at the sitemap and keeps the private areas out', () => {
    const { res, captured } = fakeResponse();

    robotsHandler(fakeRequest(), res);

    expect(captured.status).toBe(HttpStatusCode.Ok);
    expect(captured.body).toContain(`${ROBOTS_SITEMAP}${originOf(defaultHost)}${SITEMAP_PATH}`);
    for (const prefix of PRIVATE_PREFIXES) {
      expect(captured.body).toContain(`${ROBOTS_DISALLOW}${prefix}`);
    }
  });

  it.each(signedInPaths)(
    'disallows %s, a page the app guards or redirects to a guarded page',
    (path) => {
      expect(PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix))).toBe(true);
    },
  );
});
