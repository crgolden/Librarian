export const OidcConstants = {
  discoveryPath: '/.well-known/openid-configuration',
  responseTypes: {
    code: 'code',
  },
  parameters: {
    code: 'code',
    state: 'state',
    redirectUri: 'redirect_uri',
    clientId: 'client_id',
  },
  tokenEndpointAuthMethods: {
    clientSecretPost: 'client_secret_post',
  },
  codeChallengeMethods: {
    s256: 'S256',
  },
  tokenTypes: {
    bearer: 'Bearer',
  },
  errors: {
    invalidRequest: 'invalid_request',
    invalidGrant: 'invalid_grant',
  },
} as const;

export const JoseConstants = {
  algorithms: {
    rs256: 'RS256',
  },
  keyUses: {
    signature: 'sig',
  },
  durationUnits: {
    seconds: 's',
  },
} as const;
