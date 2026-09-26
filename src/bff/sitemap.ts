import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response } from 'express';
import type { AppLogger } from '../telemetry/logging';
import { BffSettingKeys, requiredUrlSetting } from './settings';
import { CuratorRoutes } from '../curator/curator-api';
import { AppUrls, catalogGameUrl } from '../app/app-paths';
import { ContentTypes } from '../shared/content-types';
import { LOCAL_HOST } from '../shared/local-host';
import { PRIVATE_PREFIXES, ROBOTS_DISALLOW, ROBOTS_SITEMAP, SITEMAP_PATH } from './sitemap-contract';

export interface SitemapDependencies {
  logger: AppLogger;
}

export const SITEMAP_CONTENT_TYPE = ContentTypes.xml;
export const SITEMAP_BUILD_FAILED_LOG = 'Failed to build the catalog sitemap';
export const SITEMAP_UNAVAILABLE_BODY = 'Sitemap generation failed';

export const PAGE_SIZE = 200;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CACHE_MAX_ORIGINS = 4;
export const STATIC_PATHS: readonly string[] = [AppUrls.home, AppUrls.catalog, AppUrls.faq, AppUrls.privacy];

interface CatalogGame {
  game_id: string;
}

interface CatalogPage {
  games: CatalogGame[];
  total: number;
}

const cached = new Map<string, { xml: string; expiresAt: number }>();

export function resetSitemapCache(): void {
  cached.clear();
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
  const configured = process.env[BffSettingKeys.PublicBaseUrl];
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? req.protocol;
  return `${proto}://${req.get('host') ?? LOCAL_HOST}`;
}

async function fetchGameIds(base: string): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;

  for (;;) {
    const url = new URL(`${base}${CuratorRoutes.catalogGames}`);
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
    ...gameIds.map((id) => `${origin}${catalogGameUrl(encodeURIComponent(id))}`),
  ];

  const entries = locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function createSitemapHandler(
  deps: SitemapDependencies,
): (req: Request, res: Response) => Promise<void> {
  return (req, res) => sitemapHandler(req, res, deps);
}

async function sitemapHandler(
  req: Request,
  res: Response,
  { logger }: SitemapDependencies,
): Promise<void> {
  const base = requiredUrlSetting(BffSettingKeys.CuratorApiAddress).toString().replace(/\/$/, '');

  const origin = requestOrigin(req);
  const entry = cached.get(origin);
  if (entry && entry.expiresAt > Date.now()) {
    res.status(HttpStatusCode.Ok).type(SITEMAP_CONTENT_TYPE).send(entry.xml);
    return;
  }

  try {
    const xml = buildXml(origin, await fetchGameIds(base));
    cached.set(origin, { xml, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cached.size > CACHE_MAX_ORIGINS) {
      const oldest = cached.keys().next();
      if (oldest.done) {
        break;
      }

      cached.delete(oldest.value);
    }

    res.status(HttpStatusCode.Ok).type(SITEMAP_CONTENT_TYPE).send(xml);
  } catch (err) {
    logger.error({ err }, SITEMAP_BUILD_FAILED_LOG);
    if (entry) {
      res.status(HttpStatusCode.Ok).type(SITEMAP_CONTENT_TYPE).send(entry.xml);
      return;
    }
    res.status(HttpStatusCode.BadGateway).type(ContentTypes.plainText).send(SITEMAP_UNAVAILABLE_BODY);
  }
}

export function robotsHandler(req: Request, res: Response): void {
  const origin = requestOrigin(req);
  const disallow = PRIVATE_PREFIXES.map((prefix) => `${ROBOTS_DISALLOW}${prefix}`).join('\n');
  res
    .status(HttpStatusCode.Ok)
    .type(ContentTypes.plainText)
    .send(`User-agent: *\nAllow: /\n${disallow}\n${ROBOTS_SITEMAP}${origin}${SITEMAP_PATH}\n`);
}
