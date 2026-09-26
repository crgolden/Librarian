export const SITE_NAME = 'Librarian';

export const PageTitles = {
  account: 'Account',
  catalog: 'Catalog',
  game: 'Game',
  gameNotFound: 'Game not found',
  gameUnavailable: 'Game unavailable',
  collections: 'Collections',
  consoles: 'Consoles & Storage',
  sharedCollection: 'Shared Collection',
  library: 'Library',
  psPlus: 'PlayStation Plus',
  profile: 'Profile',
  followers: 'Followers',
  following: 'Following',
  profileSettings: 'Profile Settings',
  enrichmentRuns: 'Enrichment Runs',
  faq: 'FAQ',
  privacy: 'Privacy Policy',
  pageNotFound: 'Page Not Found',
} as const;

export const NavLabels = {
  home: 'Home',
  privacy: 'Privacy',
  signIn: 'Sign in',
  signOut: 'Sign out',
  more: 'More',
} as const;

export function pageTitle(page: string): string {
  return `${page} — ${SITE_NAME}`;
}
