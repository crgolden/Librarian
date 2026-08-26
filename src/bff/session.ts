import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import type { AppLogger } from '../telemetry/logging';

export interface SessionDependencies {
  isProduction: boolean;
  logger: AppLogger;
}

declare module 'express-session' {
  interface SessionData {
    pkceCodeVerifier?: string;
    oauthState?: string;
    returnTo?: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenExpiresAt?: number;
    claims?: { type: string; value: string }[];
  }
}

const SOCKET_TIMEOUT_MS = 90_000;
const PING_INTERVAL_MS = 30_000;

function reconnectStrategy(retries: number): number {
  return Math.min(retries * 100, 3_000) + randomInt(200);
}

export function applySession(app: Express, { isProduction, logger }: SessionDependencies): void {
  const useMemory =
    !process.env['RedisHost'] || process.env['SessionStore'] === 'memory';

  let store: session.Store;

  if (useMemory) {
    store = new session.MemoryStore();
    if (isProduction) {
      logger.warn(
        '[Session] WARNING: using MemoryStore in production. ' +
          'Set RedisHost (and optionally SessionStore) to switch to Redis.',
      );
    }
  } else {
    const host = process.env['RedisHost'] ?? 'localhost';
    const port = parseInt(process.env['RedisPort'] ?? '6380', 10);

    const redisClient = isProduction
      ? createClient({
          socket: {
            host,
            port,
            tls: true as const,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
          password: process.env['RedisPassword'],
          pingInterval: PING_INTERVAL_MS,
        })
      : createClient({
          socket: {
            host,
            port,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
          password: process.env['RedisPassword'],
          pingInterval: PING_INTERVAL_MS,
        });

    redisClient.on('error', (err: unknown) => {
      logger.error({ err }, '[Redis] Connection error');
    });

    redisClient.connect().catch((err: unknown) => {
      logger.error({ err }, '[Redis] Initial connect failed');
    });

    store = new RedisStore({ client: redisClient });
  }

  const secret = process.env['SessionSecret'] ?? crypto.randomUUID();

  app.use(
    session({
      store,
      secret,
      name: 'librarian.sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
    }),
  );
}
