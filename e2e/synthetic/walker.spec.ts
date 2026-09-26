import { loginWithPasskey, resolveSeed, resolveStepBudget, toCredentialSlot, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test } from '@playwright/test';
import { librarianActions } from './actions';
import walkerSettings from './walker-settings.json';
import { AppUrls } from '../../src/app/app-paths';
import { BffPaths, RETURN_TO_PARAMETER } from '../../src/shared/bff-contract';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');
const ADMIN_PATH = AppUrls.adminEnrichment;

test.describe('Synthetic walker', () => {
  for (const { slot, role, administers } of walkerSettings.journeys) {
    test(`walks the deployed app as an ${role} with a seeded random journey`, async ({ page }, testInfo) => {
      test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
      const seed = resolveSeed();
      const steps = resolveStepBudget(walkerSettings.stepBudget);
      await loginWithPasskey(page, {
        slot: toCredentialSlot(slot),
        loginPath: BffPaths.login,
        returnParam: RETURN_TO_PARAMETER,
        returnPath: AppUrls.home,
      });

      await page.goto(ADMIN_PATH);
      const startEnrichment = page.locator('#enrichment-start');
      if (administers) {
        await expect(startEnrichment, `${role} should be offered the enrichment control`).toBeVisible();
      } else {
        await expect(startEnrichment, `${role} must not be offered the enrichment control`).toHaveCount(0);
      }
      await page.goto(AppUrls.home);

      const result = await walk(page, librarianActions, { seed, steps, testInfo });
      expect(result.executedSteps).toBe(steps);
    });
  }
});
