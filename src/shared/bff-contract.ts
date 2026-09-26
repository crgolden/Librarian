export const CSRF_HEADER = 'X-CSRF';

export const CSRF_HEADER_VALUE = '1';

export const COOKIE_HEADER = 'Cookie';

export const MISSING_CSRF_ERROR = `Missing ${CSRF_HEADER} header`;

export const BFF_SEGMENT = 'bff';

export const BFF_PREFIX = `/${BFF_SEGMENT}`;

export const BffRoutes = {
  login: '/login',
  silentLogin: '/silent-login',
  callback: '/callback',
  user: '/user',
  logout: '/logout',
  avatar: (sub: string): string => `/avatar/${sub}`,
} as const;

export const BffPaths = {
  login: `${BFF_PREFIX}${BffRoutes.login}`,
  silentLogin: `${BFF_PREFIX}${BffRoutes.silentLogin}`,
  callback: `${BFF_PREFIX}${BffRoutes.callback}`,
  user: `${BFF_PREFIX}${BffRoutes.user}`,
  logout: `${BFF_PREFIX}${BffRoutes.logout}`,
  avatar: (sub: string): string => `${BFF_PREFIX}${BffRoutes.avatar(sub)}`,
} as const;

export const BFF_USER_RELATIVE_PATH = `${BFF_SEGMENT}${BffRoutes.user}`;

export const SID_QUERY_PARAMETER = 'sid';

export const OIDC_SCOPES = 'offline_access openid profile email curator';

export const IdentityRoutes = {
  avatar: (sub: string): string => `/avatar/${sub}`,
} as const;

export const RETURN_TO_PARAMETER = 'returnTo';

export function loginUrlReturningTo(returnTo: string): string {
  return `${BffPaths.login}?${RETURN_TO_PARAMETER}=${encodeURIComponent(returnTo)}`;
}

export const ClaimTypes = {
  logoutUrl: 'bff:logout_url',
  admin: 'curator.admin',
  sub: 'sub',
  name: 'name',
  email: 'email',
  picture: 'picture',
  sid: 'sid',
} as const;

export const ADMIN_CLAIM_VALUE = 'true';
