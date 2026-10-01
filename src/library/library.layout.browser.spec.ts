import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CuratorApi } from '../curator/curator-api';
import { ActivatedRoute, Router, convertToParamMap, provideRouter, type Params } from '@angular/router';
import { AppComponent } from '../app/app.component';
import { AuthService } from '../auth/auth.service';
import { BFF_USER_RELATIVE_PATH, ClaimTypes } from '../shared/bff-contract';
import { BehaviorSubject } from 'rxjs';
import { page, userEvent } from 'vitest/browser';
import { LARGEST_PERCENT, lowercaseToken, newDisplayName, newId, newText, randomIntBetween } from '@crgolden/modules/testing';
import { CssValues } from '../../e2e/css-constants';
import { PsnGenreTokens, PsnStarRatings } from '../../e2e/psn-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppPaths, AppUrls, RouteDataKeys } from '../app/app-paths';
import {
  ConsolePlatforms,
  LibraryEntrySources,
  LibrarySortFields,
  TrophyMatches,
  type LibraryGameResponse,
  type ManualCandidatesResponse,
  type StoreSearchResultResponse,
} from '../curator/curator.models';
import { ResolvedStatuses } from '../shared/resolved-status';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { LibraryComponent } from './library.component';
import { libraryHeaderId, librarySortArrowId, librarySortId } from './library-ids';
import { LIBRARY_PAGE_SIZE, LibraryQueryParams } from './library.query';
import type { ResolvedLibrary } from './library.resolver';

const LayoutSettings = e2eSettings.layout;
const LibraryTolerancesPx = e2eSettings.library.tolerancesPx;
const XL_VIEWPORT = e2eSettings.viewports.xl;
const WIDEST_PSN_RATING = PsnStarRatings.largestTwoDecimalValue;

function newRow(title: string = newText()): LibraryGameResponse {
  return {
    game_id: newId(),
    title,
    genre: newText(),
    rawg_rating: null,
    opencritic_rating: null,
    psn_rating: null,
    psn_product_id: null,
    rawg_enriched: false,
    opencritic_enriched: false,
    percent_completed: null,
    source: LibraryEntrySources.psn,
    cover_image_url: null,
    platforms: [],
    trophy_match: TrophyMatches.notAttempted,
  };
}

function newLongTitle(): string {
  return Array.from({ length: LayoutSettings.longTitleWordPairs }, newDisplayName).join(' ');
}

function widestRow(title: string): LibraryGameResponse {
  return {
    ...newRow(title),
    genre: PsnGenreTokens.rolePlayingGames,
    rawg_rating: LARGEST_PERCENT,
    opencritic_rating: LARGEST_PERCENT,
    psn_rating: WIDEST_PSN_RATING,
    platforms: [ConsolePlatforms.ps3, ConsolePlatforms.ps4, ConsolePlatforms.ps5],
    rawg_enriched: true,
    opencritic_enriched: true,
  };
}

function resolvedLibrary(games: LibraryGameResponse[], extras: Partial<{ total: number; hiddenCount: number }> = {}): ResolvedLibrary {
  return {
    status: ResolvedStatuses.ok,
    games,
    total: extras.total ?? games.length,
    genres: [...new Set(games.map((game) => game.genre).filter((genre): genre is string => genre !== null))],
    schedule: null,
    trophyProgress: null,
    hiddenCount: extras.hiddenCount ?? 0,
    psPlus: null,
  };
}

async function renderLibrary(
  resolved: ResolvedLibrary,
  viewport: { width: number; height: number },
  queryParams: Params = {},
): Promise<ComponentFixture<LibraryComponent>> {
  await page.viewport(viewport.width, viewport.height);
  await TestBed.configureTestingModule({
    imports: [LibraryComponent],
    providers: [
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({}), data: { [RouteDataKeys.library]: resolved }, queryParams },
          queryParams: new BehaviorSubject<Params>(queryParams).asObservable(),
        },
      },
    ],
  }).compileComponents();
  await resolveTestComponentResources();
  const fixture = TestBed.createComponent(LibraryComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await document.fonts.ready;
  return fixture;
}

function tokenPx(token: string): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
}

