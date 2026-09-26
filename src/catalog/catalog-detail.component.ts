import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { GameSummaryResponse, PublicCollectionSummaryResponse } from '../curator/curator.models';
import { RawgAttributionComponent } from '../app/shared/attribution/rawg-attribution.component';
import { ResolvedCatalogGame } from './catalog-detail.resolver';
import { priceLine } from './catalog.component';
import { contentKindLabel } from './content-kind-labels';
import { storeProductUrl } from './store-links';
import { AppUrls, RouteDataKeys } from '../app/app-paths';
import { PageTitles, SITE_NAME, pageTitle } from '../shared/page-title';
import { CatalogMetaDirective, SpineLabelDirective } from '../shared/primitives/typography';
import { MetaNames, MetaProperties, OgTypes } from '../shared/seo-contract';
import { ResolvedStatuses } from '../shared/resolved-status';

export const GAME_LOAD_ERROR = 'Unable to load this game.';

export const GAME_NOT_FOUND_DESCRIPTION = 'No game in the catalog has that id.';

export const GAME_UNAVAILABLE_DESCRIPTION = 'This catalog entry could not be loaded.';

export const CATALOGUED_SENTENCE = `Catalogued in ${SITE_NAME} with critic scores and trophy progress.`;

export const CATALOGUED_CLAUSE = `catalogued in ${SITE_NAME} with critic scores and trophy progress.`;

@Component({
  selector: 'app-catalog-detail',
  imports: [RawgAttributionComponent, RouterLink, CardDirective, PageSectionDirective, CatalogMetaDirective, SpineLabelDirective],
  templateUrl: './catalog-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailComponent implements OnInit {
  protected readonly appUrls = AppUrls;
  protected readonly pageTitles = PageTitles;
  protected readonly notFoundDescription = GAME_NOT_FOUND_DESCRIPTION;

  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly game = signal<GameSummaryResponse | null>(null);
  protected readonly collections = signal<PublicCollectionSummaryResponse[]>([]);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const resolved = this.route.snapshot.data[RouteDataKeys.game] as ResolvedCatalogGame;
    if (resolved.status === ResolvedStatuses.notFound) {
      this.notFound.set(true);
      this.describe(pageTitle(PageTitles.gameNotFound), GAME_NOT_FOUND_DESCRIPTION);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.error.set(GAME_LOAD_ERROR);
      this.describe(pageTitle(PageTitles.gameUnavailable), GAME_UNAVAILABLE_DESCRIPTION);
      return;
    }

    this.game.set(resolved.game);
    this.collections.set(resolved.collections);
    this.describe(pageTitle(resolved.game.canonical_title), this.description(resolved.game));
  }

  protected metaLine(game: GameSummaryResponse): string {
    return [game.franchise, game.genre, game.aaa_tier].filter((part) => !!part).join(' · ');
  }

  protected kindLabel(game: GameSummaryResponse): string | null {
    return contentKindLabel(game.content_kind);
  }

  protected storeUrl(game: GameSummaryResponse): string | null {
    return storeProductUrl(game.store_product_id);
  }

  protected priceLine(game: GameSummaryResponse): string | null {
    return priceLine(game.price);
  }

  private description(game: GameSummaryResponse): string {
    const classification = this.metaLine(game);
    return classification
      ? `${game.canonical_title} — ${classification}. ${CATALOGUED_SENTENCE}`
      : `${game.canonical_title}, ${CATALOGUED_CLAUSE}`;
  }

  private describe(ogTitle: string, description: string): void {
    this.title.setTitle(ogTitle);
    this.meta.updateTag({ name: MetaNames.description, content: description });
    this.meta.updateTag({ property: MetaProperties.ogTitle, content: ogTitle });
    this.meta.updateTag({ property: MetaProperties.ogDescription, content: description });
    this.meta.updateTag({ property: MetaProperties.ogType, content: OgTypes.article });
  }
}
