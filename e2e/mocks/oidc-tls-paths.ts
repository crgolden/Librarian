
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const OIDC_TLS_CERT_PATH = join(tmpdir(), 'librarian-e2e-oidc-cert.pem');
export const OIDC_TLS_KEY_PATH = join(tmpdir(), 'librarian-e2e-oidc-key.pem');
