import { defineConfig, devices } from '@playwright/test';
import { OIDC_TLS_CERT_PATH } from './e2e/mocks/oidc-tls-paths';

const SSR_PORT = 4100;
const MOCK_CURATOR_PORT = 4101;
const MOCK_OIDC_PORT = 4102;

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',

  outputDir: './playwright-artifacts',

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],

  use: {
    baseURL: `http://localhost:${SSR_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
      testMatch: /.*\/e2e\/(?!smoke\/).*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: false,
      workers: 1,
      dependencies: ['setup'],
    },
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: smokeBaseUrl ?? `http://localhost:${SSR_PORT}`,
      },
    },
  ],

  webServer: smokeBaseUrl ? undefined : [
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
        CuratorApiAddress: `http://localhost:${MOCK_CURATOR_PORT}`,
        SessionStore: 'memory',
        NODE_ENV: 'test',
        LibrarianClientId: 'e2e-client-id',
        LibrarianClientSecret: 'e2e-secret',
        OidcAuthority: `https://localhost:${MOCK_OIDC_PORT}`,
        NODE_EXTRA_CA_CERTS: OIDC_TLS_CERT_PATH,
        SessionSecret: 'e2e-test-secret-must-be-at-least-32-chars',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
