import { loginWithPasskey, resolveSeed, resolveStepBudget, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { librarianActions } from './actions';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');
const ADMIN_PATH = '/admin/enrichment';

const JOURNEYS = [
  { slot: 1, role: 'admin', administers: true },
  { slot: 2, role: 'member', administers: false },
] as const;

test.describe('Synthetic walker', () => {
  for (const { slot, role, administers } of JOURNEYS) {
    test(`walks the deployed app as an ${role} with a seeded random journey`, async ({ page }, testInfo) => {
      test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
      const seed = resolveSeed();
      const steps = resolveStepBudget();
      await loginWithPasskey(page, { slot, returnParam: 'returnTo', returnPath: '/' });

      await page.goto(ADMIN_PATH);
      const startEnrichment = page.locator('#enrichment-start');
      if (administers) {
        await expect(startEnrichment, `${role} should be offered the enrichment control`).toBeVisible();
      } else {
        await expect(startEnrichment, `${role} must not be offered the enrichment control`).toHaveCount(0);
      }
      await page.goto('/');

      const result = await walk(page, librarianActions, { seed, steps, testInfo });
      expect(result.executedSteps).toBe(steps);
    });
  }
});
