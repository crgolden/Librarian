import { mergeTests } from '@playwright/test';
import { createBdd, test as bddBase } from 'playwright-bdd';
import { test as librarianTest } from '../fixtures.js';
import { ScenarioContext } from './scenario-context.js';

export const test = mergeTests(bddBase, librarianTest).extend<{ storeResetForEachScenario: void; ctx: ScenarioContext }>({
  storeResetForEachScenario: [
    async ({ store }, use) => {
      await store.reset();
      await use();
    },
    { auto: true },
  ],
  ctx: async ({}, use) => {
    await use(new ScenarioContext());
  },
});

export const { Given, When, Then } = createBdd(test);
