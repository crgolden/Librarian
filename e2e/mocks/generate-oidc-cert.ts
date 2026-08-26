
import { writeFileSync } from 'node:fs';
import { generate } from 'selfsigned';
import { OIDC_TLS_CERT_PATH, OIDC_TLS_KEY_PATH } from './oidc-tls-paths.js';

generate([{ name: 'commonName', value: 'localhost' }], { algorithm: 'sha256' }).then(pems => {
  writeFileSync(OIDC_TLS_CERT_PATH, pems.cert);
  writeFileSync(OIDC_TLS_KEY_PATH, pems.private);
  console.log(`[MockOidc] generated self-signed cert at ${OIDC_TLS_CERT_PATH}`);
});
