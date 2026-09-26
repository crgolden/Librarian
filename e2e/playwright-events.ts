import type { Download, Page } from '@playwright/test';
import { PlaywrightConstants } from './playwright-constants';

export function waitForDownload(page: Page): Promise<Download> {
  return page.waitForEvent(PlaywrightConstants.pageEvents.download);
}
