import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuratorService } from '../curator/curator.service';
import { GameSummaryResponse } from '../curator/curator.models';

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

  protected readonly franchise = signal('');
  protected readonly genre = signal('');
  protected readonly aaaTier = signal('');
  protected readonly offset = signal(0);

  // The catalog endpoint returns no total count, so "is there a next page" is inferred from a
  // full page coming back, not a real known-total pager.
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
        franchise: this.franchise().trim() || undefined,
        genre: this.genre().trim() || undefined,
        aaaTier: this.aaaTier() || undefined,
        limit: PAGE_SIZE,
        offset: this.offset(),
      })
      .subscribe({
        next: (response) => {
          this.games.set(response.games);
          this.hasNextPage.set(response.games.length === PAGE_SIZE);
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
