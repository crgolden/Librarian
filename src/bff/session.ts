import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import type { AppLogger } from '../telemetry/logging';
import {
  BffSettingKeys,
  InvalidSettingError,
  requiredIntegerSetting,
  MEMORY_SESSION_STORE,
  requiredPositiveIntegerSetting,
  requiredSetting,
} from './settings';

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

export const SESSION_COOKIE_NAME = 'librarian.sid';

export const SESSION_COOKIE_SAME_SITE = 'lax';

export const RedisClientEvents = {
  error: 'error',
  ready: 'ready',
} as const;

export const MEMORY_STORE_IN_PRODUCTION_WARNING =
  `[Session] WARNING: using MemoryStore in production. Remove ${BffSettingKeys.SessionStore}=${MEMORY_SESSION_STORE} to switch to Redis.`;

export const REDIS_CONNECTION_ERROR_LOG = '[Redis] Connection error';

function reconnectStrategyFromSettings(hasBeenReady: () => boolean): (retries: number, cause: Error) => number | Error {
  const stepMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectStepMs);
  const maxDelayMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectMaxDelayMs);
  const jitterMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectJitterMs);
  return (retries: number, cause: Error) =>
    hasBeenReady() ? Math.min(retries * stepMs, maxDelayMs) + randomInt(jitterMs) : cause;
}

export function applySession(app: Express, { isProduction, logger }: SessionDependencies): Promise<void> {
  const secret = requiredSetting(BffSettingKeys.SessionSecret);
  const useMemory = process.env[BffSettingKeys.SessionStore] === MEMORY_SESSION_STORE;

  let store: session.Store;
  let ready: Promise<void>;

  if (useMemory) {
    store = new session.MemoryStore();
    ready = Promise.resolve();
    if (isProduction) {
      logger.warn(MEMORY_STORE_IN_PRODUCTION_WARNING);
    }
  } else {
    const host = requiredSetting(BffSettingKeys.RedisHost);
    const port = requiredIntegerSetting(BffSettingKeys.RedisPort);
    const password = process.env[BffSettingKeys.RedisPassword];
    const socketTimeout = requiredPositiveIntegerSetting(BffSettingKeys.RedisSocketTimeoutMs);
    const pingInterval = requiredPositiveIntegerSetting(BffSettingKeys.RedisPingIntervalMs);
    if (pingInterval >= socketTimeout) {
      throw new InvalidSettingError(BffSettingKeys.RedisPingIntervalMs);
    }
    let redisHasBeenReady = false;
    const reconnectStrategy = reconnectStrategyFromSettings(() => redisHasBeenReady);

    const redisClient = isProduction
      ? createClient({
          socket: {
            host,
            port,
            tls: true as const,
            socketTimeout,
            reconnectStrategy,
          },
          password,
          pingInterval,
        })
      : createClient({
          socket: {
            host,
            port,
            socketTimeout,
            reconnectStrategy,
          },
          password,
          pingInterval,
        });

    redisClient.on(RedisClientEvents.error, (err: unknown) => {
      logger.error({ err }, REDIS_CONNECTION_ERROR_LOG);
    });
    redisClient.on(RedisClientEvents.ready, () => {
      redisHasBeenReady = true;
    });

    ready = redisClient.connect().then(() => undefined);
    store = new RedisStore({ client: redisClient });
  }

  app.use(
    session({
      store,
      secret,
      name: SESSION_COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: SESSION_COOKIE_SAME_SITE,
        secure: isProduction,
      },
    }),
  );

  return ready;
}
