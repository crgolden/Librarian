import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CatalogGamesQuery, CuratorService } from '../curator/curator.service';
import {
  CatalogGamesResponse,
  CatalogKind,
  CatalogPriceResponse,
  CatalogSortField,
  GameSummaryResponse,
} from '../curator/curator.models';
import { RawgAttributionComponent } from '../app/shared/attribution/rawg-attribution.component';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { PageSizeComponent } from '../shared/page-size/page-size.component';
import { pageSizeChoicesUpTo, readPageSize, writePageSize } from '../shared/page-size/page-size.preference';
import { CATALOG_PAGE_SIZE } from './catalog.resolver';
import { storeProductUrl } from './store-links';

export const CATALOG_PAGE_SIZE_CEILING = 200;
export const CATALOG_PAGE_SIZE_KEY = 'catalog';
export const DEFAULT_CATALOG_KIND: CatalogKind = 'game';
export const DEFAULT_CATALOG_SORT = 'title:asc';

export const CATALOG_KIND_OPTIONS: readonly { value: CatalogKind; label: string }[] = [
  { value: 'game', label: 'Games' },
  { value: 'media_app', label: 'Media apps' },
  { value: 'add_on', label: 'Add-ons' },
  { value: 'demo', label: 'Demos' },
  { value: 'soundtrack', label: 'Soundtracks' },
  { value: 'theme', label: 'Themes' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'all', label: 'Everything' },
];

export const CATALOG_SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'title:asc', label: 'Title (A–Z)' },
  { value: 'title:desc', label: 'Title (Z–A)' },
  { value: 'price:asc', label: 'Price (low to high)' },
  { value: 'price:desc', label: 'Price (high to low)' },
];

const CONTENT_KIND_LABELS: Readonly<Record<string, string>> = {
  media_app: 'Media app',
  add_on: 'Add-on',
  demo: 'Demo',
  soundtrack: 'Soundtrack',
  theme: 'Theme',
  subscription: 'Subscription',
};

const CENTS_PER_DOLLAR = 100;
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function priceLine(price: CatalogPriceResponse | null | undefined): string | null {
  if (!price) {
    return null;
  }
  if (price.is_free) {
    return price.tied_to_subscription ? 'Free with PlayStation Plus' : 'Free';
  }
  const base = price.base_cents === null ? null : USD.format(price.base_cents / CENTS_PER_DOLLAR);
  const discounted = price.discounted_cents === null ? null : USD.format(price.discounted_cents / CENTS_PER_DOLLAR);
  if (discounted !== null && base !== null && price.discounted_cents !== price.base_cents) {
    const discount = price.discount_text ? ` (${price.discount_text})` : '';
    return `${discounted}, was ${base}${discount}`;
  }
  return discounted ?? base;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, LoadingOverlayComponent, PageSizeComponent, RawgAttributionComponent, RouterLink],
  templateUrl: './catalog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent {
  private readonly curator = inject(CuratorService);
  private readonly route = inject(ActivatedRoute);
  private readonly pageRequests = new Subject<CatalogGamesQuery>();

  protected readonly games = signal<GameSummaryResponse[]>([]);
  protected readonly showsRawgData = computed(() => this.games().some((game) => game.critical_score !== null));
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly franchise = signal('');
  protected readonly genre = signal('');
  protected readonly aaaTier = signal('');
  protected readonly kind = signal<CatalogKind>(DEFAULT_CATALOG_KIND);
  protected readonly sortValue = signal(DEFAULT_CATALOG_SORT);
  protected readonly kindOptions = CATALOG_KIND_OPTIONS;
  protected readonly sortOptions = CATALOG_SORT_OPTIONS;
  protected readonly genreOptions = signal<string[]>([]);
  protected readonly offset = signal(0);
  protected readonly total = signal(0);
  protected readonly pageSize = signal(CATALOG_PAGE_SIZE);
  protected readonly pageSizeChoices = pageSizeChoicesUpTo(CATALOG_PAGE_SIZE_CEILING, CATALOG_PAGE_SIZE);

  protected metaLine(game: GameSummaryResponse): string {
    return [game.franchise, game.aaa_tier].filter((part) => !!part).join(' · ');
  }

  protected storeUrl(game: GameSummaryResponse): string | null {
    return storeProductUrl(game.store_product_id);
  }

  protected priceLine(game: GameSummaryResponse): string | null {
    return priceLine(game.price);
  }

  protected kindLabel(game: GameSummaryResponse): string | null {
    return game.content_kind ? (CONTENT_KIND_LABELS[game.content_kind] ?? null) : null;
  }

  protected onKindChange(value: CatalogKind): void {
    this.kind.set(value);
    this.applyFilters();
  }

  protected onSortChange(value: string): void {
    this.sortValue.set(value);
    this.applyFilters();
  }

  protected readonly hasNextPage = signal(false);
  protected readonly hasPrevPage = signal(false);

  constructor() {
    this.pageRequests
      .pipe(
        switchMap((query) =>
          this.curator.listCatalogGames(query).pipe(
            map((response): CatalogGamesResponse | null => response),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        if (response === null) {
          this.error.set('Unable to load the catalog.');
          return;
        }
        this.applyPage(response);
      });

    this.genreOptions.set((this.route.snapshot.data['genres'] as string[] | undefined) ?? []);

    const resolved = this.route.snapshot.data['catalog'] as CatalogGamesResponse | null;
    if (resolved === null) {
      this.error.set('Unable to load the catalog.');
      return;
    }
    this.applyPage(resolved);

    const preferred = readPageSize(CATALOG_PAGE_SIZE_KEY, this.pageSizeChoices, CATALOG_PAGE_SIZE);
    if (preferred !== CATALOG_PAGE_SIZE) {
      this.pageSize.set(preferred);
      this.load();
    }
  }

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    writePageSize(CATALOG_PAGE_SIZE_KEY, size);
    this.offset.set(0);
    this.load();
  }

  private applyPage(response: CatalogGamesResponse): void {
    this.games.set(response.games);
    this.total.set(response.total);
    this.hasNextPage.set(this.offset() + response.games.length < response.total);
    this.hasPrevPage.set(this.offset() > 0);
  }

  protected applyFilters(): void {
    this.offset.set(0);
    this.load();
  }

  protected nextPage(): void {
    this.offset.update((value) => value + this.pageSize());
    this.load();
  }

  protected prevPage(): void {
    this.offset.update((value) => Math.max(0, value - this.pageSize()));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const [sort, sortDir] = this.sortValue().split(':');
    this.pageRequests.next({
      q: this.search().trim() || undefined,
      franchise: this.franchise().trim() || undefined,
      genre: this.genre().trim() || undefined,
      aaaTier: this.aaaTier() || undefined,
      kind: this.kind(),
      sort: sort as CatalogSortField,
      sortDir: sortDir === 'desc' ? 'desc' : 'asc',
      limit: this.pageSize(),
      offset: this.offset(),
    });
  }
}
