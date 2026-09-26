import { randomInt, randomUUID } from 'node:crypto';
import type { Express } from 'express';

vi.mock('express-session', () => {
  const MemoryStore = vi.fn();
  const sessionMiddleware = vi.fn();
  const sessionFactory = Object.assign(vi.fn().mockReturnValue(sessionMiddleware), {
    MemoryStore,
  });
  return { default: sessionFactory };
});

vi.mock('redis', () => ({
  createClient: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('connect-redis', () => ({
  RedisStore: vi.fn(),
}));

import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import {
  MEMORY_STORE_IN_PRODUCTION_WARNING,
  REDIS_CONNECTION_ERROR_LOG,
  RedisClientEvents,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SAME_SITE,
  applySession,
} from './session';
import { BffSettingKeys, InvalidSettingError, MEMORY_SESSION_STORE } from './settings';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeApp(): { use: ReturnType<typeof vi.fn> } {
  return { use: vi.fn() };
}

function apply(isProduction = false): { app: { use: ReturnType<typeof vi.fn> }; ready: Promise<void> } {
  const app = makeApp();
  const ready = applySession(app as unknown as Express, { isProduction, logger });
  return { app, ready };
}

function newRedisPort(): number {
  return randomInt(1024, 65536);
}

const REDIS_TUNABLE_KEYS = [
  BffSettingKeys.RedisSocketTimeoutMs,
  BffSettingKeys.RedisPingIntervalMs,
  BffSettingKeys.RedisReconnectStepMs,
  BffSettingKeys.RedisReconnectMaxDelayMs,
  BffSettingKeys.RedisReconnectJitterMs,
] as const;

type RedisTunables = Record<(typeof REDIS_TUNABLE_KEYS)[number], number>;

type RedisReconnectStrategy = (retries: number, cause: Error) => number | Error;

function reconnectStrategy(): RedisReconnectStrategy {
  const callArg = vi.mocked(createClient).mock.calls[0][0] as { socket: { reconnectStrategy: RedisReconnectStrategy } };
  return callArg.socket.reconnectStrategy;
}

function emitRedisEvent(event: string): void {
  const client = vi.mocked(createClient).mock.results[0].value as { on: ReturnType<typeof vi.fn> };
  client.on.mock.calls
    .filter(([name]) => name === event)
    .forEach(([, listener]) => (listener as () => void)());
}

function newTunableMs(): number {
  return randomInt(1, 100_000);
}

function useRedis(host: string, port: number): RedisTunables {
  const socketTimeout = newTunableMs() + 1;
  const tunables: RedisTunables = {
    [BffSettingKeys.RedisSocketTimeoutMs]: socketTimeout,
    [BffSettingKeys.RedisPingIntervalMs]: randomInt(1, socketTimeout),
    [BffSettingKeys.RedisReconnectStepMs]: newTunableMs(),
    [BffSettingKeys.RedisReconnectMaxDelayMs]: newTunableMs(),
    [BffSettingKeys.RedisReconnectJitterMs]: newTunableMs(),
  };
  delete process.env[BffSettingKeys.SessionStore];
  process.env[BffSettingKeys.RedisHost] = host;
  process.env[BffSettingKeys.RedisPort] = String(port);
  REDIS_TUNABLE_KEYS.forEach(key => {
    process.env[key] = String(tunables[key]);
  });
  return tunables;
}

describe('applySession', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    BffSettingKeys.RedisHost,
    BffSettingKeys.RedisPort,
    BffSettingKeys.RedisPassword,
    BffSettingKeys.SessionStore,
    BffSettingKeys.SessionSecret,
    ...REDIS_TUNABLE_KEYS,
  ];

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
    process.env[BffSettingKeys.SessionStore] = MEMORY_SESSION_STORE;
    process.env[BffSettingKeys.SessionSecret] = randomUUID();
    vi.clearAllMocks();
    vi.mocked(session).mockReturnValue(vi.fn() as never);
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    });
  });

  it('throws rather than falling back to MemoryStore when RedisHost is absent', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisPort] = String(newRedisPort());

    expect(() => apply()).toThrow(new InvalidSettingError(BffSettingKeys.RedisHost));
    expect(vi.mocked(session).MemoryStore).not.toHaveBeenCalled();
  });

  it('throws rather than defaulting the port when RedisPort is absent', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisHost] = randomUUID();

    expect(() => apply()).toThrow(new InvalidSettingError(BffSettingKeys.RedisPort));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws when RedisPort is not an integer', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisHost] = randomUUID();
    process.env[BffSettingKeys.RedisPort] = randomUUID();

    expect(() => apply()).toThrow(new InvalidSettingError(BffSettingKeys.RedisPort));
  });

  it.each(REDIS_TUNABLE_KEYS)('throws rather than defaulting %s when it is absent', (key) => {
    useRedis(randomUUID(), newRedisPort());
    delete process.env[key];

    expect(() => apply()).toThrow(new InvalidSettingError(key));
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(REDIS_TUNABLE_KEYS)('throws when %s is not a positive integer', (key) => {
    useRedis(randomUUID(), newRedisPort());
    process.env[key] = String(-newTunableMs());

    expect(() => apply()).toThrow(new InvalidSettingError(key));
  });

  it('throws when the ping interval would not keep a healthy idle socket inside the socket timeout', () => {
    const tunables = useRedis(randomUUID(), newRedisPort());
    process.env[BffSettingKeys.RedisPingIntervalMs] = String(tunables[BffSettingKeys.RedisSocketTimeoutMs]);

    expect(() => apply()).toThrow(new InvalidSettingError(BffSettingKeys.RedisPingIntervalMs));
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws rather than generating a per-process secret when SessionSecret is absent', () => {
    delete process.env[BffSettingKeys.SessionSecret];

    expect(() => apply()).toThrow(new InvalidSettingError(BffSettingKeys.SessionSecret));
    expect(session).not.toHaveBeenCalled();
  });

  it('uses MemoryStore when SessionStore selects it even if Redis is configured', async () => {
    process.env[BffSettingKeys.RedisHost] = randomUUID();
    process.env[BffSettingKeys.RedisPort] = String(newRedisPort());

    await apply().ready;

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('logs a warning when MemoryStore is used in production', async () => {
    await apply(true).ready;

    expect(logger.warn).toHaveBeenCalledWith(MEMORY_STORE_IN_PRODUCTION_WARNING);
  });

  it('creates Redis client without TLS in development', async () => {
    const host = randomUUID();
    const port = newRedisPort();
    const tunables = useRedis(host, port);

    await apply().ready;

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host,
          port,
          socketTimeout: tunables[BffSettingKeys.RedisSocketTimeoutMs],
          reconnectStrategy: expect.any(Function),
        }),
        pingInterval: tunables[BffSettingKeys.RedisPingIntervalMs],
      }),
    );
    const callArg = vi.mocked(createClient).mock.calls[0][0] as Record<string, unknown>;
    expect((callArg['socket'] as Record<string, unknown>)['tls']).toBeUndefined();
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('creates Redis client with TLS in production', async () => {
    const host = randomUUID();
    const port = newRedisPort();
    const password = randomUUID();
    const tunables = useRedis(host, port);
    process.env[BffSettingKeys.RedisPassword] = password;

    await apply(true).ready;

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host,
          port,
          tls: true,
          socketTimeout: tunables[BffSettingKeys.RedisSocketTimeoutMs],
          reconnectStrategy: expect.any(Function),
        }),
        password,
        pingInterval: tunables[BffSettingKeys.RedisPingIntervalMs],
      }),
    );
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('the reconnect strategy backs off with a cap, so a Redis outage cannot become an unbounded reconnect storm', async () => {
    const tunables = useRedis(randomUUID(), newRedisPort());
    const retriesPastTheCap = tunables[BffSettingKeys.RedisReconnectMaxDelayMs];

    await apply().ready;
    emitRedisEvent(RedisClientEvents.ready);

    const delay = reconnectStrategy()(retriesPastTheCap, new Error(randomUUID()));
    expect(delay).toBeGreaterThanOrEqual(tunables[BffSettingKeys.RedisReconnectMaxDelayMs]);
    expect(delay).toBeLessThan(tunables[BffSettingKeys.RedisReconnectMaxDelayMs] + tunables[BffSettingKeys.RedisReconnectJitterMs]);
  });

  it('gives up on the first failed connection before Redis has ever been ready, so startup fails instead of hanging', async () => {
    useRedis(randomUUID(), newRedisPort());
    const connectFailure = new Error(randomUUID());

    await apply().ready;

    expect(reconnectStrategy()(randomInt(0, 100), connectFailure)).toBe(connectFailure);
  });

  it('sets secure=false cookie flag in development', async () => {
    const { app, ready } = apply();
    await ready;

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: false, httpOnly: true, sameSite: SESSION_COOKIE_SAME_SITE }),
      }),
    );
    expect(app.use).toHaveBeenCalledOnce();
  });

  it('sets secure=true cookie flag in production', async () => {
    await apply(true).ready;

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: true }),
      }),
    );
  });

  it('uses the provided SessionSecret', async () => {
    const secret = randomUUID();
    process.env[BffSettingKeys.SessionSecret] = secret;

    await apply().ready;

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ secret }),
    );
  });

  it('names the session cookie with the app cookie name', async () => {
    await apply().ready;

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ name: SESSION_COOKIE_NAME }),
    );
  });

  it('logs a connection error when Redis emits an "error" event', async () => {
    useRedis(randomUUID(), newRedisPort());

    let errorListener: ((err: unknown) => void) | undefined;
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockImplementation((event: string, listener: (err: unknown) => void) => {
        if (event === RedisClientEvents.error) errorListener = listener;
        return { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined) };
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);

    await apply().ready;

    const connectionError = new Error(randomUUID());
    errorListener?.(connectionError);

    expect(logger.error).toHaveBeenCalledWith({ err: connectionError }, REDIS_CONNECTION_ERROR_LOG);
  });

  it('rejects rather than serving when Redis cannot be reached at startup', async () => {
    useRedis(randomUUID(), newRedisPort());
    const connectError = new Error(randomUUID());

    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockRejectedValue(connectError),
    } as never);

    await expect(apply().ready).rejects.toBe(connectError);
  });
});