function brokeOntoASecondLine(header: { lines: number; drop: number }): boolean {
  return header.lines > 1 || header.drop > LibraryTolerancesPx.sameLineTop;
}

function clearTheGenreCap(): void {
  for (const cell of document.querySelectorAll<HTMLElement>('[id^="library-genre-"]')) {
    cell.style.maxWidth = CssValues.none;
  }
}

function moreThanOnePage(): number {
  return LIBRARY_PAGE_SIZE + randomIntBetween(1, LIBRARY_PAGE_SIZE);
}

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function ownHeight(selector: string): number {
  const range = document.createRange();
  range.selectNodeContents(required(selector));
  return range.getBoundingClientRect().height;
}

function newStoreHit(): StoreSearchResultResponse {
  return {
    id: newId(),
    kind: null,
    game_id: null,
    default_product_id: newId(),
    name: newText(),
    platforms: [ConsolePlatforms.ps5],
    cover_image_url: null,
    classification: null,
    price: null,
    discounted_price: null,
    is_free: null,
  };
}

async function openTheStoreMatchDialog(viewport: { width: number; height: number }, hitCount: number): Promise<DOMRect> {
  await renderLibrary(resolvedLibrary([]), viewport);
  await userEvent.click(required('#library-add-manual-toggle'));
  await userEvent.fill(required('#library-manual-search'), newText());
  await userEvent.click(required('#library-manual-search-submit'));
  const candidates: ManualCandidatesResponse = {
    catalog: [],
    store: Array.from({ length: hitCount }, newStoreHit),
    already_owned: 0,
    store_consulted: true,
    store_unavailable: null,
  };
  TestBed.inject(HttpTestingController)
    .expectOne((request) => request.url.includes(CuratorApi.libraryManualCandidates))
    .flush(candidates);
  await expect.poll(() => required('#library-store-match').checkVisibility()).toBe(true);
  await expect.poll(() => document.querySelectorAll('[id^="library-store-candidate-name-"]')).toHaveLength(hitCount);
  return required('#library-store-match').getBoundingClientRect();
}

