import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { page } from 'vitest/browser';
import { newDisplayName, newId, newPercent, newText } from '@crgolden/modules/testing';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppComponent } from '../app/app.component';
import { AppPaths, RouteDataKeys, collectionDefinitionUrl } from '../app/app-paths';
import { AuthService } from '../auth/auth.service';
import {
  CollectionKinds,
  CollectionVisibilities,
  type CollectionItemResponse,
  type DefinitionDetailResponse,
} from '../curator/curator.models';
import { BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { CollectionsComponent } from './collections.component';
import { CollectionsModes, NO_INSTALLS } from './collections.resolver';

const LayoutSettings = e2eSettings.layout;
const XL_VIEWPORT = e2eSettings.viewports.xl;
const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const CONTENT_SIZED_CONTROLS = ['#collections-back', '#collection-edit-meta', '#collection-run', '#collection-delete'];

function newItem(): CollectionItemResponse {
  return {
    game_id: newId(),
    rank: 1,
    title: newText(),
    franchise: null,
    genre: newText(),
    aaa_tier: null,
    critical_score: newPercent(),
    oc_score: newPercent(),
    psn_rating: newPercent(),
    cover_image_url: null,
    owner_has_access: true,
    installed_on_target: null,
  };
}

function newUnlistedCollection(name: string): DefinitionDetailResponse {
  return {
    definition_id: newId(),
    name,
    description: null,
    kind: CollectionKinds.filterList,
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    include_inactive: false,
    min_percent_completed: null,
    sort_order: null,
    exclude_installed_on: [],
    install_target_console_id: null,
    visibility: CollectionVisibilities.unlisted,
    share_slug: newId(),
    item_count: 1,
    items: [newItem()],
  };
}

async function renderDetailInShell(detail: DefinitionDetailResponse, width: number, height: number): Promise<void> {
  await page.viewport(width, height);
  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([
        {
          path: AppPaths.collectionDefinition,
          component: CollectionsComponent,
          data: {
            [RouteDataKeys.collections]: { mode: CollectionsModes.detail, definition: detail, consoles: [], installs: NO_INSTALLS },
            [RouteDataKeys.genres]: [],
          },
        },
        { path: AppPaths.collections, children: [] },
      ]),
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
    ],
  }).compileComponents();
  await resolveTestComponentResources();
  TestBed.inject(AuthService).refresh();
  TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: newId() }]);
  const fixture = TestBed.createComponent(AppComponent);
  await TestBed.inject(Router).navigateByUrl(collectionDefinitionUrl(detail.definition_id));
  fixture.detectChanges();
  await fixture.whenStable();
  await document.fonts.ready;
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function columnWidthOf(control: HTMLElement): number {
  if (control.parentElement === null) {
    throw new Error(`${control.id} has no column to measure against.`);
  }
  return control.parentElement.getBoundingClientRect().width;
}

describe('A collection’s detail view in the app shell', () => {
  it.each(CONTENT_SIZED_CONTROLS)('sizes %s to its content, not to its column', async (selector) => {
    await renderDetailInShell(newUnlistedCollection(newText()), XL_VIEWPORT.width, XL_VIEWPORT.height);

    const control = required(selector);
    const column = columnWidthOf(control);
    expect(control.getBoundingClientRect().width, `${selector} stretched to its column's width (${column}px)`).toBeLessThan(
      column * LayoutSettings.contentSizedWidthFraction,
    );
  });

  it.each(LayoutSettings.sweptWidths)('fits a %i px viewport, share link included', async (width) => {
    const collection = newUnlistedCollection(Array.from({ length: LayoutSettings.longTitleWordPairs }, newDisplayName).join(' '));

    await renderDetailInShell(collection, width, XL_VIEWPORT.height);

    expect(document.querySelectorAll('#collection-open-0'), 'the list view rendered, so this measures the wrong page').toHaveLength(0);
    expect(document.documentElement.scrollWidth, `the page scrolls sideways at ${width}px`).toBeLessThanOrEqual(
      document.documentElement.clientWidth + SUB_PIXEL_ROUNDING_TOLERANCE_PX,
    );
    const shareUrl = required('#collection-share-url');
    expect(shareUrl.getAttribute('data-share-slug'), 'an unlisted collection publishes its share link').toBe(collection.share_slug);
    expect(Math.round(shareUrl.getBoundingClientRect().right), `the share URL escapes a ${width}px viewport`).toBeLessThanOrEqual(width);
  });
});
