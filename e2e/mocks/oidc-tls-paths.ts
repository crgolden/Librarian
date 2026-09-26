
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import e2eSettings from '../e2e-settings.json';

export const OIDC_TLS_CERT_PATH = join(tmpdir(), e2eSettings.oidcTlsFileNames.certificate);
export const OIDC_TLS_KEY_PATH = join(tmpdir(), e2eSettings.oidcTlsFileNames.key);
