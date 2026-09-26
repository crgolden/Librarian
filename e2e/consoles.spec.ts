
import { randomInt, randomUUID } from 'node:crypto';

import { test, expect } from './fixtures.js';
import { AppUrls } from '../src/app/app-paths';
import { ConsoleDeviceLinkStates, ConsolePlatforms, StorageKinds } from '../src/curator/curator.models';
import { BffPaths } from '../src/shared/bff-contract';
import { newMemberOf } from '@crgolden/modules/testing';

test.describe('Consoles & Storage — auth guard', () => {
  test('unauthenticated visitor is redirected to login', async ({ anonymousPage: page }) => {
    await page.goto(AppUrls.consoles);
    await page.waitForURL(`**${BffPaths.login}**`);
  });
});

test.describe('Consoles & Storage — authenticated', () => {
  test('shows empty states, then creates a console with an auto-assigned default capacity', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();

    await page.goto(AppUrls.consoles);
    await expect(page.locator('#consoles-empty')).toBeVisible();
    await expect(page.locator('#devices-empty')).toBeVisible();

    await page.locator('#consoles-add-console').click();
    await page.locator('#consoleName').fill(randomUUID());
    await page.locator('#consolePlatform').selectOption(ConsolePlatforms.ps5);
    await expect(page.locator('#consolePlatform')).toHaveValue(ConsolePlatforms.ps5);

    await page.locator('#console-create-submit').click();

    await expect(page.locator('#console-name-0')).toBeVisible();
    await expect(page.locator('#consoles-empty')).toHaveCount(0);
    await expect(page.locator('#console-default-capacity-note')).toBeVisible();
  });

  test('creates a console on a legacy platform, not only PS5 or PS4', async ({ authedPage: page, store }) => {
    await store.reset();
    const platform = newMemberOf([
      ConsolePlatforms.ps3,
      ConsolePlatforms.psvita,
      ConsolePlatforms.psp,
      ConsolePlatforms.ps2,
      ConsolePlatforms.ps1,
    ]);

    await page.goto(AppUrls.consoles);
    await page.locator('#consoles-add-console').click();
    await page.locator('#consoleName').fill(randomUUID());
    await page.locator('#consolePlatform').selectOption(platform);
    await expect(page.locator('#consolePlatform')).toHaveValue(platform);
    await page.locator('#console-create-submit').click();

    await expect(page.locator('#console-name-0')).toHaveAttribute('data-platform', platform);
  });

  test('reports a stale PSN device link in words, and offers the page that manages it', async ({
    authedPage: page,
    store,
  }) => {
    await store.reset();
    const consoleId = randomUUID();
    await store.seedConsoles([consoleId]);
    await store.seedConsoleDeviceLink(consoleId, { state: ConsoleDeviceLinkStates.deviceDeactivated });

    await page.goto(AppUrls.consoles);

    await expect(page.locator('#console-device-link-0')).toHaveAttribute(
      'data-state',
      ConsoleDeviceLinkStates.deviceDeactivated,
    );
    await expect(page.locator('#console-device-link-account-0')).toHaveAttribute('href', AppUrls.account);
  });

  test('says nothing about a device link on a console that has none', async ({ authedPage: page, store }) => {
    await store.reset();
    await store.seedConsoles([randomUUID()]);

    await page.goto(AppUrls.consoles);

    await expect(page.locator('#console-name-0')).toBeVisible();
    await expect(page.locator('#console-device-link-0')).toHaveCount(0);
  });

  test('creates a storage device and attaches it to a console', async ({ authedPage: page, store }) => {
    await store.reset();

    await page.goto(AppUrls.consoles);
    await page.locator('#consoles-add-console').click();
    await page.locator('#consoleName').fill(randomUUID());
    await page.locator('#consolePlatform').selectOption(ConsolePlatforms.ps5);
    await expect(page.locator('#consolePlatform')).toHaveValue(ConsolePlatforms.ps5);
    await page.locator('#console-create-submit').click();
    await expect(page.locator('#console-name-0')).toHaveAttribute('data-console-id', /\S/);
    const consoleId = await page.locator('#console-name-0').getAttribute('data-console-id');
    expect(consoleId, 'the created console rendered with no id').not.toBeNull();
    const attachTarget = String(consoleId);

    await page.locator('#consoles-add-device').click();
    await page.locator('#deviceName').fill(randomUUID());
    await page.locator('#deviceKind').selectOption(StorageKinds.m2);
    await expect(page.locator('#deviceKind')).toHaveValue(StorageKinds.m2);
    await page.locator('#deviceCapacityGb').fill(String(randomInt(1, 4001)));
    await page.locator('#device-create-submit').click();
    await expect(page.locator('#device-name-0')).toBeVisible();
    await expect(page.locator('#devices-empty')).toHaveCount(0);
    await expect(page.locator('#device-attachment-0')).not.toHaveAttribute('data-console-id');

    await page.locator('#device-attach-0').click();
    await page.locator('#device-attach-target-0').selectOption(attachTarget);
    await expect(page.locator('#device-attach-target-0')).toHaveValue(attachTarget);
    await page.locator('#device-attach-confirm-0').click();
    await expect(page.locator('#device-attachment-0')).toHaveAttribute('data-console-id', attachTarget);

    await page.locator('#device-detach-0').click();
    await expect(page.locator('#device-attachment-0')).not.toHaveAttribute('data-console-id');
  });
});
