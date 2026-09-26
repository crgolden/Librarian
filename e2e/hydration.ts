import type { Page } from '@playwright/test';
import { AngularSsrMarkers } from './angular-ssr-constants';

export async function dehydratedMarkersLeft(page: Page): Promise<number> {
  return page.evaluate((selector) => document.querySelectorAll(selector).length, AngularSsrMarkers.dehydratedSelector);
}
