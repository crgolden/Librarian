import type { Request, Response } from 'express';
import { logger } from '../telemetry/logging';

const PAGE_SIZE = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const STATIC_PATHS = ['/', '/catalog', '/faq', '/privacy'];

const PRIVATE_PREFIXES = ['/psn', '/collections', '/consoles', '/library', '/profile', '/u/', '/admin', '/c/'];

interface CatalogGame {
  game_id: string;
}

interface CatalogPage {
  games: CatalogGame[];
  total: number;
}

let cached: { xml: string; origin: string; expiresAt: number } | undefined;

export function resetSitemapCache(): void {
  cached = undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function requestOrigin(req: Request): string {
  const configured = process.env['PublicBaseUrl'];
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? req.protocol;
  return `${proto}://${req.get('host') ?? 'localhost'}`;
}

async function fetchGameIds(base: string): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;

  for (;;) {
    const url = new URL('catalog/games', `${base}/`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Curator catalog responded ${response.status}`);
    }

    const page = (await response.json()) as CatalogPage;
    for (const game of page.games) {
      ids.push(game.game_id);
    }

    offset += PAGE_SIZE;
    if (page.games.length === 0 || offset >= page.total) {
      return ids;
    }
  }
}

function buildXml(origin: string, gameIds: string[]): string {
  const locs = [
    ...STATIC_PATHS.map((path) => `${origin}${path}`),
    ...gameIds.map((id) => `${origin}/catalog/${encodeURIComponent(id)}`),
  ];

  const entries = locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export async function sitemapHandler(req: Request, res: Response): Promise<void> {
  const base = (process.env['CuratorApiAddress'] ?? '').replace(/\/$/, '');
  if (!base) {
    res.status(502).type('text/plain').send('CuratorApiAddress is not configured');
    return;
  }

  const origin = requestOrigin(req);
  if (cached?.origin === origin && cached.expiresAt > Date.now()) {
    res.status(200).type('application/xml').send(cached.xml);
    return;
  }

  try {
    const xml = buildXml(origin, await fetchGameIds(base));
    cached = { xml, origin, expiresAt: Date.now() + CACHE_TTL_MS };
    res.status(200).type('application/xml').send(xml);
  } catch (err) {
    logger.error({ err }, 'Failed to build the catalog sitemap');
    if (cached?.origin === origin) {
      res.status(200).type('application/xml').send(cached.xml);
      return;
    }
    res.status(502).type('text/plain').send('Sitemap generation failed');
  }
}

export function robotsHandler(req: Request, res: Response): void {
  const origin = requestOrigin(req);
  const disallow = PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`).join('\n');
  res
    .status(200)
    .type('text/plain')
    .send(`User-agent: *\nAllow: /\n${disallow}\nSitemap: ${origin}/sitemap.xml\n`);
}
