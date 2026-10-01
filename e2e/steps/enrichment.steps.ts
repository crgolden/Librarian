import { expect, type Page } from '@playwright/test';
import { newId, newText } from '@crgolden/modules/testing';
import { applyAuthRoutes, DEFAULT_E2E_SUB, signInAsAdmin } from '../fixtures.js';
import { CuratorApi } from '../../src/curator/curator-api';
import { AppUrls } from '../../src/app/app-paths';
import { JobStatuses } from '../../src/curator/curator.models';
import { HttpMethods } from '../../src/bff/http-headers';
import { Given, Then, When } from './fixtures.js';

const START_PATH = CuratorApi.enrichmentRuns;
const LATEST_PATH = CuratorApi.enrichmentRunsLatest;
const NO_ELEMENTS = 0;
const NO_RUNS = 0;
const ONE_RUN = 1;
const POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END = [JobStatuses.running, JobStatuses.succeeded].length;

function isRunPoll(method: string, path: string): boolean {
  return method === HttpMethods.get && path.startsWith(`${START_PATH}/`) && path !== LATEST_PATH;
}

const TERMINAL_STATUSES: readonly string[] = [JobStatuses.succeeded, JobStatuses.failed, JobStatuses.cancelled];

function runEnds(page: Page): Promise<unknown> {
  return page.waitForResponse(async (response) => {
    if (!isRunPoll(response.request().method(), new URL(response.url()).pathname)) {
      return false;
    }
    const body = (await response.json()) as { status?: string };
    return body.status !== undefined && TERMINAL_STATUSES.includes(body.status);
  });
}

Given('I am signed in as an administrator the catalog service does not recognise', async ({ page }) => {
  await applyAuthRoutes(page, { sub: DEFAULT_E2E_SUB });
  await signInAsAdmin(page);
});

Given('I am signed in as an administrator', async ({ page, store, ctx }) => {
  await store.seedAdmin();
  await applyAuthRoutes(page, { sub: DEFAULT_E2E_SUB });
  await signInAsAdmin(page);
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === HttpMethods.post && path === START_PATH) {
      ctx.enrichmentStarts += 1;
    }
    if (isRunPoll(request.method(), path)) {
      ctx.enrichmentPolls += 1;
    }
  });
});

Given('the next run will fail', async ({ store }) => {
  await store.setEnrichmentRunOutcome(JobStatuses.failed, newText());
});

Given('the latest enrichment run was cancelled', async ({ store, ctx }) => {
  ctx.enrichmentRunId = newId();
  await store.seedEnrichmentRun({ run_id: ctx.enrichmentRunId, status: JobStatuses.cancelled });
});

Given('the latest enrichment run failed', async ({ store, ctx }) => {
  ctx.enrichmentRunId = newId();
  await store.seedEnrichmentRun({ run_id: ctx.enrichmentRunId, status: JobStatuses.failed, error: newText() });
});

When('I open enrichment runs', async ({ page }) => {
  await page.goto(AppUrls.adminEnrichment);
});

When('I start a run and back out of the confirmation', async ({ page }) => {
  await page.goto(AppUrls.adminEnrichment);
  await expect(page.locator('#enrichment-no-run')).toBeVisible();
  await page.locator('#enrichment-start').click();
  await expect(
    page.locator('#enrichment-confirm-prompt'),
    'Start did not raise the confirm step, which is the only thing standing between a click and real provider spend',
  ).toBeVisible();
  await page.locator('#enrichment-cancel').click();
});

When('I start a run and confirm it', async ({ page }) => {
  await page.goto(AppUrls.adminEnrichment);
  await expect(page.locator('#enrichment-no-run')).toBeVisible();
  await page.locator('#enrichment-start').click();
  await expect(page.locator('#enrichment-confirm')).toBeVisible();
  const ended = runEnds(page);
  await page.locator('#enrichment-confirm').click();
  await ended;
});

Then('I am back on the home page', async ({ page }) => {
  await page.waitForURL((url) => url.pathname === AppUrls.home);
});

Then('I am offered no way to start a run', async ({ page }) => {
  await expect(
    page.locator('#enrichment-start'),
    'a user with no curator.admin claim was served the control that spends provider quota',
  ).toHaveCount(NO_ELEMENTS);
});

Then('I am told the runs could not be loaded', async ({ page }) => {
  await expect(page.locator('#enrichment-load-error')).toBeVisible();
});

Then('I am not told that no run has been started', async ({ page }) => {
  await expect(
    page.locator('#enrichment-no-run'),
    'a refused call was reported as "no run has ever been started", which is a different fact',
  ).toHaveCount(NO_ELEMENTS);
});

Then('I am offered to start a run again', async ({ page }) => {
  await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#enrichment-start')).toBeVisible();
});

Then('no run was started, even after a reload', async ({ page, ctx }) => {
  expect(ctx.enrichmentStarts, 'backing out of the confirm still posted a run to Curator').toBe(NO_RUNS);
  await page.reload();
  await expect(
    page.locator('#enrichment-no-run'),
    'Curator holds a run after a cancelled confirm, so the POST reached it and only the UI hid it',
  ).toBeVisible();
});

Then('I see the run succeeded', async ({ page }) => {
  await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.succeeded);
  await expect(page.locator('#enrichment-confirm-prompt')).toHaveCount(NO_ELEMENTS);
});

Then('exactly one run was started and followed while it ran', ({ ctx }) => {
  expect(ctx.enrichmentStarts, 'the confirm did not queue exactly one run').toBe(ONE_RUN);
  expect(
    ctx.enrichmentPolls,
    'the terminal status was rendered without polling through a still-running run, so the poll loop is untested',
  ).toBeGreaterThanOrEqual(POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END);
});

Then('I see the run failed, with its error', async ({ page }) => {
  await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.failed);
  await expect(page.locator('#enrichment-run-error'), 'the run failed and the operator was not told why').toBeVisible();
  await expect(
    page.locator('#enrichment-run-cancelled'),
    'a failed run was described to the operator as a cancellation',
  ).toHaveCount(NO_ELEMENTS);
});

Then('the run was followed while it ran', ({ ctx }) => {
  expect(
    ctx.enrichmentPolls,
    'the failure was rendered without polling through a still-running run, so the poll loop is untested',
  ).toBeGreaterThanOrEqual(POLLS_THROUGH_A_RUNNING_RUN_TO_ITS_END);
});

Then('I see that run was cancelled, and what it left behind', async ({ page, ctx }) => {
  await expect(page.locator('#enrichment-run-id')).toHaveAttribute('data-run-id', ctx.enrichmentRunId);
  await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.cancelled);
  await expect(page.locator('#enrichment-run-cancelled')).toBeVisible();
});

Then('I see that run failed, with its error', async ({ page, ctx }) => {
  await expect(page.locator('#enrichment-run-id')).toHaveAttribute('data-run-id', ctx.enrichmentRunId);
  await expect(page.locator('#enrichment-run-status')).toHaveAttribute('data-status', JobStatuses.failed);
  await expect(page.locator('#enrichment-run-error')).toBeVisible();
  await expect(
    page.locator('#enrichment-run-cancelled'),
    'a failed run was described to the operator as a cancellation',
  ).toHaveCount(NO_ELEMENTS);
});
