import type { Page } from '@playwright/test';

import { test, expect, signInAsAdmin, type TestStore } from './fixtures.js';

const ROUTE = '/admin/enrichment';
const START_PATH = '/curator/api/enrichment/runs';
const LATEST_PATH = `${START_PATH}/latest`;

const RENDER_TIMEOUT_MS = 15_000;
const TERMINAL_STATUS_TIMEOUT_MS = 30_000;

let nextGeneratedId = 0;
const anId = (prefix: string): string => `${prefix}-${(nextGeneratedId += 1)}`;

interface EnrichmentTraffic {
  starts: number;
  polls: number;
}

function trackEnrichmentTraffic(page: Page): EnrichmentTraffic {
  const traffic: EnrichmentTraffic = { starts: 0, polls: 0 };

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === START_PATH) {
      traffic.starts += 1;
    }
    if (request.method() === 'GET' && path.startsWith(`${START_PATH}/`) && path !== LATEST_PATH) {
      traffic.polls += 1;
    }
  });

  return traffic;
}

async function signInAsCuratorAdmin(page: Page, store: TestStore): Promise<void> {
  await store.reset();
  await store.seedAdmin();
  await signInAsAdmin(page);
}

test.describe('Enrichment runs — who may reach the page', () => {
  test('an anonymous visitor is sent to sign in', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(ROUTE);
    await page.waitForURL('**/bff/login**', { timeout: RENDER_TIMEOUT_MS });
  });

  test('a signed-in non-admin is bounced to the home page instead of the run controls', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(ROUTE);
    await page.waitForURL((url) => url.pathname === '/', { timeout: RENDER_TIMEOUT_MS });
    await expect(
      page.locator('#enrichment-start'),
      'a user with no curator.admin claim was served the control that spends provider quota',
    ).toHaveCount(0);
  });

  test('an admin the Curator API does not recognise is told so, not shown an empty page', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    await signInAsAdmin(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-load-error')).toContainText(
      'Unable to load the latest enrichment run.',
      { timeout: RENDER_TIMEOUT_MS },
    );
    await expect(
      page.locator('#enrichment-no-run'),
      'a refused call was reported as "no run has ever been started", which is a different fact',
    ).toHaveCount(0);
  });
});

test.describe('Enrichment runs — the two-step confirm', () => {
  test('backing out of the confirm starts nothing, and nothing is queued behind it', async ({
    authedPage: page,
    store,
  }) => {
    await signInAsCuratorAdmin(page, store);
    const traffic = trackEnrichmentTraffic(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-no-run')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    await page.locator('#enrichment-start').click();
    await expect(
      page.locator('#enrichment-confirm-prompt'),
      'the confirm step did not open — a click landing before hydration is inert',
    ).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    await page.locator('#enrichment-cancel').click();
    await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(0);
    await expect(page.locator('#enrichment-start')).toBeVisible();

    expect(traffic.starts, 'backing out of the confirm still posted a run to Curator').toBe(0);

    await page.reload();
    await expect(
      page.locator('#enrichment-no-run'),
      'Curator holds a run after a cancelled confirm, so the POST reached it and only the UI hid it',
    ).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
  });

  test('confirming starts exactly one run and polls it through to a terminal state', async ({
    authedPage: page,
    store,
  }) => {
    await signInAsCuratorAdmin(page, store);
    const traffic = trackEnrichmentTraffic(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-no-run')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    await page.locator('#enrichment-start').click();
    await expect(page.locator('#enrichment-confirm')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
    await page.locator('#enrichment-confirm').click();

    await expect(page.locator('#enrichment-run-status')).toContainText('succeeded', {
      timeout: TERMINAL_STATUS_TIMEOUT_MS,
    });
    await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(0);

    expect(traffic.starts, 'the confirm did not queue exactly one run').toBe(1);
    expect(
      traffic.polls,
      'the terminal status was rendered without polling through a still-running run, so the poll loop is untested',
    ).toBeGreaterThanOrEqual(2);
  });

  test('a run that ends in failure is polled to that failure, error and all', async ({
    authedPage: page,
    store,
  }) => {
    await signInAsCuratorAdmin(page, store);
    const failure = anId('every provider refused this pass');
    await store.setEnrichmentRunOutcome('failed', failure);
    const traffic = trackEnrichmentTraffic(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-no-run')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });

    await page.locator('#enrichment-start').click();
    await expect(page.locator('#enrichment-confirm')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
    await page.locator('#enrichment-confirm').click();

    await expect(page.locator('#enrichment-run-status')).toContainText('failed', {
      timeout: TERMINAL_STATUS_TIMEOUT_MS,
    });
    await expect(
      page.locator('#enrichment-run-error'),
      'the run failed and the operator was not told why',
    ).toContainText(failure);
    await expect(
      page.locator('#enrichment-run-cancelled'),
      'a failed run was described to the operator as a cancellation',
    ).toHaveCount(0);
    expect(
      traffic.polls,
      'the failure was rendered without polling through a still-running run, so the poll loop is untested',
    ).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Enrichment runs — terminal states', () => {
  test('a cancelled run explains what it left behind', async ({ authedPage: page, store }) => {
    await signInAsCuratorAdmin(page, store);
    const runId = anId('cancelled-enrichment-run');
    await store.seedEnrichmentRun({ run_id: runId, status: 'cancelled' });

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-run-id')).toContainText(runId, { timeout: RENDER_TIMEOUT_MS });
    await expect(page.locator('#enrichment-run-status')).toContainText('cancelled');
    await expect(page.locator('#enrichment-run-cancelled')).toContainText(
      'This run was cancelled before it finished.',
    );
  });

  test('a failed run surfaces the error Curator recorded', async ({ authedPage: page, store }) => {
    await signInAsCuratorAdmin(page, store);
    const runId = anId('failed-enrichment-run');
    const failure = anId('provider quota exhausted');
    await store.seedEnrichmentRun({ run_id: runId, status: 'failed', error: failure });

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-run-id')).toContainText(runId, { timeout: RENDER_TIMEOUT_MS });
    await expect(page.locator('#enrichment-run-status')).toContainText('failed');
    await expect(page.locator('#enrichment-run-error')).toContainText(failure);
    await expect(
      page.locator('#enrichment-run-cancelled'),
      'a failed run was described to the operator as a cancellation',
    ).toHaveCount(0);
  });
});
