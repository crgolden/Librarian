import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
export class CatalogDetailComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly game = signal<GameSummaryResponse | null>(null);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const resolved = this.route.snapshot.data['game'] as ResolvedCatalogGame;
    if (resolved.status === 'not-found') {
      this.notFound.set(true);
      return;
    }
    if (resolved.status === 'error') {
      this.error.set('Unable to load this game.');
      return;
    }
    this.game.set(resolved.game);
  }

  protected metaLine(game: GameSummaryResponse): string {
    return [game.franchise, game.genre, game.aaa_tier].filter((part) => !!part).join(' · ');
  }

  protected storeUrl(game: GameSummaryResponse): string | null {
    return game.store_product_id ? PS_STORE_PRODUCT_BASE + encodeURIComponent(game.store_product_id) : null;
  }
}
