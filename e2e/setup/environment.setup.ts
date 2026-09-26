import { constants } from 'node:http2';
import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_SUB, identityCookies } from '../fixtures';
import { ControlRoutes } from '../mocks/control-routes';
import { BffPaths, ClaimTypes, CSRF_HEADER, CSRF_HEADER_VALUE } from '../../src/shared/bff-contract';
import { HttpMethods } from '../../src/bff/http-headers';
import { MOCK_CURATOR_ORIGIN, MOCK_CURATOR_PORT, MOCK_OIDC_COOKIE_URL, MOCK_OIDC_PORT, SSR_PORT } from '../mocks/mock-endpoints';

const MOCK_CURATOR_BASE = MOCK_CURATOR_ORIGIN;
const MOCK_OIDC_BASE = MOCK_OIDC_COOKIE_URL;

const STALE_SERVER_HINT =
  `If a previous run left processes on ports ${SSR_PORT}/${MOCK_CURATOR_PORT}/${MOCK_OIDC_PORT}, stop them and re-run. See Librarian/TESTING.md.`;

test('mock Curator control API accepts a reset', async () => {
  const response = await fetch(`${MOCK_CURATOR_BASE}${ControlRoutes.reset}`, { method: HttpMethods.post });

  expect(
    response.ok,
    `Mock Curator on ${MOCK_CURATOR_BASE} answered ${ControlRoutes.reset} with ${response.status}. Every test seeds through this endpoint. ${STALE_SERVER_HINT}`,
  ).toBe(true);
});

test('a real /bff/login round trip establishes a session for the default identity', async ({ page }) => {
  await page.context().addCookies(identityCookies({ sub: DEFAULT_E2E_SUB }));

  const login = await page.goto(BffPaths.login);

  expect(
    login?.status(),
    `GET /bff/login finished at ${login?.url()} with status ${login?.status()}. A 500 means the BFF could not complete OIDC discovery against the mock provider on ${MOCK_OIDC_BASE}, which is what a stale SSR server trusting a since-regenerated certificate looks like. ${STALE_SERVER_HINT}`,
  ).toBe(constants.HTTP_STATUS_OK);

  const user = await page.request.get(BffPaths.user, { headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE } });

  expect(
    user.status(),
    `GET /bff/user returned ${user.status()} after a completed /bff/login round trip. ${STALE_SERVER_HINT}`,
  ).toBe(constants.HTTP_STATUS_OK);

  const claims = (await user.json()) as { type: string; value: string }[] | null;

  expect(
    claims,
    `GET /bff/user answered null (no session) after a completed /bff/login round trip, so no session cookie was issued. Left unchecked this surfaces as every authenticated test timing out on a nav locator against the anonymous shell. ${STALE_SERVER_HINT}`,
  ).not.toBeNull();

  const sub = claims?.find(claim => claim.type === ClaimTypes.sub)?.value;

  expect(
    sub,
    `The session carries sub "${sub}" rather than "${DEFAULT_E2E_SUB}", so the mock provider is not honouring the identity cookie and every seeded fixture would be attributed to the wrong user.`,
  ).toBe(DEFAULT_E2E_SUB);
});
