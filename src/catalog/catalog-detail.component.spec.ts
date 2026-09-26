import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { CatalogDetailComponent, GAME_LOAD_ERROR } from './catalog-detail.component';
import { ResolvedCatalogGame } from './catalog-detail.resolver';
import {
  CatalogPriceResponse,
  ContentKinds,
  GameSummaryResponse,
  PublicCollectionSummaryResponse,
} from '../curator/curator.models';
import { CuratorApi } from '../curator/curator-api';
import { RouteDataKeys, sharedCollectionUrl } from '../app/app-paths';
import { PageTitles, pageTitle } from '../shared/page-title';
import { MetaNames, MetaProperties, OgTypes } from '../shared/seo-contract';
import { contentKindLabel } from './content-kind-labels';
import { storeProductUrl } from './store-links';
import { priceLine } from './catalog.component';
import { FREE_WITH_PS_PLUS_LABEL } from './catalog.messages';
import { LinkRelTokens } from '../testing/html-constants';
import { ResolvedStatuses } from '../shared/resolved-status';
import { newCount, newId, newPercent, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

function ok(game: GameSummaryResponse, collections: PublicCollectionSummaryResponse[] = []): ResolvedCatalogGame {
  return { status: ResolvedStatuses.ok, game, collections };
}

function publicCollection(overrides: Partial<PublicCollectionSummaryResponse> = {}): PublicCollectionSummaryResponse {
  return {
    definition_id: newId(),
    name: newText(),
    share_slug: newId(),
    item_count: newCount(),
    updated_at: newUtcInstant(),
    ...overrides,
  };
}

function soleAmountLine(price: CatalogPriceResponse, cents: number): string {
  const line = priceLine({ ...price, base_cents: cents, discounted_cents: cents });
  if (line === null) {
    throw new Error('A price carrying an amount must render a line.');
  }
  return line;
}

function game(overrides: Partial<GameSummaryResponse> = {}): GameSummaryResponse {
  return {
    game_id: newId(),
    canonical_title: newText(),
    franchise: newText(),
    genre: newText(),
    aaa_tier: newText(),
    cover_image_url: null,
    store_product_id: null,
    critical_score: null,
    oc_score: null,
    psn_rating: null,
    percent_completed: null,
    content_kind: null,
    price: null,
    ...overrides,
  };
}

describe('CatalogDetailComponent', () => {
  let httpMock: HttpTestingController;

  function render(resolved: ResolvedCatalogGame): ComponentFixture<CatalogDetailComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { [RouteDataKeys.game]: resolved } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the resolved game with no request of its own', () => {
    const rated = game({ psn_rating: newPercent() });
    const fixture = render(ok(rated));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(rated.canonical_title);
    expect(compiled.querySelector('#catalog-detail-ratings')?.textContent).toContain(`PS Store ${rated.psn_rating}`);
    httpMock.expectNone((r) => r.url.startsWith(CuratorApi.catalogGames));
  });

  it('renders each rating the catalog has no value for without a score', () => {
    const fixture = render(ok(game()));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-detail-rawg-score')?.hasAttribute('data-score')).toBe(false);
    expect(compiled.querySelector('#catalog-detail-opencritic-score')?.hasAttribute('data-score')).toBe(false);
    expect(compiled.querySelector('#catalog-detail-psn-rating')?.hasAttribute('data-score')).toBe(false);
  });

  it('labels an entry that is not a game, and labels a game as nothing at all', () => {
    const mediaApp = render(ok(game({ content_kind: ContentKinds.mediaApp })));
    expect((mediaApp.nativeElement as HTMLElement).querySelector('#catalog-detail-kind')?.textContent).toContain(
      contentKindLabel(ContentKinds.mediaApp),
    );

    const plainGame = render(ok(game({ content_kind: ContentKinds.game })));
    expect((plainGame.nativeElement as HTMLElement).querySelector('#catalog-detail-kind')).toBeNull();

    const unclassified = render(ok(game({ content_kind: null })));
    expect((unclassified.nativeElement as HTMLElement).querySelector('#catalog-detail-kind')).toBeNull();
  });

  it('states the caller\'s trophy progress when Curator reports one, a zero included', () => {
    const percentCompleted = newPercent();

    const progressed = render(ok(game({ percent_completed: percentCompleted })));
    expect((progressed.nativeElement as HTMLElement).querySelector('#catalog-detail-progress')?.textContent).toContain(
      `${percentCompleted}%`,
    );

    const started = render(ok(game({ percent_completed: 0 })));
    expect(
      (started.nativeElement as HTMLElement).querySelector('#catalog-detail-progress')?.textContent,
      'zero percent is a real figure, so a truthiness check that hides it is the regression this pins',
    ).toContain('0%');
  });

  it('says nothing about trophy progress when Curator has none for this caller', () => {
    const fixture = render(ok(game({ percent_completed: null })));

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-progress')).toBeNull();
  });

  it('offers the PlayStation Store link only when a store product id exists', () => {
    const storeProductId = newId();
    const withId = render(ok(game({ store_product_id: storeProductId })));
    const link = (withId.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('#catalog-detail-store-link');
    expect(link?.href).toBe(storeProductUrl(storeProductId));
    expect(link?.rel).toContain(LinkRelTokens.noopener);

    const withoutId = render(ok(game({ store_product_id: null })));
    expect((withoutId.nativeElement as HTMLElement).querySelector('#catalog-detail-store-link')).toBeNull();
  });

  it('links to RAWG only when this game carries their score', () => {
    const scored = render(ok(game({ critical_score: newPercent() })));
    expect((scored.nativeElement as HTMLElement).querySelector('#rawg-attribution')).not.toBeNull();

    const unscored = render(ok(game({ critical_score: null, oc_score: newPercent() })));
    expect((unscored.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('states the price the storefront published, and says nothing when it published none', () => {
    const baseCents = randomIntBetween(2, 100_000);
    const discountedCents = randomIntBetween(1, baseCents);
    const discountText = newText();
    const price: CatalogPriceResponse = {
      is_free: false,
      tied_to_subscription: false,
      base_cents: baseCents,
      discounted_cents: discountedCents,
      discount_text: discountText,
      fetched_at: newUtcInstant(),
    };
    const priced = render(ok(game({ price })));
    const line = (priced.nativeElement as HTMLElement).querySelector('#catalog-detail-price')?.textContent;
    expect(line?.trim()).toBe(priceLine(price));
    expect(line).toContain(soleAmountLine(price, discountedCents));
    expect(line).toContain(soleAmountLine(price, baseCents));
    expect(line).toContain(discountText);

    const unpriced = render(ok(game({ price: null })));
    expect((unpriced.nativeElement as HTMLElement).querySelector('#catalog-detail-price')).toBeNull();
  });

  it('names a subscription-included title as such rather than as free', () => {
    const fixture = render(
      ok(
        game({
          price: {
            is_free: true,
            tied_to_subscription: true,
            base_cents: null,
            discounted_cents: null,
            discount_text: null,
            fetched_at: newUtcInstant(),
          },
        }),
      ),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-price')?.textContent).toContain(
      FREE_WITH_PS_PLUS_LABEL,
    );
  });

  it('lists the public collections holding this game, each linking to its share slug', () => {
    const collections = [publicCollection(), publicCollection()];
    const fixture = render(ok(game(), collections));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#catalog-detail-collections')).not.toBeNull();
    const links = compiled.querySelectorAll<HTMLAnchorElement>('[id^="catalog-detail-collection-"]');
    expect(links).toHaveLength(collections.length);
    expect(links[0]?.getAttribute('href')).toBe(sharedCollectionUrl(collections[0].share_slug));
    expect(links[0]?.textContent?.trim()).toBe(collections[0].name);
    expect(links[1]?.getAttribute('href')).toBe(sharedCollectionUrl(collections[1].share_slug));
  });

  it('renders no collections section at all when no public collection holds the game', () => {
    const fixture = render(ok(game(), []));

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-detail-collections')).toBeNull();
  });

  it('names no source on a game it could not load', () => {
    const fixture = render({ status: ResolvedStatuses.notFound });

    expect((fixture.nativeElement as HTMLElement).querySelector('#rawg-attribution')).toBeNull();
  });

  it('shows a not-found page for an unknown game id', () => {
    const fixture = render({ status: ResolvedStatuses.notFound });

    expect((fixture.nativeElement as HTMLElement).querySelector('#page-title')?.textContent).toBe(PageTitles.gameNotFound);
  });

  it('shows an error message when the resolver could not load the game', () => {
    const fixture = render({ status: ResolvedStatuses.error });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(GAME_LOAD_ERROR);
  });

  it('names the game in the document title and the social metadata', () => {
    const named = game();
    render(ok(named));

    expect(TestBed.inject(Title).getTitle()).toBe(pageTitle(named.canonical_title));
    const meta = TestBed.inject(Meta);
    expect(meta.getTag(`name="${MetaNames.description}"`)?.content).toContain(`${named.franchise} · ${named.genre} · ${named.aaa_tier}`);
    expect(meta.getTag(`property="${MetaProperties.ogTitle}"`)?.content).toBe(pageTitle(named.canonical_title));
    expect(meta.getTag(`property="${MetaProperties.ogDescription}"`)?.content).toContain(named.canonical_title);
    expect(meta.getTag(`property="${MetaProperties.ogType}"`)?.content).toBe(OgTypes.article);
  });

  it('gives the not-found and error branches their own titles rather than the route default', () => {
    render({ status: ResolvedStatuses.notFound });
    expect(TestBed.inject(Title).getTitle()).toBe(pageTitle(PageTitles.gameNotFound));

    render({ status: ResolvedStatuses.error });
    expect(TestBed.inject(Title).getTitle()).toBe(pageTitle(PageTitles.gameUnavailable));
  });
});
