const ACCOUNT = 'account';
const PSN = 'psn';
const CATALOG = 'catalog';
const COLLECTIONS = 'collections';
const DEFINITION = 'd';
const CONSOLES = 'consoles';
const SHARED_COLLECTION = 'c';
const LIBRARY = 'library';
const PS_PLUS = 'ps-plus';
const PROFILE = 'profile';
const SETTINGS = 'settings';
const USER = 'u';
const ADMIN = 'admin';
const ENRICHMENT = 'enrichment';
const FAQ = 'faq';
const PRIVACY = 'privacy';

export const RouteParams = {
  gameId: 'gameId',
  definitionId: 'definitionId',
  sub: 'sub',
  slug: 'slug',
} as const;

export const RouteDataKeys = {
  summary: 'summary',
  status: 'status',
  catalog: 'catalog',
  genres: 'genres',
  game: 'game',
  collections: 'collections',
  consoles: 'consoles',
  collection: 'collection',
  library: 'library',
  rotation: 'rotation',
  profile: 'profile',
  followers: 'followers',
  following: 'following',
  settings: 'settings',
  latestRun: 'latestRun',
} as const;

export const AccountAnchors = {
  trophies: 'pref-trophies',
} as const;

export const FollowListKinds = {
  followers: 'followers',
  following: 'following',
} as const;

export type FollowListKind = (typeof FollowListKinds)[keyof typeof FollowListKinds];

export const AppPaths = {
  home: '',
  account: ACCOUNT,
  psn: PSN,
  catalog: CATALOG,
  catalogGame: `${CATALOG}/:${RouteParams.gameId}`,
  collections: COLLECTIONS,
  collectionDefinition: `${COLLECTIONS}/${DEFINITION}/:${RouteParams.definitionId}`,
  userCollections: `${COLLECTIONS}/:${RouteParams.sub}`,
  consoles: CONSOLES,
  sharedCollection: `${SHARED_COLLECTION}/:${RouteParams.slug}`,
  library: LIBRARY,
  psPlus: `${LIBRARY}/${PS_PLUS}`,
  userLibrary: `${LIBRARY}/:${RouteParams.sub}`,
  profile: PROFILE,
  profileFollowers: `${PROFILE}/${FollowListKinds.followers}`,
  profileFollowing: `${PROFILE}/${FollowListKinds.following}`,
  profileSettings: `${PROFILE}/${SETTINGS}`,
  userProfile: `${USER}/:${RouteParams.sub}`,
  userFollowers: `${USER}/:${RouteParams.sub}/${FollowListKinds.followers}`,
  userFollowing: `${USER}/:${RouteParams.sub}/${FollowListKinds.following}`,
  adminEnrichment: `${ADMIN}/${ENRICHMENT}`,
  faq: FAQ,
  privacy: PRIVACY,
  notFound: '**',
} as const;

export const AppUrls = {
  home: '/',
  account: `/${AppPaths.account}`,
  psn: `/${AppPaths.psn}`,
  catalog: `/${AppPaths.catalog}`,
  collections: `/${AppPaths.collections}`,
  collectionDefinitions: `/${COLLECTIONS}/${DEFINITION}`,
  consoles: `/${AppPaths.consoles}`,
  sharedCollections: `/${SHARED_COLLECTION}`,
  library: `/${AppPaths.library}`,
  psPlus: `/${AppPaths.psPlus}`,
  profile: `/${AppPaths.profile}`,
  profileFollowers: `/${AppPaths.profileFollowers}`,
  profileFollowing: `/${AppPaths.profileFollowing}`,
  profileSettings: `/${AppPaths.profileSettings}`,
  users: `/${USER}`,
  admin: `/${ADMIN}`,
  adminEnrichment: `/${AppPaths.adminEnrichment}`,
  faq: `/${AppPaths.faq}`,
  privacy: `/${AppPaths.privacy}`,
} as const;

export function catalogGameUrl(gameId: string): string {
  return `${AppUrls.catalog}/${gameId}`;
}

export function collectionDefinitionUrl(definitionId: string): string {
  return `${AppUrls.collectionDefinitions}/${definitionId}`;
}

export function userCollectionsUrl(sub: string): string {
  return `${AppUrls.collections}/${sub}`;
}

export function sharedCollectionUrl(slug: string): string {
  return `${AppUrls.sharedCollections}/${slug}`;
}

export function userLibraryUrl(sub: string): string {
  return `${AppUrls.library}/${sub}`;
}

export function userProfileUrl(sub: string): string {
  return `${AppUrls.users}/${sub}`;
}

export function userFollowListUrl(sub: string, kind: FollowListKind): string {
  return `${userProfileUrl(sub)}/${kind}`;
}
