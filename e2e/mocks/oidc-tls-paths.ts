/**
 * Single source of truth for the mock OIDC provider's self-signed TLS cert/key paths, shared by
 * the generator (generate-oidc-cert.ts), the server that loads them (oidc-server.ts), and
 * playwright.config.ts (which points the SSR webServer's NODE_EXTRA_CA_CERTS at the cert).
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const OIDC_TLS_CERT_PATH = join(tmpdir(), 'librarian-e2e-oidc-cert.pem');
export const OIDC_TLS_KEY_PATH = join(tmpdir(), 'librarian-e2e-oidc-key.pem');
