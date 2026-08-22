import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function settleWebfonts(page: Page, measured: string[]): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const applied = await page.evaluate((selectors) => {
    const entries = selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return [selector, 'no such element'];
      }
      const style = getComputedStyle(element);
      const family = style.fontFamily.split(',')[0].trim();
      return [selector, document.fonts.check(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`)];
    });
    return Object.fromEntries(entries) as Record<string, boolean | string>;
  }, measured);

  expect(
    applied,
    'measured in fallback metrics: the fallback row is ~39px narrower than the webfont row, against 31px of real headroom, so a wrap that ships would pass here',
  ).toEqual(Object.fromEntries(measured.map((selector) => [selector, true])));
}

export async function computedStyle(page: Page, selector: string, property: string): Promise<string> {
  return page.evaluate(
    ([target, name]) => {
      const element = document.querySelector(target);
      if (element === null) {
        return 'no such element';
      }
      return getComputedStyle(element).getPropertyValue(name);
    },
    [selector, property],
  );
}

export async function ownHeight(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    return element === null ? -1 : element.getBoundingClientRect().height;
  }, selector);
}

export async function boxOf(page: Page, selector: string): Promise<{ top: number; width: number }> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (element === null) {
      return { top: Number.NaN, width: Number.NaN };
    }
    const box = element.getBoundingClientRect();
    return { top: box.top, width: box.width };
  }, selector);
}

export async function trackCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (element === null) {
      return -1;
    }
    return getComputedStyle(element).gridTemplateColumns.split(' ').filter((track) => track.length > 0).length;
  }, selector);
}
