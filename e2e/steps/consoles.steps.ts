import { randomInt, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { newMemberOf } from '@crgolden/modules/testing';
import e2eSettings from '../e2e-settings.json';
import { AppUrls } from '../../src/app/app-paths';
import { ConsoleDeviceLinkStates, ConsolePlatforms, StorageKinds } from '../../src/curator/curator.models';
import { Given, Then, When } from './fixtures.js';

const NO_ELEMENTS = 0;
const OLDER_PLATFORMS = [
  ConsolePlatforms.ps3,
  ConsolePlatforms.psvita,
  ConsolePlatforms.psp,
  ConsolePlatforms.ps2,
  ConsolePlatforms.ps1,
];

async function addConsole(page: Page, platform: string): Promise<string> {
  await page.goto(AppUrls.consoles);
  await page.locator('#consoles-add-console').click();
  await page.locator('#consoleName').fill(randomUUID());
  await page.locator('#consolePlatform').selectOption(platform);
  await expect(page.locator('#consolePlatform')).toHaveValue(platform);
  await page.locator('#console-create-submit').click();
  await expect(page.locator('#console-name-0')).toHaveAttribute('data-console-id', /\S/);
  const consoleId = await page.locator('#console-name-0').getAttribute('data-console-id');
  if (consoleId === null) {
    throw new Error('The created console rendered with no id.');
  }
  return consoleId;
}

async function addDriveAttachedTo(page: Page, consoleId: string): Promise<void> {
  await page.locator('#consoles-add-device').click();
  await page.locator('#deviceName').fill(randomUUID());
  await page.locator('#deviceKind').selectOption(StorageKinds.m2);
  await expect(page.locator('#deviceKind')).toHaveValue(StorageKinds.m2);
  await page.locator('#deviceCapacityGb').fill(String(randomInt(1, e2eSettings.consoles.driveCapacityGbExclusiveCeiling)));
  await page.locator('#device-create-submit').click();
  await expect(page.locator('#device-name-0')).toBeVisible();
  await expect(page.locator('#devices-empty')).toHaveCount(NO_ELEMENTS);
  await expect(page.locator('#device-attachment-0')).not.toHaveAttribute('data-console-id');
  await page.locator('#device-attach-0').click();
  await page.locator('#device-attach-target-0').selectOption(consoleId);
  await expect(page.locator('#device-attach-target-0')).toHaveValue(consoleId);
  await page.locator('#device-attach-confirm-0').click();
}

Given('I have a console whose PlayStation device link is deactivated', async ({ store }) => {
  const consoleId = randomUUID();
  await store.seedConsoles([consoleId]);
  await store.seedConsoleDeviceLink(consoleId, { state: ConsoleDeviceLinkStates.deviceDeactivated });
});

Given('I have a console with no device link', async ({ store }) => {
  await store.seedConsoles([randomUUID()]);
});

Given('I have added a PlayStation 5 console', async ({ page, ctx }) => {
  ctx.consoleId = await addConsole(page, ConsolePlatforms.ps5);
});

Given('I have added a storage drive attached to that console', async ({ page, ctx }) => {
  await addDriveAttachedTo(page, ctx.consoleId);
  await expect(page.locator('#device-attachment-0')).toHaveAttribute('data-console-id', ctx.consoleId);
});

When('I open my consoles and storage', async ({ page }) => {
  await page.goto(AppUrls.consoles);
});

When('I add a PlayStation 5 console', async ({ page, ctx }) => {
  ctx.consoleId = await addConsole(page, ConsolePlatforms.ps5);
});

When('I add a console on an older PlayStation', async ({ page, ctx }) => {
  ctx.consolePlatform = newMemberOf(OLDER_PLATFORMS);
  ctx.consoleId = await addConsole(page, ctx.consolePlatform);
});

When('I add a storage drive and attach it to that console', async ({ page, ctx }) => {
  await addDriveAttachedTo(page, ctx.consoleId);
});

When('I detach the drive', async ({ page }) => {
  await page.locator('#device-detach-0').click();
});

Then('I am told I have no consoles and no storage drives', async ({ page }) => {
  await expect(page.locator('#consoles-empty')).toBeVisible();
  await expect(page.locator('#devices-empty')).toBeVisible();
});

Then('I see that console', async ({ page }) => {
  await expect(page.locator('#console-name-0')).toBeVisible();
  await expect(page.locator('#consoles-empty')).toHaveCount(NO_ELEMENTS);
});

Then('I am told it was given a default capacity', async ({ page }) => {
  await expect(page.locator('#console-default-capacity-note')).toBeVisible();
});

Then('I see that console on that PlayStation', async ({ page, ctx }) => {
  await expect(page.locator('#console-name-0')).toHaveAttribute('data-platform', ctx.consolePlatform);
});

Then("I am told the console's device link is deactivated", async ({ page }) => {
  await expect(page.locator('#console-device-link-0')).toHaveAttribute('data-state', ConsoleDeviceLinkStates.deviceDeactivated);
});

Then('I am offered my account page to manage it', async ({ page }) => {
  await expect(page.locator('#console-device-link-account-0')).toHaveAttribute('href', AppUrls.account);
});

Then('I am told nothing about a device link', async ({ page }) => {
  await expect(page.locator('#console-device-link-0')).toHaveCount(NO_ELEMENTS);
});

Then('the drive is attached to that console', async ({ page, ctx }) => {
  await expect(page.locator('#device-attachment-0')).toHaveAttribute('data-console-id', ctx.consoleId);
});

Then('the drive is attached to no console', async ({ page }) => {
  await expect(page.locator('#device-attachment-0')).not.toHaveAttribute('data-console-id');
});
