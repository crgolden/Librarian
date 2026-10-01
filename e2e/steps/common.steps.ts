import { applyAnonymousRoutes, applyAuthRoutes, DEFAULT_E2E_SUB } from '../fixtures.js';
import { Given } from './fixtures.js';

Given('I am a visitor', async ({ page }) => {
  await applyAnonymousRoutes(page);
});

Given('I am signed in', async ({ page }) => {
  await applyAuthRoutes(page, { sub: DEFAULT_E2E_SUB });
});
