import { JSDOM } from 'jsdom';
import { test, expect } from '../e2e/fixtures.js';
import { AngularSsrMarkers } from '../e2e/angular-ssr-constants';
import { AppUrls } from '../src/app/app-paths';
import { SITE_NAME } from '../src/shared/page-title';
import { SourceRepositories } from '../src/shared/source-repositories';

function serverDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

test.describe('Server-rendered pages', () => {
  test('home page is server-rendered', async ({ request, store }) => {
    await store.reset();

    const res = await request.get(AppUrls.home);
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SITE_NAME);
  });

  test('FAQ page is server-rendered with its source links in the HTML', async ({ request, store }) => {
    await store.reset();

    const res = await request.get(AppUrls.faq);
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SourceRepositories.librarian);
    expect(html).toContain(SourceRepositories.curator);
  });

  test('FAQ page carries its authored anchors before any hydration', async ({ request, store }) => {
    await store.reset();

    const document = serverDocument(await (await request.get(AppUrls.faq)).text());

    expect(document.querySelector('#faq-npsso-token')).not.toBeNull();
  });

  test('privacy policy page is server-rendered with its source link in the HTML', async ({ request, store }) => {
    await store.reset();

    const res = await request.get(AppUrls.privacy);
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    expect(html).toContain(AngularSsrMarkers.serverContextAttribute);
    expect(html).toContain(SourceRepositories.curator);
  });

  test('privacy policy page carries its authored anchors before any hydration', async ({ request, store }) => {
    await store.reset();

    const document = serverDocument(await (await request.get(AppUrls.privacy)).text());

    expect(document.querySelector('#privacy-not-collected')).not.toBeNull();
    expect(document.querySelector('#privacy-action-log')).not.toBeNull();
  });
});
