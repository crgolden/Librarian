import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, type Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { page } from 'vitest/browser';
import { newId, newText } from '@crgolden/modules/testing';
import { PsnGenreTokens } from '../../e2e/psn-constants';
import e2eSettings from '../../e2e/e2e-settings.json';
import { AppPaths, RouteDataKeys } from '../app/app-paths';
import type { CatalogGamesResponse, GameSummaryResponse } from '../curator/curator.models';
import { resolveTestComponentResources } from '../test-setup-resources.browser';
import { CatalogComponent } from './catalog.component';

const XL_VIEWPORT = e2eSettings.viewports.xl;

function newGame(genre: string): GameSummaryResponse {
  return {
    game_id: newId(),
    canonical_title: newText(),
    franchise: null,
    genre,
    aaa_tier: null,
    cover_image_url: null,
    store_product_id: null,
    critical_score: null,
    oc_score: null,
    psn_rating: null,
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

describe('The catalog grid in a real browser', () => {
  it('fits a raw genre token inside the narrowest card the grid can produce', async () => {
    const games = [newGame(PsnGenreTokens.rolePlayingGames)];
    const catalog: CatalogGamesResponse = { games, total: games.length, excluded_owned: 0 };
    const queryParams: Params = {};
    await page.viewport(XL_VIEWPORT.width, XL_VIEWPORT.height);
    await TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([{ path: AppPaths.catalog, children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { [RouteDataKeys.catalog]: catalog, [RouteDataKeys.genres]: [] }, queryParams },
            queryParams: new BehaviorSubject<Params>(queryParams).asObservable(),
          },
        },
      ],
    }).compileComponents();
    await resolveTestComponentResources();

    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await document.fonts.ready;

    const label = required('#catalog-genre-0');
    expect(label.getAttribute('data-genre')).toBe(PsnGenreTokens.rolePlayingGames);
    const card = label.closest('li');
    expect(card, 'the genre label is not inside a card').not.toBeNull();
    const cardStyle = getComputedStyle(card as HTMLElement);
    const range = document.createRange();
    range.selectNodeContents(label);
    const rendered = range.getBoundingClientRect().width;
    const narrowestContent =
      e2eSettings.catalogGridMinimumTrackPx - Number.parseFloat(cardStyle.paddingLeft) - Number.parseFloat(cardStyle.paddingRight);
    expect(rendered, 'the token measured zero width, so the fit check would pass against nothing').toBeGreaterThan(0);
    expect(rendered, 'the raw token spills out of its tile at the grid floor').toBeLessThanOrEqual(narrowestContent);
  });
});
