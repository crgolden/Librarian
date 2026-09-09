import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ColumnDef,
  injectTable,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type Header,
  type PaginationState,
  type SortingState,
} from '@tanstack/angular-table';
import { Subject, Subscription, debounceTime, distinctUntilChanged, interval, retry, switchMap, takeWhile } from 'rxjs';
import { CuratorService, LibraryQuery, LibrarySortField } from '../curator/curator.service';
import {
  GameSummaryResponse,
  LibraryGameResponse,
  LibraryRefreshResultSummary,
  LibraryRefreshStatusResponse,
  ProfileLibraryGameResponse,
  RefreshScheduleResponse,
  StoreSearchResultResponse,
} from '../curator/curator.models';
import { RawgAttributionComponent } from '../app/shared/attribution/rawg-attribution.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { LIBRARY_PAGE_SIZE, ResolvedLibrary } from './library.resolver';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { PageSizeComponent } from '../shared/page-size/page-size.component';
import { pageSizeChoicesUpTo, readPageSize, writePageSize } from '../shared/page-size/page-size.preference';

export const LIBRARY_PAGE_SIZE_CEILING = 100;
export const LIBRARY_PAGE_SIZE_KEY = 'library';

const POLL_INTERVAL_MS = 2500;
const POLL_ERROR_RETRY_COUNT = 3;
const POLL_ERROR_RETRY_DELAY_MS = 2000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const PAUSED_STATUSES = new Set(['rate_limited']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed', 'rate_limited', 'cancelled']);
const SUMMARY_TITLE_DISPLAY_CAP = 10;
const SEARCH_DEBOUNCE_MS = 300;
const MANUAL_SEARCH_LIMIT = 10;
const NO_PSN_LINK_STATUS = 404;

type LibraryGame = LibraryGameResponse | ProfileLibraryGameResponse;

const LIBRARY_TABLE_FEATURES = tableFeatures({ rowSortingFeature, rowPaginationFeature });

const LIBRARY_COLUMNS: ColumnDef<typeof LIBRARY_TABLE_FEATURES, LibraryGame>[] = [
  { id: 'cover', header: 'Cover', enableSorting: false },
  { id: 'title', accessorKey: 'title', header: 'Title' },
  { id: 'platforms', accessorKey: 'platforms', header: 'Platforms', enableSorting: false },
  { id: 'genre', accessorKey: 'genre', header: 'Genre', sortDescFirst: false },
  { id: 'rawg_rating', accessorKey: 'rawg_rating', header: 'RAWG' },
  { id: 'opencritic_rating', accessorKey: 'opencritic_rating', header: 'OpenCritic' },
  { id: 'psn_rating', accessorKey: 'psn_rating', header: 'PS Store' },
  { id: 'percent_completed', accessorKey: 'percent_completed', header: '% Completed' },
  { id: 'catalog_link', header: 'Catalog', enableSorting: false },
];

@Component({
  selector: 'app-library',
  imports: [
    FormsModule,
    DatePipe,
    BreadcrumbComponent,
    LoadingOverlayComponent,
    PageSizeComponent,
    RawgAttributionComponent,
    RouterLink,
  ],
  templateUrl: './library.component.html',
  styleUrl: './library.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pollSubscription: Subscription | null = null;
  private readonly searchCommit = new Subject<string>();
  private searchCommitSubscription: Subscription | null = null;
  @ViewChild('storeMatchDialog') private storeMatchDialog?: ElementRef<HTMLDialogElement>;

  protected readonly viewerMode = signal(false);
  protected readonly viewerForbidden = signal(false);
  protected readonly sub = signal<string | null>(null);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);

  protected readonly schedule = signal<RefreshScheduleResponse | null>(null);

  protected readonly refreshing = signal(false);
  protected readonly status = signal<LibraryRefreshStatusResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly unexpectedStatus = signal(false);

  protected readonly games = signal<LibraryGame[]>([]);
  protected readonly showsRawgData = computed(
    () =>
      this.games().some((game) => game.rawg_enriched) ||
      (this.status()?.result_summary?.rawg_enriched_titles.length ?? 0) > 0,
  );
  protected readonly total = signal(0);
  protected readonly gamesLoading = signal(false);
  protected readonly gamesError = signal<string | null>(null);

  protected readonly searchInput = signal('');
  protected readonly committedSearch = signal('');
  protected readonly genreFilter = signal('');
  protected readonly genreOptions = signal<string[]>([]);

  protected readonly addingManual = signal(false);
  protected readonly manualSearch = signal('');
  protected readonly manualResults = signal<GameSummaryResponse[]>([]);
  protected readonly manualSearching = signal(false);
  protected readonly manualPending = signal<string | null>(null);
  protected readonly manualError = signal<string | null>(null);

  protected readonly storeCandidates = signal<StoreSearchResultResponse[]>([]);
  protected readonly storeQuery = signal<string | null>(null);
  protected readonly storeUnlinked = signal(false);
  protected readonly storeMatchError = signal<string | null>(null);

  protected readonly sorting = signal<SortingState>([{ id: 'title', desc: false }]);
  protected readonly pagination = signal<PaginationState>({ pageIndex: 0, pageSize: LIBRARY_PAGE_SIZE });
  protected readonly pageSizeChoices = pageSizeChoicesUpTo(LIBRARY_PAGE_SIZE_CEILING, LIBRARY_PAGE_SIZE);

  protected readonly table = injectTable(() => ({
    features: LIBRARY_TABLE_FEATURES,
    data: this.games(),
    columns: LIBRARY_COLUMNS,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    rowCount: this.total(),
    state: { sorting: this.sorting(), pagination: this.pagination() },
    onSortingChange: (updater) => {
      this.sorting.update((old) => (typeof updater === 'function' ? updater(old) : updater));
      this.pagination.update((old) => ({ ...old, pageIndex: 0 }));
      this.reload();
    },
    onPaginationChange: (updater) => {
      this.pagination.update((old) => (typeof updater === 'function' ? updater(old) : updater));
      this.reload();
    },
  }));

  protected readonly hasNextPage = computed(() => this.table.getCanNextPage());
  protected readonly hasPrevPage = computed(() => this.table.getCanPreviousPage());

  protected readonly pageStart = computed(() =>
    this.total() === 0 ? 0 : this.pagination().pageIndex * this.pagination().pageSize + 1,
  );

  protected readonly pageEnd = computed(() =>
    Math.min((this.pagination().pageIndex + 1) * this.pagination().pageSize, this.total()),
  );

  protected readonly mobileSortValue = computed(() => {
    const current = this.sorting()[0];
    return current ? `${current.id}:${current.desc ? 'desc' : 'asc'}` : 'title:asc';
  });

  ngOnInit(): void {
    this.searchCommitSubscription = this.searchCommit
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged())
      .subscribe((value) => {
        this.committedSearch.set(value);
        this.pagination.update((old) => ({ ...old, pageIndex: 0 }));
        this.reload();
      });

    const sub = this.route.snapshot.paramMap.get('sub');
    if (sub !== null) {
      this.viewerMode.set(true);
      this.sub.set(sub);
      this.breadcrumbItems.set([{ label: 'Profile', link: ['/u', sub] }, { label: 'Library' }]);
    }

    const resolved = this.route.snapshot.data['library'] as ResolvedLibrary;
    if (resolved.status === 'forbidden') {
      this.viewerForbidden.set(true);
      return;
    }
    if (resolved.status === 'error') {
      this.gamesError.set(
        sub !== null ? "Unable to load this user's library." : 'Unable to load your library.',
      );
      return;
    }

    this.games.set(resolved.games);
    this.total.set(resolved.total);
    this.genreOptions.set(resolved.genres);
    this.schedule.set(resolved.schedule);

    const preferred = readPageSize(LIBRARY_PAGE_SIZE_KEY, this.pageSizeChoices, LIBRARY_PAGE_SIZE);
    if (preferred !== LIBRARY_PAGE_SIZE) {
      this.pagination.set({ pageIndex: 0, pageSize: preferred });
      this.reload();
    }
  }

  protected setPageSize(size: number): void {
    writePageSize(LIBRARY_PAGE_SIZE_KEY, size);
    this.pagination.set({ pageIndex: 0, pageSize: size });
    this.reload();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.searchCommitSubscription?.unsubscribe();
  }

  private currentQuery(): LibraryQuery {
    const sorting = this.sorting();
    const pagination = this.pagination();
    return {
      q: this.committedSearch() || undefined,
      genre: this.genreFilter() || undefined,
      sort: (sorting[0]?.id as LibrarySortField | undefined) ?? 'title',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    };
  }

  private reload(): void {
    this.load(this.viewerMode(), this.sub(), this.currentQuery());
  }

  private loadGenres(): void {
    const sub = this.sub();
    const request =
      this.viewerMode() && sub !== null ? this.curator.getUserLibraryGenres(sub) : this.curator.getLibraryGenres();
    request.subscribe({
      next: (response) => this.genreOptions.set(response.genres),
      error: () => undefined,
    });
  }

  protected isManual(game: LibraryGame): boolean {
    return 'source' in game && game.source === 'manual';
  }

  protected toggleAddManual(): void {
    this.addingManual.update((open) => !open);
    this.manualSearch.set('');
    this.manualResults.set([]);
    this.manualError.set(null);
    this.storeUnlinked.set(false);
    this.closeStoreMatch();
  }

  protected searchCatalog(): void {
    const term = this.manualSearch().trim();
    if (!term) {
      this.manualResults.set([]);
      return;
    }
    this.manualSearching.set(true);
    this.manualError.set(null);
    this.storeUnlinked.set(false);
    this.curator.listCatalogGames({ q: term, limit: MANUAL_SEARCH_LIMIT }).subscribe({
      next: (response) => {
        this.manualResults.set(response.games);
        if (response.games.length > 0) {
          this.manualSearching.set(false);
          return;
        }
        this.crossCheckAgainstTheStore(term);
      },
      error: () => {
        this.manualSearching.set(false);
        this.manualError.set('Unable to search the catalog.');
      },
    });
  }

  private crossCheckAgainstTheStore(term: string): void {
    this.curator.searchStoreForManualAdd(term, MANUAL_SEARCH_LIMIT).subscribe({
      next: (response) => {
        this.manualSearching.set(false);
        const named = response.results.filter((result) => result.id !== null && result.name !== null);
        if (named.length === 0) {
          this.manualError.set(`Nothing in the catalog or the PlayStation Store matches "${term}".`);
          return;
        }
        this.storeQuery.set(term);
        this.storeCandidates.set(named);
        this.storeMatchError.set(null);
        this.openStoreMatch();
      },
      error: (err: HttpErrorResponse) => {
        this.manualSearching.set(false);
        if (err.status === NO_PSN_LINK_STATUS) {
          this.storeUnlinked.set(true);
          return;
        }
        this.manualError.set(`"${term}" is not in the catalog, and the PlayStation Store could not be checked.`);
      },
    });
  }

  private openStoreMatch(): void {
    if (!this.isBrowser) {
      return;
    }
    const dialog = this.storeMatchDialog?.nativeElement;
    if (dialog !== undefined && !dialog.open) {
      dialog.showModal();
    }
  }

  protected closeStoreMatch(): void {
    const dialog = this.storeMatchDialog?.nativeElement;
    if (dialog?.open === true) {
      dialog.close();
    }
    this.storeCandidates.set([]);
    this.storeQuery.set(null);
    this.storeMatchError.set(null);
  }

  protected dismissStoreMatchOnBackdrop(event: MouseEvent): void {
    if (event.target === this.storeMatchDialog?.nativeElement) {
      this.closeStoreMatch();
    }
  }

  protected addManualGame(game: GameSummaryResponse): void {
    this.manualPending.set(game.game_id);
    this.manualError.set(null);
    this.curator.addManualGame({ game_id: game.game_id }).subscribe({
      next: () => this.manualAddSucceeded(),
      error: () => {
        this.manualPending.set(null);
        this.manualError.set(`Unable to add ${game.canonical_title}.`);
      },
    });
  }

  protected acceptStoreMatch(candidate: StoreSearchResultResponse): void {
    const query = this.storeQuery();
    const id = candidate.id;
    if (query === null || id === null) {
      return;
    }
    this.manualPending.set(id);
    this.storeMatchError.set(null);
    this.curator.addManualGame({ store_hit: { query, id } }).subscribe({
      next: () => {
        this.closeStoreMatch();
        this.manualAddSucceeded();
      },
      error: () => {
        this.manualPending.set(null);
        this.storeMatchError.set(`Unable to add ${candidate.name}.`);
      },
    });
  }

  private manualAddSucceeded(): void {
    this.manualPending.set(null);
    this.addingManual.set(false);
    this.manualSearch.set('');
    this.manualResults.set([]);
    this.reload();
  }

  protected removeManualGame(game: LibraryGame): void {
    this.manualPending.set(game.game_id);
    this.manualError.set(null);
    this.curator.removeManualGame(game.game_id).subscribe({
      next: () => {
        this.manualPending.set(null);
        this.reload();
      },
      error: () => {
        this.manualPending.set(null);
        this.manualError.set(`Unable to remove ${game.title}.`);
      },
    });
  }

  private load(viewerMode: boolean, sub: string | null, query: LibraryQuery): void {
    this.gamesLoading.set(true);
    this.gamesError.set(null);

    if (viewerMode && sub !== null) {
      this.curator.getUserLibrary(sub, query).subscribe({
        next: (response) => {
          this.games.set(response.games);
          this.total.set(response.total);
          this.gamesLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.gamesLoading.set(false);
          if (err.status === 403) {
            this.viewerForbidden.set(true);
          } else {
            this.gamesError.set("Unable to load this user's library.");
          }
        },
      });
    } else {
      this.curator.getLibrary(query).subscribe({
        next: (response) => {
          this.games.set(response.games);
          this.total.set(response.total);
          this.gamesLoading.set(false);
        },
        error: () => {
          this.gamesLoading.set(false);
          this.gamesError.set('Unable to load your library.');
        },
      });
    }
  }

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.searchCommit.next(value.trim());
  }

  protected onGenreFilterChange(value: string): void {
    this.genreFilter.set(value);
    this.pagination.update((old) => ({ ...old, pageIndex: 0 }));
    this.reload();
  }

  protected onMobileSortChange(value: string): void {
    const [id, dir] = value.split(':');
    this.sorting.set([{ id, desc: dir === 'desc' }]);
    this.pagination.update((old) => ({ ...old, pageIndex: 0 }));
    this.reload();
  }

  protected nextPage(): void {
    this.table.nextPage();
  }

  protected prevPage(): void {
    this.table.previousPage();
  }

  protected percentCompletedDisplay(percentCompleted: number | null): string {
    return percentCompleted === null ? '—' : `${percentCompleted}%`;
  }

  protected percentCompletedTitle(): string | undefined {
    return this.viewerMode() ? "Trophy completion isn't shown for other users' libraries yet." : undefined;
  }

  protected headerLabel(header: Header<typeof LIBRARY_TABLE_FEATURES, LibraryGame, unknown>): string | null {
    if (header.isPlaceholder) {
      return null;
    }
    const label = header.column.columnDef.header;
    return typeof label === 'string' ? label : null;
  }

  protected onHeaderKeydown(event: Event, header: Header<typeof LIBRARY_TABLE_FEATURES, LibraryGame, unknown>): void {
    event.preventDefault();
    header.column.getToggleSortingHandler()?.(event);
  }

  protected summaryTitles(titles: string[]): { shown: string[]; more: number } {
    return {
      shown: titles.slice(0, SUMMARY_TITLE_DISPLAY_CAP),
      more: Math.max(0, titles.length - SUMMARY_TITLE_DISPLAY_CAP),
    };
  }

  protected refresh(): void {
    this.refreshing.set(true);
    this.error.set(null);
    this.status.set(null);
    this.unexpectedStatus.set(false);

    this.curator.refreshLibrary().subscribe({
      next: ({ run_id }) => this.startPolling(run_id),
      error: () => {
        this.refreshing.set(false);
        this.error.set('Unable to start a library refresh.');
      },
    });
  }

  private startPolling(runId: string): void {
    if (!this.isBrowser) {
      this.refreshing.set(false);
      return;
    }

    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.curator.getLibraryRefreshStatus(runId)),
        retry({ count: POLL_ERROR_RETRY_COUNT, delay: POLL_ERROR_RETRY_DELAY_MS, resetOnSuccess: true }),
        takeWhile((response) => !this.pollingComplete(response.status), true),
      )
      .subscribe({
        next: (response) => {
          this.status.set(response);
          if (!KNOWN_STATUSES.has(response.status)) {
            this.unexpectedStatus.set(true);
          }
          if (this.pollingComplete(response.status)) {
            this.refreshing.set(false);
          }
          if (response.status === 'succeeded') {
            this.pagination.update((old) => ({ ...old, pageIndex: 0 }));
            this.reload();
            this.loadGenres();
          }
        },
        error: () => {
          this.refreshing.set(false);
          this.error.set('Lost track of the refresh job.');
        },
      });
  }

  protected retryAfterLabel(summary: LibraryRefreshResultSummary | null | undefined): string | null {
    const seconds = summary?.retry_after_seconds;
    if (seconds === undefined || seconds <= 0) {
      return null;
    }

    const minutes = Math.round(seconds / 60);
    return minutes >= 60 ? ` in about ${Math.round(minutes / 60)} hour(s)` : ` in about ${minutes} minute(s)`;
  }

  private pollingComplete(status: string): boolean {
    return TERMINAL_STATUSES.has(status) || PAUSED_STATUSES.has(status) || !KNOWN_STATUSES.has(status);
  }
}
