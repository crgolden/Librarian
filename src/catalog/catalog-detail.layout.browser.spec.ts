import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { page } from 'vitest/browser';
import { newId, newPercent, newText, randomIntBetween } from '@crgolden/modules/testing';
import { SvgMarkup } from '../../e2e/markup-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { RouteDataKeys } from '../app/app-paths';
import type { GameSummaryResponse } from '../curator/curator.models';
import { ResolvedStatuses } from '../shared/resolved-status';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { CatalogDetailComponent } from './catalog-detail.component';

const LayoutSettings = e2eSettings.layout;
const XL_VIEWPORT = e2eSettings.viewports.xl;

function newSquareCoverDataUrl(): string {
  const side = randomIntBetween(LayoutSettings.coverSideMinimumPx, LayoutSettings.coverSideCeilingPx);
  return `${SvgMarkup.dataUrlPrefix}${encodeURIComponent(
    `<svg xmlns="${SvgMarkup.namespace}" width="${side}" height="${side}"><rect width="${side}" height="${side}"/></svg>`,
  )}`;
}

function newCoveredGame(): GameSummaryResponse {
  return {
    game_id: newId(),
    canonical_title: newText(),
    franchise: newText(),
    genre: newText(),
    aaa_tier: newText(),
    cover_image_url: newSquareCoverDataUrl(),
    store_product_id: null,
    critical_score: newPercent(),
    oc_score: newPercent(),
    psn_rating: newPercent(),
    percent_completed: null,
    content_kind: null,
    price: null,
  };
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

describe('The game page in a real browser', () => {
  it('lays the cover beside its metadata above md instead of stacking them', async () => {
    await page.viewport(XL_VIEWPORT.width, XL_VIEWPORT.height);
    await TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { [RouteDataKeys.game]: { status: ResolvedStatuses.ok, game: newCoveredGame(), collections: [] } } } },
        },
      ],
    }).compileComponents();
    await resolveTestComponentResources();

    const fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await (required('#catalog-detail-cover') as HTMLImageElement).decode();

    const cover = required('#catalog-detail-cover').getBoundingClientRect();
    const ratings = required('#catalog-detail-ratings').getBoundingClientRect();
    expect(ratings.left, 'the metadata column should sit beside the cover, not under it').toBeGreaterThan(cover.left + cover.width);
    expect(ratings.top).toBeLessThan(cover.top + cover.width * LayoutSettings.midlineFraction);
  });
});
