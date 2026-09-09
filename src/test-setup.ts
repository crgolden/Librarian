import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const srcDir = resolve(process.cwd(), 'src');

function buildResourcePathMap(dir: string, map = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      buildResourcePathMap(fullPath, map);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.css')) {
      if (!map.has(entry.name)) {
        map.set(entry.name, fullPath);
      }
    }
  }
  return map;
}

const resourcePaths = buildResourcePathMap(srcDir);
const resourceContents = new Map<string, string>();

const resourceResolver = (url: string): Promise<{ text(): Promise<string> }> => {
  const filename = url.split('/').pop()?.split('\\').pop() ?? url;
  const fullPath = resourcePaths.get(filename);
  if (fullPath === undefined) {
    throw new Error(`No component resource found for "${filename}" (requested as "${url}")`);
  }
  const cached = resourceContents.get(filename);
  const content = cached ?? readFileSync(fullPath, { encoding: 'utf-8' });
  resourceContents.set(filename, content);
  return Promise.resolve({ text: () => Promise.resolve(content) });
};

function addTheDialogMethodsJsdomDoesNotImplement(): void {
  const dialogPrototype: Partial<HTMLDialogElement> = HTMLDialogElement.prototype;
  if (dialogPrototype.showModal !== undefined) {
    return;
  }
  dialogPrototype.show = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  dialogPrototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  dialogPrototype.close = function (this: HTMLDialogElement, returnValue?: string): void {
    if (returnValue !== undefined) {
      this.returnValue = returnValue;
    }
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

addTheDialogMethodsJsdomDoesNotImplement();

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

beforeEach(async () => {
  await resolveComponentResources(resourceResolver);
});
