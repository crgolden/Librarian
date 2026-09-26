import { LOCAL_HOST } from '../../src/shared/local-host';
import e2eSettings from '../e2e-settings.json';

export const SSR_PORT = e2eSettings.ports.ssr;

export const MOCK_CURATOR_PORT = e2eSettings.ports.mockCurator;

export const MOCK_OIDC_PORT = e2eSettings.ports.mockOidc;

export const SSR_ORIGIN = `http://${LOCAL_HOST}:${SSR_PORT}`;

export const MOCK_CURATOR_ORIGIN = `http://${LOCAL_HOST}:${MOCK_CURATOR_PORT}`;

export const MOCK_OIDC_ORIGIN = `https://${LOCAL_HOST}:${MOCK_OIDC_PORT}`;

export const MOCK_OIDC_COOKIE_URL = `http://${LOCAL_HOST}:${MOCK_OIDC_PORT}`;
