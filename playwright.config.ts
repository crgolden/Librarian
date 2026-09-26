import { defineConfig, devices } from '@playwright/test';
import { newId, newText } from '@crgolden/modules/testing';
import { OIDC_TLS_CERT_PATH } from './e2e/mocks/oidc-tls-paths';
import { E2E_CONTRACT_VARIABLE, newE2eContract } from './e2e/mocks/e2e-identity-contract';
import { MEMORY_SESSION_STORE } from './src/bff/settings';
import {
  MOCK_CURATOR_ORIGIN,
  MOCK_CURATOR_PORT,
  MOCK_OIDC_ORIGIN,
  MOCK_OIDC_PORT,
  SSR_ORIGIN,
  SSR_PORT,
} from './e2e/mocks/mock-endpoints';

process.env[E2E_CONTRACT_VARIABLE] ??= JSON.stringify(newE2eContract());

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',

  outputDir: './playwright-artifacts',

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],

  use: {
    baseURL: SSR_ORIGIN,
    colorScheme: 'dark',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\/e2e\/setup\/.*\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 60_000,
    },
    {
      name: 'e2e',
      testMatch: /.*\/e2e\/(?!synthetic\/).*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
      dependencies: ['setup'],
    },
    {
      name: 'synthetic',
      testDir: './e2e/synthetic',
      timeout: 10 * 60_000,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: walkerBaseUrl ?? SSR_ORIGIN,
        userAgent: `${devices['Desktop Chrome'].userAgent} crgolden-synthetic/1.0`,
      },
    },
  ],

  webServer: walkerBaseUrl ? undefined : [
    {
      command: 'npx tsx e2e/mocks/curator-server.ts',
      port: MOCK_CURATOR_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx tsx e2e/mocks/oidc-server.ts',
      port: MOCK_OIDC_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node --import ./instrumentation.mjs dist/librarian.client/server/server.mjs',
      port: SSR_PORT,
      env: {
        PORT: String(SSR_PORT),
        CuratorApiAddress: MOCK_CURATOR_ORIGIN,
        SessionStore: MEMORY_SESSION_STORE,
        NODE_ENV: 'test',
        LibrarianClientId: newText(),
        LibrarianClientSecret: newText(),
        OidcAuthority: MOCK_OIDC_ORIGIN,
        NODE_EXTRA_CA_CERTS: OIDC_TLS_CERT_PATH,
        SessionSecret: `${newId()}${newId()}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
