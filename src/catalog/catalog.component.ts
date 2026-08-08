import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse } from '../curator/curator.models';

const PS_STORE_PRODUCT_BASE = 'https://store.playstation.com/product/';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-catalog',
  imports: [FormsModule],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent implements OnInit {
  private readonly curator = inject(CuratorService);

  protected readonly games = signal<GameSummaryResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly franchise = signal('');
  protected readonly genre = signal('');
  protected readonly aaaTier = signal('');
  protected readonly offset = signal(0);
  protected readonly total = signal(0);
  protected readonly pageSize = PAGE_SIZE;

  protected storeUrl(game: GameSummaryResponse): string | null {
    return game.store_product_id ? PS_STORE_PRODUCT_BASE + encodeURIComponent(game.store_product_id) : null;
  }

  protected readonly hasNextPage = signal(false);
  protected readonly hasPrevPage = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected applyFilters(): void {
    this.offset.set(0);
    this.load();
  }

  protected nextPage(): void {
    this.offset.update((value) => value + PAGE_SIZE);
    this.load();
  }

  protected prevPage(): void {
    this.offset.update((value) => Math.max(0, value - PAGE_SIZE));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.curator
      .listCatalogGames({
        q: this.search().trim() || undefined,
        franchise: this.franchise().trim() || undefined,
        genre: this.genre().trim() || undefined,
        aaaTier: this.aaaTier() || undefined,
        limit: PAGE_SIZE,
        offset: this.offset(),
      })
      .subscribe({
        next: (response) => {
          this.games.set(response.games);
          this.total.set(response.total);
          this.hasNextPage.set(this.offset() + response.games.length < response.total);
          this.hasPrevPage.set(this.offset() > 0);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load the catalog.');
          this.loading.set(false);
        },
      });
  }
}
