import type { Page } from '@playwright/test';
import { newId, newText } from '@crgolden/modules/testing';

import { test, expect, signInAsAdmin, type TestStore } from './fixtures.js';
import { CuratorApi } from '../src/curator/curator-api';
import { AppUrls } from '../src/app/app-paths';
import { JobStatuses } from '../src/curator/curator.models';
import { BffPaths } from '../src/shared/bff-contract';
import { HttpMethods } from '../src/bff/http-headers';

const ROUTE = AppUrls.adminEnrichment;
const START_PATH = CuratorApi.enrichmentRuns;
const LATEST_PATH = CuratorApi.enrichmentRunsLatest;

const POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END = [JobStatuses.running, JobStatuses.succeeded].length;

interface EnrichmentTraffic {
  starts: number;
  polls: number;
}

function trackEnrichmentTraffic(page: Page): EnrichmentTraffic {
  const traffic: EnrichmentTraffic = { starts: 0, polls: 0 };

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === HttpMethods.post && path === START_PATH) {
      traffic.starts += 1;
    }
    if (request.method() === HttpMethods.get && path.startsWith(`${START_PATH}/`) && path !== LATEST_PATH) {
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

function runReachesStatus(page: Page, status: string): Promise<unknown> {
  return page.waitForResponse(async (response) => {
    const path = new URL(response.url()).pathname;
    if (response.request().method() !== HttpMethods.get || !path.startsWith(`${START_PATH}/`) || path === LATEST_PATH) {
      return false;
    }
    const body = (await response.json()) as { status?: string };
    return body.status === status;
  });
}

test.describe('Enrichment runs — who may reach the page', () => {
  test('an anonymous visitor is sent to sign in', async ({ anonymousPage: page, store }) => {
    await store.reset();

    await page.goto(ROUTE);
    await page.waitForURL(`**${BffPaths.login}**`);
  });

  test('a signed-in non-admin is bounced to the home page instead of the run controls', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(ROUTE);
    await page.waitForURL((url) => url.pathname === AppUrls.home);
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
    await expect(page.locator('#enrichment-load-error')).toBeVisible();
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
    await expect(page.locator('#enrichment-no-run')).toBeVisible();

    await page.locator('#enrichment-start').click();
    await expect(
      page.locator('#enrichment-confirm-prompt'),
      'Start did not raise the confirm step, which is the only thing standing between a click and real provider spend',
    ).toBeVisible();

    await page.locator('#enrichment-cancel').click();
    await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(0);
    await expect(page.locator('#enrichment-start')).toBeVisible();

    expect(traffic.starts, 'backing out of the confirm still posted a run to Curator').toBe(0);

    await page.reload();
    await expect(
      page.locator('#enrichment-no-run'),
      'Curator holds a run after a cancelled confirm, so the POST reached it and only the UI hid it',
    ).toBeVisible();
  });

  test('confirming starts exactly one run and polls it through to a terminal state', async ({
    authedPage: page,
    store,
  }) => {
    await signInAsCuratorAdmin(page, store);
    const traffic = trackEnrichmentTraffic(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-no-run')).toBeVisible();

    await page.locator('#enrichment-start').click();
    await expect(page.locator('#enrichment-confirm')).toBeVisible();
    const succeeded = runReachesStatus(page, JobStatuses.succeeded);
    await page.locator('#enrichment-confirm').click();
    await succeeded;

    await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.succeeded);
    await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(0);

    expect(traffic.starts, 'the confirm did not queue exactly one run').toBe(1);
    expect(
      traffic.polls,
      'the terminal status was rendered without polling through a still-running run, so the poll loop is untested',
    ).toBeGreaterThanOrEqual(POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END);
  });

  test('a run that ends in failure is polled to that failure, error and all', async ({
    authedPage: page,
    store,
  }) => {
    await signInAsCuratorAdmin(page, store);
    const failure = newText();
    await store.setEnrichmentRunOutcome(JobStatuses.failed, failure);
    const traffic = trackEnrichmentTraffic(page);

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-no-run')).toBeVisible();

    await page.locator('#enrichment-start').click();
    await expect(page.locator('#enrichment-confirm')).toBeVisible();
    const failed = runReachesStatus(page, JobStatuses.failed);
    await page.locator('#enrichment-confirm').click();
    await failed;

    await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.failed);
    await expect(
      page.locator('#enrichment-run-error'),
      'the run failed and the operator was not told why',
    ).toBeVisible();
    await expect(
      page.locator('#enrichment-run-cancelled'),
      'a failed run was described to the operator as a cancellation',
    ).toHaveCount(0);
    expect(
      traffic.polls,
      'the failure was rendered without polling through a still-running run, so the poll loop is untested',
    ).toBeGreaterThanOrEqual(POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END);
  });
});

test.describe('Enrichment runs — terminal states', () => {
  test('a cancelled run explains what it left behind', async ({ authedPage: page, store }) => {
    await signInAsCuratorAdmin(page, store);
    const runId = newId();
    await store.seedEnrichmentRun({ run_id: runId, status: JobStatuses.cancelled });

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-run-id')).toHaveAttribute('data-run-id', runId);
    await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.cancelled);
    await expect(page.locator('#enrichment-run-cancelled')).toBeVisible();
  });

  test('a failed run surfaces the error Curator recorded', async ({ authedPage: page, store }) => {
    await signInAsCuratorAdmin(page, store);
    const runId = newId();
    const failure = newText();
    await store.seedEnrichmentRun({ run_id: runId, status: JobStatuses.failed, error: failure });

    await page.goto(ROUTE);
    await expect(page.locator('#enrichment-run-id')).toHaveAttribute('data-run-id', runId);
    await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.failed);
    await expect(page.locator('#enrichment-run-error')).toBeVisible();
    await expect(
      page.locator('#enrichment-run-cancelled'),
      'a failed run was described to the operator as a cancellation',
    ).toHaveCount(0);
  });
});
