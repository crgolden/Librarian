
import { writeFileSync } from 'node:fs';
import { generate } from 'selfsigned';
import { OIDC_TLS_CERT_PATH, OIDC_TLS_KEY_PATH } from './oidc-tls-paths.js';
import { SelfsignedConstants } from './selfsigned-constants.js';
import { LOCAL_HOST } from '../../src/shared/local-host';

generate([{ name: SelfsignedConstants.commonNameAttribute, value: LOCAL_HOST }], { algorithm: SelfsignedConstants.sha256 }).then(pems => {
  writeFileSync(OIDC_TLS_CERT_PATH, pems.cert);
  writeFileSync(OIDC_TLS_KEY_PATH, pems.private);
  console.log(`[MockOidc] generated self-signed cert at ${OIDC_TLS_CERT_PATH}`);
});
