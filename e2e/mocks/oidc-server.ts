/**
 * Standalone entry point for the mock OIDC provider.
 * Launched by Playwright's webServer config via: npx tsx e2e/mocks/oidc-server.ts
 *
 * Serves over real HTTPS with the self-signed cert generate-oidc-cert.ts produces (see
 * oidc-tls-paths.ts) -- that script must have already run before this starts.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { createOidcApp } from './oidc.js';
import { OIDC_TLS_CERT_PATH, OIDC_TLS_KEY_PATH } from './oidc-tls-paths.js';

const PORT = parseInt(process.env['MOCK_OIDC_PORT'] ?? '4102', 10);
const ISSUER = process.env['MOCK_OIDC_ISSUER'] ?? `https://localhost:${PORT}`;

createOidcApp(ISSUER).then(app => {
  const key = readFileSync(OIDC_TLS_KEY_PATH);
  const cert = readFileSync(OIDC_TLS_CERT_PATH);
  createServer({ key, cert }, app).listen(PORT, () => {
    console.log(`[MockOidc] Listening on https://localhost:${PORT}`);
  });
});
