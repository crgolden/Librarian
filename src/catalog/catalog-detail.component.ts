import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameSummaryResponse } from '../curator/curator.models';
import { ResolvedCatalogGame } from './catalog-detail.resolver';

const PS_STORE_PRODUCT_BASE = 'https://store.playstation.com/product/';

@Component({
  selector: 'app-catalog-detail',
  imports: [RouterLink],
  templateUrl: './catalog-detail.component.html',
  styleUrl: './catalog-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  protected readonly game = signal<GameSummaryResponse | null>(null);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['game'] as ResolvedCatalogGame;
    if (resolved.status === 'not-found') {
      this.notFound.set(true);
      this.describe('Game not found — Librarian', 'No game in the catalog has that id.');
      return;
    }
    if (resolved.status === 'error') {
      this.error.set('Unable to load this game.');
      this.describe('Game unavailable — Librarian', 'This catalog entry could not be loaded.');
      return;
    }

    this.game.set(resolved.game);
    this.describe(`${resolved.game.canonical_title} — Librarian`, this.description(resolved.game));
  }

  protected metaLine(game: GameSummaryResponse): string {
    return [game.franchise, game.genre, game.aaa_tier].filter((part) => !!part).join(' · ');
  }

  protected storeUrl(game: GameSummaryResponse): string | null {
    return game.store_product_id ? PS_STORE_PRODUCT_BASE + encodeURIComponent(game.store_product_id) : null;
  }

  private description(game: GameSummaryResponse): string {
    const classification = this.metaLine(game);
    return classification
      ? `${game.canonical_title} — ${classification}. Catalogued in Librarian with critic scores and trophy progress.`
      : `${game.canonical_title}, catalogued in Librarian with critic scores and trophy progress.`;
  }

  private describe(pageTitle: string, description: string): void {
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
  }
}
