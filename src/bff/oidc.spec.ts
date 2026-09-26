import { BffSettingKeys, InvalidSettingError } from './settings';
import { newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const AUTHORITY = newHttpsAddress();
const CLIENT_ID = newId();
const CLIENT_SECRET = newText();

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
}));

const ENV_KEYS = [BffSettingKeys.OidcAuthority, BffSettingKeys.ClientId, BffSettingKeys.ClientSecret];

function setValidEnv(): void {
  process.env[BffSettingKeys.OidcAuthority] = AUTHORITY;
  process.env[BffSettingKeys.ClientId] = CLIENT_ID;
  process.env[BffSettingKeys.ClientSecret] = CLIENT_SECRET;
}

function clearEnv(): void {
  ENV_KEYS.forEach(k => delete process.env[k]);
}

describe('getOidcConfig', () => {
  let getOidcConfig: () => Promise<unknown>;
  let discoveryMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearEnv();
    vi.clearAllMocks();
    vi.resetModules();

    const oidcClientModule = await import('openid-client');
    discoveryMock = vi.mocked(oidcClientModule.discovery);

    const oidcModule = await import('./oidc');
    getOidcConfig = oidcModule.getOidcConfig;
  });

  afterEach(() => clearEnv());

  it('calls discovery with the configured authority, client id, and secret', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: AUTHORITY });

    await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledWith(
      new URL(AUTHORITY),
      CLIENT_ID,
      CLIENT_SECRET,
    );
  });

  it('returns the value produced by discovery', async () => {
    setValidEnv();
    const fakeConfig = { issuer: AUTHORITY };
    discoveryMock.mockResolvedValue(fakeConfig);

    const result = await getOidcConfig();

    expect(result).toBe(fakeConfig);
  });

  it('returns the cached config on subsequent calls without calling discovery again', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: newHttpsAddress() });

    const first = await getOidcConfig();
    const second = await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it.each(ENV_KEYS)('throws naming %s when it is missing', async missing => {
    setValidEnv();
    delete process.env[missing];
    discoveryMock.mockResolvedValue({});

    await expect(getOidcConfig()).rejects.toThrow(new InvalidSettingError(missing));
    expect(discoveryMock).not.toHaveBeenCalled();
  });
});
