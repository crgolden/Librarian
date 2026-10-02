import type { Page } from '@playwright/test';
import { AngularSsrMarkers } from './angular-ssr-constants';

export async function dehydratedMarkersLeft(page: Page): Promise<number> {
  return page.evaluate((selector) => document.querySelectorAll(selector).length, AngularSsrMarkers.dehydratedSelector);
}

export async function holdAppBootstrap(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(AngularSsrMarkers.bootstrapScript, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}
