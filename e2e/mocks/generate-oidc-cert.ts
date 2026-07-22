/**
 * Generates a self-signed TLS certificate for the mock OIDC provider (see oidc.ts) and writes it to
 * a fixed temp-dir path (oidc-tls-paths.ts). oidc-server.ts loads it to serve real HTTPS; playwright
 * .config.ts points the SSR webServer's NODE_EXTRA_CA_CERTS at the same cert so openid-client's real,
 * unmodified HTTPS-only discovery (src/bff/oidc.ts carries no insecure-transport allowance at all)
 * can complete against it. Run once, synchronously, before any Playwright webServer starts --
 * webServer entries start in parallel, so generating the cert from inside oidc-server.ts itself
 * would race the SSR server's own startup reading NODE_EXTRA_CA_CERTS. See package.json's "e2e"
 * script, which runs this before `playwright test`.
 */

import { writeFileSync } from 'node:fs';
import { generate } from 'selfsigned';
import { OIDC_TLS_CERT_PATH, OIDC_TLS_KEY_PATH } from './oidc-tls-paths.js';

generate([{ name: 'commonName', value: 'localhost' }], { algorithm: 'sha256' }).then(pems => {
  writeFileSync(OIDC_TLS_CERT_PATH, pems.cert);
  writeFileSync(OIDC_TLS_KEY_PATH, pems.private);
  console.log(`[MockOidc] generated self-signed cert at ${OIDC_TLS_CERT_PATH}`);
});
