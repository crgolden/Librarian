import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { CatalogGamesQuery, CuratorService } from '../curator/curator.service';
import { CatalogGamesResponse, CatalogKind, CatalogPriceResponse, GameSummaryResponse } from '../curator/curator.models';
import { RawgAttributionComponent } from '../app/shared/attribution/rawg-attribution.component';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { PageSizeComponent } from '../shared/page-size/page-size.component';
import { pageSizeChoicesUpTo, readPageSize, writePageSize } from '../shared/page-size/page-size.preference';
import {
  CATALOG_KIND_OPTIONS,
  CATALOG_PAGE_SIZE,
  CATALOG_PAGE_SIZE_CEILING,
  CATALOG_PAGE_SIZE_KEY,
  CATALOG_SORT_OPTIONS,
  catalogFranchiseFrom,
  catalogGenreFrom,
  catalogKindFrom,
  catalogPageFrom,
  catalogPageSizeFrom,
  catalogQueryFromParams,
  catalogQueryKey,
  catalogSearchFrom,
  catalogSortValueFrom,
  catalogTierFrom,
} from './catalog.query';
import { trimmedOrNull } from '../shared/control-value';
import { storeProductUrl } from './store-links';

export {
  CATALOG_KIND_OPTIONS,
  CATALOG_PAGE_SIZE_CEILING,
  CATALOG_PAGE_SIZE_KEY,
  CATALOG_SORT_OPTIONS,
  DEFAULT_CATALOG_KIND,
  DEFAULT_CATALOG_SORT,
} from './catalog.query';
import { contentKindLabel } from './content-kind-labels';

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
    return price.discount_text
      ? `${discounted}, was ${base} (${price.discount_text})`
      : `${discounted}, was ${base}`;
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
  private readonly router = inject(Router);
  private readonly pageRequests = new Subject<CatalogGamesQuery>();

  protected readonly games = signal<GameSummaryResponse[]>([]);
  protected readonly showsRawgData = computed(() => this.games().some((game) => game.critical_score !== null));
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal<string | null>(null);
  protected readonly franchise = signal<string | null>(null);
  protected readonly genre = signal<string | null>(null);
  protected readonly aaaTier = signal<string | null>(null);
  protected readonly kind = signal<CatalogKind>(catalogKindFrom({}));
  protected readonly sortValue = signal(catalogSortValueFrom({}));
  protected readonly kindOptions = CATALOG_KIND_OPTIONS;
  protected readonly sortOptions = CATALOG_SORT_OPTIONS;
  protected readonly genreOptions = signal<string[]>([]);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly pageSize = signal(CATALOG_PAGE_SIZE);
  protected readonly offset = computed(() => (this.page() - 1) * this.pageSize());
  protected readonly pageSizeChoices = pageSizeChoicesUpTo(CATALOG_PAGE_SIZE_CEILING, CATALOG_PAGE_SIZE);

  protected readonly hasNextPage = signal(false);
  protected readonly hasPrevPage = signal(false);

  private loadedKey: string;

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

    this.loadedKey = catalogQueryKey(catalogQueryFromParams(this.route.snapshot.queryParams));
    this.readControlsFrom(this.route.snapshot.queryParams);

    const resolved = this.route.snapshot.data['catalog'] as CatalogGamesResponse | null;
    if (resolved === null) {
      this.error.set('Unable to load the catalog.');
    } else {
      this.applyPage(resolved);
    }

    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.readControlsFrom(params);
      const query = catalogQueryFromParams(params);
      const key = catalogQueryKey(query);
      if (key === this.loadedKey) {
        return;
      }
      this.loadedKey = key;
      this.load(query);
    });

    this.seedPageSizeFromPreference();
  }

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
    return contentKindLabel(game.content_kind);
  }

  protected pageParams(page: number): Params {
    return { page: page === 1 ? null : page };
  }

  protected onKindChange(value: CatalogKind): void {
    this.writeListStateToUrl({ kind: value });
  }

  protected onSortChange(value: string): void {
    const [sort, sortDir] = value.split(':');
    this.writeListStateToUrl({ sort, sortDir });
  }

  protected applyFilters(): void {
    this.writeListStateToUrl({
      q: trimmedOrNull(this.search()),
      franchise: trimmedOrNull(this.franchise()),
      genre: this.genre(),
      aaaTier: this.aaaTier(),
    });
  }

  protected setPageSize(size: number): void {
    writePageSize(CATALOG_PAGE_SIZE_KEY, size);
    this.writeListStateToUrl({ pageSize: size === CATALOG_PAGE_SIZE ? null : size });
  }

  private writeListStateToUrl(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...queryParams, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private readControlsFrom(params: Params): void {
    this.search.set(catalogSearchFrom(params));
    this.franchise.set(catalogFranchiseFrom(params));
    this.genre.set(catalogGenreFrom(params));
    this.aaaTier.set(catalogTierFrom(params));
    this.kind.set(catalogKindFrom(params));
    this.sortValue.set(catalogSortValueFrom(params));
    this.page.set(catalogPageFrom(params));
    this.pageSize.set(catalogPageSizeFrom(params));
  }

  private seedPageSizeFromPreference(): void {
    if (this.route.snapshot.queryParams['pageSize'] !== undefined) {
      return;
    }
    const preferred = readPageSize(CATALOG_PAGE_SIZE_KEY, this.pageSizeChoices, CATALOG_PAGE_SIZE);
    if (preferred === CATALOG_PAGE_SIZE) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pageSize: preferred },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private applyPage(response: CatalogGamesResponse): void {
    this.games.set(response.games);
    this.total.set(response.total);
    this.hasNextPage.set(this.offset() + response.games.length < response.total);
    this.hasPrevPage.set(this.offset() > 0);
  }

  private load(query: CatalogGamesQuery): void {
    this.loading.set(true);
    this.error.set(null);
    this.pageRequests.next(query);
  }
}
