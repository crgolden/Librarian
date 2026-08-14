import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSitemapHandler, resetSitemapCache, robotsHandler } from './sitemap';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const sitemapHandler = createSitemapHandler({ logger });

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

function fakeRequest(headers: Record<string, string> = { host: 'librarian.test' }): Request {
  return {
    protocol: 'https',
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function catalogPage(gameIds: string[], total: number): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ games: gameIds.map((game_id) => ({ game_id })), total }),
  };
}

describe('sitemapHandler', () => {
  beforeEach(() => {
    resetSitemapCache();
    logger.error.mockClear();
    process.env['CuratorApiAddress'] = 'https://curator.test/api';
    delete process.env['PublicBaseUrl'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['CuratorApiAddress'];
    delete process.env['PublicBaseUrl'];
  });

  it('lists the static pages and every catalog game as an absolute url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage(['g1', 'g2'], 2)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.status).toBe(200);
    expect(captured.type).toBe('application/xml');
    expect(captured.body).toContain('<loc>https://librarian.test/</loc>');
    expect(captured.body).toContain('<loc>https://librarian.test/catalog</loc>');
    expect(captured.body).toContain('<loc>https://librarian.test/faq</loc>');
    expect(captured.body).toContain('<loc>https://librarian.test/privacy</loc>');
    expect(captured.body).toContain('<loc>https://librarian.test/catalog/g1</loc>');
    expect(captured.body).toContain('<loc>https://librarian.test/catalog/g2</loc>');
  });

  it('pages until it has every game rather than stopping at the first page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(catalogPage(Array.from({ length: 200 }, (_, i) => `a${i}`), 201))
      .mockResolvedValueOnce(catalogPage(['b0'], 201));
    vi.stubGlobal('fetch', fetchMock);
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(captured.body).toContain('<loc>https://librarian.test/catalog/b0</loc>');
  });

  it('serves the cached document instead of re-querying the catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(catalogPage(['g1'], 1));
    vi.stubGlobal('fetch', fetchMock);

    await sitemapHandler(fakeRequest(), fakeResponse().res);
    await sitemapHandler(fakeRequest(), fakeResponse().res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the last good document when the catalog goes down', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(catalogPage(['g1'], 1))
      .mockRejectedValue(new Error('connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await sitemapHandler(fakeRequest(), fakeResponse().res);
      vi.advanceTimersByTime(61 * 60 * 1000);
      const { res, captured } = fakeResponse();
      await sitemapHandler(fakeRequest(), res);

      expect(captured.status).toBe(200);
      expect(captured.body).toContain('<loc>https://librarian.test/catalog/g1</loc>');
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to build the catalog sitemap',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a bad gateway when the catalog is unreachable and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.status).toBe(502);
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Failed to build the catalog sitemap',
    );
  });

  it('reports a bad gateway when CuratorApiAddress is unset', async () => {
    delete process.env['CuratorApiAddress'];
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.status).toBe(502);
  });

  it('prefers the configured public base url over the request host', async () => {
    process.env['PublicBaseUrl'] = 'https://librarian.crgolden.com/';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage(['g1'], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.body).toContain('<loc>https://librarian.crgolden.com/catalog/g1</loc>');
  });

  it('keeps the signed-in areas out of the document it publishes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage(['g1'], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    for (const prefix of ['/psn', '/collections', '/consoles', '/library', '/profile', '/admin']) {
      expect(captured.body).not.toContain(`<loc>https://librarian.test${prefix}</loc>`);
    }
  });

  it('escapes xml-significant characters in a game id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(catalogPage(['a&b'], 1)));
    const { res, captured } = fakeResponse();

    await sitemapHandler(fakeRequest(), res);

    expect(captured.body).toContain('<loc>https://librarian.test/catalog/a%26b</loc>');
    expect(captured.body).not.toContain('a&b');
  });
});

describe('robotsHandler', () => {
  afterEach(() => {
    delete process.env['PublicBaseUrl'];
  });

  it('points crawlers at the sitemap and keeps the signed-in areas out', () => {
    const { res, captured } = fakeResponse();

    robotsHandler(fakeRequest(), res);

    expect(captured.status).toBe(200);
    expect(captured.body).toContain('Sitemap: https://librarian.test/sitemap.xml');
    for (const prefix of ['/psn', '/collections', '/consoles', '/library', '/profile', '/u/', '/admin', '/c/']) {
      expect(captured.body).toContain(`Disallow: ${prefix}`);
    }
  });
});
