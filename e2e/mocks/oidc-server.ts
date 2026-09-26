
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { createOidcApp } from './oidc.js';
import { OIDC_TLS_CERT_PATH, OIDC_TLS_KEY_PATH } from './oidc-tls-paths.js';
import { MOCK_OIDC_ORIGIN, MOCK_OIDC_PORT } from './mock-endpoints.js';


createOidcApp(MOCK_OIDC_ORIGIN).then(app => {
  const key = readFileSync(OIDC_TLS_KEY_PATH);
  const cert = readFileSync(OIDC_TLS_CERT_PATH);
  createServer({ key, cert }, app).listen(MOCK_OIDC_PORT, () => {
    console.log(`[MockOidc] Listening on ${MOCK_OIDC_ORIGIN}`);
  });
});
