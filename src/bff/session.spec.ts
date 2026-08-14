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
import { applySession } from './session';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeApp(): { use: ReturnType<typeof vi.fn> } {
  return { use: vi.fn() };
}

function apply(isProduction = false): { use: ReturnType<typeof vi.fn> } {
  const app = makeApp();
  applySession(app as unknown as Express, { isProduction, logger });
  return app;
}

describe('applySession', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'RedisHost',
    'RedisPort',
    'RedisPassword',
    'SessionStore',
    'SessionSecret',
  ];

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
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

  it('uses MemoryStore when RedisHost is absent', () => {
    apply();

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses MemoryStore when SessionStore is "memory" even if RedisHost is set', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    process.env['SessionStore'] = 'memory';

    apply();

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('logs a warning when MemoryStore is used in production', () => {
    apply(true);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('MemoryStore in production'),
    );
  });

  it('creates Redis client without TLS in development', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    process.env['RedisPort'] = '6379';

    apply();

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host: 'redis.dev.local',
          port: 6379,
          socketTimeout: 90_000,
          reconnectStrategy: expect.any(Function),
        }),
      }),
    );
    const callArg = vi.mocked(createClient).mock.calls[0][0] as Record<string, unknown>;
    expect((callArg['socket'] as Record<string, unknown>)['tls']).toBeUndefined();
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('creates Redis client with TLS in production', () => {
    process.env['RedisHost'] = 'redis.azure.com';
    process.env['RedisPort'] = '6380';
    process.env['RedisPassword'] = 'secret-password';

    apply(true);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host: 'redis.azure.com',
          port: 6380,
          tls: true,
          socketTimeout: 90_000,
          reconnectStrategy: expect.any(Function),
        }),
        password: 'secret-password',
      }),
    );
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('the reconnect strategy backs off with a cap, so a Redis outage cannot become an unbounded reconnect storm', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    process.env['RedisPort'] = '6379';

    apply();

    const callArg = vi.mocked(createClient).mock.calls[0][0] as { socket: { reconnectStrategy: (retries: number) => number } };
    const delay = callArg.socket.reconnectStrategy(1000);
    expect(delay).toBeGreaterThanOrEqual(3_000);
    expect(delay).toBeLessThan(3_200);
  });

  it('defaults RedisPort to 6380 when RedisPort is not set', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    apply();

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    expect((callArg as Record<string, unknown>)['socket']).toMatchObject({ port: 6380 });
  });

  it('sets secure=false cookie flag in development', () => {
    const app = apply();

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: false, httpOnly: true, sameSite: 'lax' }),
      }),
    );
    expect(app.use).toHaveBeenCalledOnce();
  });

  it('sets secure=true cookie flag in production', () => {
    apply(true);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: true }),
      }),
    );
  });

  it('uses the provided SessionSecret', () => {
    process.env['SessionSecret'] = 'my-long-random-secret';

    apply();

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'my-long-random-secret' }),
    );
  });

  it('uses the cookie name "librarian.sid"', () => {
    apply();

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'librarian.sid' }),
    );
  });

  it('logs a connection error when Redis emits an "error" event', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    let errorListener: ((err: unknown) => void) | undefined;
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockImplementation((event: string, listener: (err: unknown) => void) => {
        if (event === 'error') errorListener = listener;
        return { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined) };
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);

    apply();

    const connectionError = new Error('ECONNREFUSED');
    errorListener?.(connectionError);

    expect(logger.error).toHaveBeenCalledWith({ err: connectionError }, '[Redis] Connection error');
  });

  it('logs a connect error when Redis initial connect rejects', async () => {
    process.env['RedisHost'] = 'redis.dev.local';
    const connectError = new Error('initial connect failed');

    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockRejectedValue(connectError),
    } as never);

    apply();

    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(logger.error).toHaveBeenCalledWith({ err: connectError }, '[Redis] Initial connect failed');
  });
});
