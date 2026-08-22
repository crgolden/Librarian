import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_SUB } from '../fixtures';

const MOCK_CURATOR_BASE = 'http://localhost:4101';
const MOCK_OIDC_BASE = 'http://localhost:4102';

const STALE_SERVER_HINT =
  'If a previous run left processes on ports 4100/4101/4102, stop them and re-run. See Librarian/TESTING.md.';

test('mock Curator control API accepts a reset', async () => {
  const response = await fetch(`${MOCK_CURATOR_BASE}/_test/reset`, { method: 'POST' });

  expect(
    response.ok,
    `Mock Curator on ${MOCK_CURATOR_BASE} answered /_test/reset with ${response.status}. Every test seeds through this endpoint. ${STALE_SERVER_HINT}`,
  ).toBe(true);
});

test('a real /bff/login round trip establishes a session for the default identity', async ({ page }) => {
  await page.context().addCookies([
    { name: 'e2e_identity', value: DEFAULT_E2E_SUB, url: MOCK_OIDC_BASE },
    { name: 'e2e_email', value: `${DEFAULT_E2E_SUB}@test.invalid`, url: MOCK_OIDC_BASE },
    { name: 'e2e_name', value: `${DEFAULT_E2E_SUB}@test.invalid`, url: MOCK_OIDC_BASE },
  ]);

  const login = await page.goto('/bff/login');

  expect(
    login?.status(),
    `GET /bff/login finished at ${login?.url()} with status ${login?.status()}. A 500 means the BFF could not complete OIDC discovery against the mock provider on ${MOCK_OIDC_BASE}, which is what a stale SSR server trusting a since-regenerated certificate looks like. ${STALE_SERVER_HINT}`,
  ).toBe(200);

  const user = await page.request.get('/bff/user', { headers: { 'X-CSRF': '1' } });

  expect(
    user.status(),
    `GET /bff/user returned ${user.status()} after a completed /bff/login round trip, so no session cookie was issued. Left unchecked this surfaces as every authenticated test timing out on a nav locator against the anonymous shell. ${STALE_SERVER_HINT}`,
  ).toBe(200);

  const claims = (await user.json()) as { type: string; value: string }[];
  const sub = claims.find(claim => claim.type === 'sub')?.value;

  expect(
    sub,
    `The session carries sub "${sub}" rather than "${DEFAULT_E2E_SUB}", so the mock provider is not honouring the e2e_identity cookie and every seeded fixture would be attributed to the wrong user.`,
  ).toBe(DEFAULT_E2E_SUB);
});
