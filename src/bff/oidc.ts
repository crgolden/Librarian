import {
  discovery,
  type Configuration,
} from 'openid-client';

let _config: Configuration | null = null;

export async function getOidcConfig(): Promise<Configuration> {
  if (_config !== null) {
    return _config;
  }

  const authority = process.env['OidcAuthority'];
  const clientId = process.env['LibrarianClientId'];
  const clientSecret = process.env['LibrarianClientSecret'];

  if (!authority) {
    throw new Error('Missing required environment variable: OidcAuthority');
  }
  if (!clientId) {
    throw new Error('Missing required environment variable: LibrarianClientId');
  }
  if (!clientSecret) {
    throw new Error('Missing required environment variable: LibrarianClientSecret');
  }

  _config = await discovery(new URL(authority), clientId, clientSecret);

  return _config;
}
