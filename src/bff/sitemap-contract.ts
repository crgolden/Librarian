import { BFF_PREFIX } from '../shared/bff-contract';
import { AppUrls } from '../app/app-paths';

export const SITEMAP_PATH = '/sitemap.xml';
export const ROBOTS_PATH = '/robots.txt';
export const ROBOTS_DISALLOW = 'Disallow: ';
export const ROBOTS_SITEMAP = 'Sitemap: ';

export const PRIVATE_PREFIXES: readonly string[] = [
  AppUrls.account,
  AppUrls.psn,
  `${BFF_PREFIX}/`,
  AppUrls.collections,
  AppUrls.consoles,
  AppUrls.library,
  AppUrls.profile,
  `${AppUrls.users}/`,
  AppUrls.admin,
  `${AppUrls.sharedCollections}/`,
];