describe('The library page in the app shell', () => {
  it('holds the data measure that the profile holds', async () => {
    await page.viewport(e2eSettings.viewports.desktop.width, e2eSettings.viewports.desktop.height);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([{ path: AppPaths.library, component: LibraryComponent, data: { [RouteDataKeys.library]: resolvedLibrary([]) } }]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    await resolveTestComponentResources();
    TestBed.inject(AuthService).refresh();
    TestBed.inject(HttpTestingController).expectOne(BFF_USER_RELATIVE_PATH).flush([{ type: ClaimTypes.sub, value: newId() }]);
    const fixture = TestBed.createComponent(AppComponent);

    await TestBed.inject(Router).navigateByUrl(AppUrls.library);
    fixture.detectChanges();
    await fixture.whenStable();

    const dataMeasure = tokenPx('--container-data');
    expect(dataMeasure).toBeGreaterThan(0);
    expect(Math.abs(required('#library-page').getBoundingClientRect().width - dataMeasure)).toBeLessThanOrEqual(1);
  });
});

describe('The Store-match dialog in a real browser', () => {
  it('takes the page’s ink, not the browser’s dialog default', async () => {
    await renderLibrary(resolvedLibrary([]), XL_VIEWPORT);

    expect(getComputedStyle(required('#library-store-match')).color, 'the UA stylesheet colours a dialog CanvasText').toBe(
      getComputedStyle(document.body).color,
    );
  });

  it('is centred and holds the narrow measure on a wide screen', async () => {
    const box = await openTheStoreMatchDialog(e2eSettings.viewports.desktop, e2eSettings.library.shortProposalStoreHitCount);

    const narrowMeasure = tokenPx('--container-narrow');
    expect(narrowMeasure).toBeGreaterThan(0);
    expect(Math.abs(box.left - (document.documentElement.clientWidth - box.right))).toBeLessThanOrEqual(LibraryTolerancesPx.dialogCentring);
    expect(box.top).toBeGreaterThan(0);
    expect(Math.abs(box.width - narrowMeasure), 'without its own measure the dialog sizes to its candidates').toBeLessThanOrEqual(
      LibraryTolerancesPx.dialogMeasure,
    );
  });

  it('keeps a gutter on both sides of a phone screen', async () => {
    const box = await openTheStoreMatchDialog(e2eSettings.viewports.mobile, e2eSettings.library.shortProposalStoreHitCount);

    const rightGap = document.documentElement.clientWidth - box.right;
    expect(box.left, 'at the narrow measure alone the dialog would overflow a phone').toBeGreaterThan(0);
    expect(rightGap).toBeGreaterThan(0);
    expect(Math.abs(box.left - rightGap)).toBeLessThanOrEqual(LibraryTolerancesPx.dialogCentring);
  });

  it('scrolls a proposal longer than the screen inside the dialog', async () => {
    const box = await openTheStoreMatchDialog(e2eSettings.viewports.shortDialog, e2eSettings.library.overflowingStoreHitCount);

    const dialog = required('#library-store-match');
    expect(dialog.scrollHeight, 'the proposal must be longer than the dialog, or the bounds could not fail').toBeGreaterThan(dialog.clientHeight);
    expect(box.top).toBeGreaterThan(0);
    expect(document.documentElement.clientHeight - box.bottom, 'a long proposal runs past the bottom edge').toBeGreaterThan(0);
  });
});

describe('The library table in a real browser', () => {
  it('sits the page count on the pager buttons’ centre line instead of stretching it', async () => {
    await renderLibrary(resolvedLibrary(Array.from({ length: LIBRARY_PAGE_SIZE }, () => newRow()), { total: moreThanOnePage() }), XL_VIEWPORT);

    const countHeight = ownHeight('#library-page-range');
    expect(countHeight).toBeGreaterThan(0);
    expect(countHeight, 'a stretched count reports the row height while its text stays pinned to the top').toBeLessThan(
      required('#library-next').getBoundingClientRect().height,
    );
  });

  it('puts the search and the genre filter on one row', async () => {
    await renderLibrary(resolvedLibrary([newRow()]), XL_VIEWPORT);

    const search = required('#library-search').getBoundingClientRect();
    const filter = required('#library-genre-filter').getBoundingClientRect();
    expect(Math.abs(search.top - filter.top)).toBeLessThan(LayoutSettings.sharedRowTopTolerancePx);
    expect(filter.width).toBeLessThan(search.width);
  });

  it('renders the per-page control at the pager’s meta size, not the body size', async () => {
    await renderLibrary(resolvedLibrary(Array.from({ length: LIBRARY_PAGE_SIZE }, () => newRow()), { total: moreThanOnePage() }), XL_VIEWPORT);

    expect(getComputedStyle(required('#library-page-size')).fontSize).toBe(getComputedStyle(required('#library-page-range')).fontSize);
  });

  it('keeps a sorted column’s arrow on its label’s line, which it would not without nowrap', async () => {
    const headerId = `#${libraryHeaderId(LibrarySortFields.psnRating)}`;
    const labelId = `#${librarySortId(LibrarySortFields.psnRating)}`;
    const arrowId = `#${librarySortArrowId(LibrarySortFields.psnRating)}`;
    await renderLibrary(resolvedLibrary([widestRow(newText()), widestRow(newLongTitle())]), e2eSettings.viewports.tableBetweenMdAndData, {
      [LibraryQueryParams.sort]: LibrarySortFields.psnRating,
    });
    const lines = () => {
      const range = document.createRange();
      range.selectNodeContents(required(labelId));
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    };
    const drop = () => required(arrowId).getBoundingClientRect().top - required(labelId).getBoundingClientRect().top;
    const renderedWhiteSpace = required(headerId).style.whiteSpace;
    required(headerId).style.whiteSpace = CssValues.normal;
    const withoutNowrap = { lines: lines(), drop: drop() };
    required(headerId).style.whiteSpace = renderedWhiteSpace;

    const asRendered = { lines: lines(), drop: drop() };

    expect(brokeOntoASecondLine(withoutNowrap), 'with white-space cleared this column must break, or nothing here could fail').toBe(true);
    expect(asRendered.lines).toBe(1);
    expect(Math.abs(asRendered.drop)).toBeLessThanOrEqual(LibraryTolerancesPx.sameLineTop);
  });

  it('fits the table in its card at the xl measure with every column at its widest', async () => {
    await renderLibrary(resolvedLibrary([widestRow(newText()), widestRow(newLongTitle())], { hiddenCount: 1 }), XL_VIEWPORT);

    const scroll = required('#library-table-scroll');
    expect(scroll.clientWidth).toBeGreaterThan(0);
    expect(scroll.scrollWidth, 'the table scrolls sideways inside its card and hides a column').toBeLessThanOrEqual(scroll.clientWidth);
  });

  it('puts the Hide control on its own line under the title, whatever the title’s length', async () => {
    const shortRow = widestRow(newText());
    const longRow = widestRow(newLongTitle());
    await renderLibrary(resolvedLibrary([shortRow, longRow]), XL_VIEWPORT);
    const gapUnder = (row: LibraryGameResponse): number => {
      const title = `#library-row-${row.game_id} [id^="library-title-"]`;
      return required(`#library-hide-${row.game_id}`).getBoundingClientRect().top - (required(title).getBoundingClientRect().top + ownHeight(title));
    };

    const shortGap = gapUnder(shortRow);
    const longGap = gapUnder(longRow);

    expect(shortGap).toBeGreaterThanOrEqual(0);
    expect(longGap).toBeGreaterThanOrEqual(0);
    expect(Math.round(shortGap), 'the gap under a title differs with its length').toBe(Math.round(longGap));
  });

  it('sizes the hidden-games toggle to its content, not to the card', async () => {
    await renderLibrary(resolvedLibrary([widestRow(newText())], { hiddenCount: 1 }), XL_VIEWPORT);

    expect(required('#library-show-hidden').getBoundingClientRect().width).toBeLessThan(
      required('#library-table-card').getBoundingClientRect().width * LayoutSettings.contentSizedWidthFraction,
    );
  });

  it('ellipsises a raw genre token in the Genre column while the cell keeps the whole token', async () => {
    const titles = [newText(), newText()].sort((left, right) => left.localeCompare(right));
    await renderLibrary(
      resolvedLibrary([
        { ...newRow(titles[0]), genre: PsnGenreTokens.rolePlayingGames },
        { ...newRow(titles[1]), genre: lowercaseToken(randomIntBetween(1, e2eSettings.library.ordinaryGenreLengthCeiling)) },
      ]),
      XL_VIEWPORT,
    );
    const rawToken = required('#library-genre-0');
    const ordinary = required('#library-genre-1');
    const rawOverflow = rawToken.scrollWidth - rawToken.clientWidth;
    const ordinaryOverflow = ordinary.scrollWidth - ordinary.clientWidth;
    const capped = required('#library-header-genre').getBoundingClientRect().width;

    clearTheGenreCap();

    expect(rawToken.getAttribute('title')).toBe(PsnGenreTokens.rolePlayingGames);
    expect(rawOverflow, 'the raw token is not clipped, so the column is sized by the widest vocabulary token again').toBeGreaterThan(0);
    expect(ordinaryOverflow, 'the cap also clips an ordinary genre').toBe(0);
    expect(capped, 'clearing the cap left the column the same width, so the cap measures nothing').toBeLessThan(
      required('#library-header-genre').getBoundingClientRect().width,
    );
  });

  it('keeps the manual-add search field and its button on one row with a gap', async () => {
    await renderLibrary(resolvedLibrary([]), XL_VIEWPORT);

    await userEvent.click(required('#library-add-manual-toggle'));

    const input = required('#library-manual-search').getBoundingClientRect();
    const button = required('#library-manual-search-submit').getBoundingClientRect();
    const midline = (box: DOMRect): number => box.top + box.height * LayoutSettings.midlineFraction;
    expect(Math.abs(midline(input) - midline(button))).toBeLessThan(
      e2eSettings.library.tolerancesPx.searchRowCentre,
    );
    expect(button.left - input.right).toBeGreaterThanOrEqual(e2eSettings.library.tolerancesPx.searchButtonMinimumGap);
  });
});
