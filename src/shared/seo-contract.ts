export const MetaNames = {
  description: 'description',
  robots: 'robots',
} as const;

export const MetaProperties = {
  ogTitle: 'og:title',
  ogDescription: 'og:description',
  ogType: 'og:type',
} as const;

export const OgTypes = {
  article: 'article',
} as const;

export const RobotsDirectives = {
  noIndex: 'noindex',
  noIndexNoFollow: 'noindex, nofollow',
} as const;
