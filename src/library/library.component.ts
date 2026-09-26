import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  ButtonGhostDirective,
  ButtonGhostSmallDirective,
  ButtonPrimaryDirective,
  ButtonPrimarySmallDirective,
  CardDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
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
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  interval,
  map,
  of,
  retry,
  switchMap,
  takeWhile,
} from 'rxjs';
import { CuratorService, LibraryQuery } from '../curator/curator.service';
import {
  GameSummaryResponse,
  LibraryGameResponse,
  LibraryRefreshResultSummary,
  LibraryRefreshStatusResponse,
  ProfileLibraryGameResponse,
  PsPlusRotationSummaryResponse,
  RefreshScheduleResponse,
  JobStatuses,
  LibraryEntrySources,
  LibraryHiddenFilters,
  LibrarySortField,
  LibrarySortFields,
  SortDirections,
  StoreSearchResultResponse,
  StoreUnavailableReasons,
  TrophyMatches,
  TrophyProgressResponse,
  TrophyProgressStates,
} from '../curator/curator.models';
import { RawgAttributionComponent } from '../app/shared/attribution/rawg-attribution.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { LIBRARY_PAGE_SIZE, ResolvedLibrary, hiddenCountOf, trophyProgressOf } from './library.resolver';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_PAGE_SIZE_CEILING,
  LIBRARY_PAGE_SIZE_KEY,
  libraryGenreFrom,
  libraryPageFrom,
  libraryPageSizeFrom,
  libraryQueryKey,
  librarySearchFrom,
  libraryShowsHiddenFrom,
  librarySortDescFrom,
  librarySortFrom,
} from './library.query';
import { nullIfEmpty } from '../shared/control-value';
import { SUMMARY_TITLE_DISPLAY_CAP } from './library-summary';
import { libraryHeaderId, libraryPlatformId, libraryRowId, librarySortArrowId, librarySortId } from './library-ids';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { PageSizeComponent } from '../shared/page-size/page-size.component';
import { CatalogMetaDirective, CatalogTitleDirective, SpineLabelDirective } from '../shared/primitives/typography';
import { pageSizeChoicesUpTo, readPageSize, writePageSize } from '../shared/page-size/page-size.preference';
import { AccountAnchors, AppUrls, RouteDataKeys, RouteParams } from '../app/app-paths';
import {
  ALL_GENRES_LABEL,
  EMPTY_OWN_LIBRARY_MESSAGE,
  EMPTY_VIEWED_LIBRARY_MESSAGE,
  LIBRARY_FORBIDDEN_MESSAGE,
  LIBRARY_LOAD_ERROR,
  PS_PLUS_NOT_WALKED_MESSAGE,
  REFRESH_JOB_LOST_ERROR,
  REFRESH_START_ERROR,
  STORE_MATCH_CATALOG_EMPTY_LEAD,
  TROPHY_PENDING_TITLE,
  TROPHY_PROGRESS_TITLES,
  TROPHY_UNMATCHED_TITLE,
  USER_LIBRARY_LOAD_ERROR,
  VIEWER_TROPHY_TITLE,
} from './library.messages';
import { PageTitles } from '../shared/page-title';
import { ResolvedStatuses } from '../shared/resolved-status';
import { ProviderNames } from '../shared/provider-names';
import { environment } from '../environments/environment';
import { statusCodeOf } from '../shared/http-status';

export { LIBRARY_PAGE_SIZE_CEILING, LIBRARY_PAGE_SIZE_KEY } from './library.query';

const TERMINAL_STATUSES = new Set<string>([JobStatuses.succeeded, JobStatuses.failed, JobStatuses.cancelled]);
const PAUSED_STATUSES = new Set<string>([JobStatuses.rateLimited]);
const KNOWN_STATUSES = new Set<string>([
  JobStatuses.queued,
  JobStatuses.running,
  JobStatuses.succeeded,
  JobStatuses.failed,
  JobStatuses.rateLimited,
  JobStatuses.cancelled,
]);

type LibraryGame = LibraryGameResponse | ProfileLibraryGameResponse;

interface LibraryRequest {
  viewerMode: boolean;
  sub: string | null;
  query: LibraryQuery;
}

interface LibraryLoadOutcome {
  games: LibraryGame[];
  total: number;
  trophyProgress: TrophyProgressResponse | null;
  hiddenCount: number;
  failure: 'forbidden' | 'failed' | null;
}

const LIBRARY_TABLE_FEATURES = tableFeatures({ rowSortingFeature, rowPaginationFeature });

const LIBRARY_COLUMNS: ColumnDef<typeof LIBRARY_TABLE_FEATURES, LibraryGame>[] = [
  { id: 'cover', header: 'Cover', enableSorting: false },
  { id: LibrarySortFields.title, accessorKey: 'title', header: 'Title' },
  { id: 'platforms', accessorKey: 'platforms', header: 'Platforms', enableSorting: false },
  { id: LibrarySortFields.genre, accessorKey: 'genre', header: 'Genre', sortDescFirst: false },
  { id: LibrarySortFields.rawgRating, accessorKey: 'rawg_rating', header: 'RAWG' },
  { id: LibrarySortFields.opencriticRating, accessorKey: 'opencritic_rating', header: ProviderNames.openCritic },
  { id: LibrarySortFields.psnRating, accessorKey: 'psn_rating', header: 'PS Store' },
  { id: LibrarySortFields.percentCompleted, accessorKey: 'percent_completed', header: '% Completed' },
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
    PageSectionDirective,
    CardDirective,
    ButtonPrimaryDirective,
    ButtonPrimarySmallDirective,
    ButtonGhostDirective,
    ButtonGhostSmallDirective,
    CatalogMetaDirective,
    CatalogTitleDirective,
    SpineLabelDirective,
  ],
  templateUrl: './library.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  protected readonly appUrls = AppUrls;
  protected readonly libraryRowId = libraryRowId;
  protected readonly libraryPlatformId = libraryPlatformId;
  protected readonly libraryHeaderId = libraryHeaderId;
  protected readonly librarySortId = librarySortId;
  protected readonly librarySortArrowId = librarySortArrowId;
  protected readonly accountAnchors = AccountAnchors;
  protected readonly forbiddenMessage = LIBRARY_FORBIDDEN_MESSAGE;
  protected readonly emptyOwnLibraryMessage = EMPTY_OWN_LIBRARY_MESSAGE;
  protected readonly emptyViewedLibraryMessage = EMPTY_VIEWED_LIBRARY_MESSAGE;
  protected readonly allGenresLabel = ALL_GENRES_LABEL;
  protected readonly psPlusNotWalkedMessage = PS_PLUS_NOT_WALKED_MESSAGE;
  protected readonly storeMatchCatalogEmptyLead = STORE_MATCH_CATALOG_EMPTY_LEAD;
  protected readonly jobStatuses = JobStatuses;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private loadedKey = libraryQueryKey({}, LIBRARY_PAGE_SIZE);
  private pollSubscription: Subscription | null = null;
  private readonly searchCommit = new Subject<string>();
  private searchCommitSubscription: Subscription | null = null;
  private readonly libraryRequests = new Subject<LibraryRequest>();
  private libraryRequestSubscription: Subscription | null = null;
  @ViewChild('storeMatchDialog') private storeMatchDialog?: ElementRef<HTMLDialogElement>;

  protected readonly viewerMode = signal(false);
  protected readonly viewerForbidden = signal(false);
  protected readonly sub = signal<string | null>(null);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);

  protected readonly schedule = signal<RefreshScheduleResponse | null>(null);
  protected readonly psPlus = signal<PsPlusRotationSummaryResponse | null>(null);
  protected readonly trophyProgress = signal<TrophyProgressResponse | null>(null);
  protected readonly trophyLinkNeeded = computed(() => !this.viewerMode() && this.trophyProgress()?.state === TrophyProgressStates.off);
  protected readonly hiddenCount = signal(0);
  protected readonly showingHidden = signal(false);
  protected readonly hidePending = signal<string | null>(null);

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

  protected readonly searchInput = signal<string | null>(null);
  protected readonly committedSearch = signal<string | null>(null);
  protected readonly genreFilter = signal<string | null>(null);
  protected readonly genreOptions = signal<string[]>([]);

  protected readonly addingManual = signal(false);
  protected readonly manualSearch = signal('');
  protected readonly manualResults = signal<GameSummaryResponse[]>([]);
  protected readonly manualSearching = signal(false);
  protected readonly manualPending = signal<string | null>(null);
  protected readonly manualError = signal<string | null>(null);

  protected readonly allCatalogMatchesOwned = signal(false);
  protected readonly manualAdded = signal<string | null>(null);

  protected readonly storeCandidates = signal<StoreSearchResultResponse[]>([]);
  protected readonly catalogAnsweredTheTerm = computed(
    () => this.manualResults().length > 0 || this.allCatalogMatchesOwned(),
  );
  protected readonly storeQuery = signal<string | null>(null);
  protected readonly storeUnlinked = signal(false);
  protected readonly storeMatchError = signal<string | null>(null);

  private readonly routeParams = signal<Params>({});

  protected readonly sorting = computed<SortingState>(() => [
    { id: librarySortFrom(this.routeParams()), desc: librarySortDescFrom(this.routeParams()) },
  ]);

  protected readonly pagination = computed<PaginationState>(() => ({
    pageIndex: libraryPageFrom(this.routeParams()) - 1,
    pageSize: libraryPageSizeFrom(this.routeParams(), LIBRARY_PAGE_SIZE),
  }));

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
      const next = typeof updater === 'function' ? updater(this.sorting()) : updater;
      const first = next[0];
      this.writeListStateToUrl({
        sort: !first || first.id === DEFAULT_LIBRARY_SORT ? null : first.id,
        sortDir: first?.desc ? SortDirections.desc : null,
      });
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(this.pagination()) : updater;
      this.writeListStateToUrl({ page: next.pageIndex === 0 ? null : next.pageIndex + 1 }, false);
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
    return current
      ? `${current.id}:${current.desc ? SortDirections.desc : SortDirections.asc}`
      : `${LibrarySortFields.title}:${SortDirections.asc}`;
  });

  ngOnInit(): void {
    this.libraryRequestSubscription = this.libraryRequests
      .pipe(switchMap((request) => this.libraryPageFor(request)))
      .subscribe((outcome) => this.applyLibraryOutcome(outcome));

    this.searchCommitSubscription = this.searchCommit
      .pipe(debounceTime(environment.librarySearchDebounceMs), distinctUntilChanged())
      .subscribe((value) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: value || null, page: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });

    const sub = this.route.snapshot.paramMap.get(RouteParams.sub);
    if (sub !== null) {
      this.viewerMode.set(true);
      this.sub.set(sub);
      this.breadcrumbItems.set([{ label: PageTitles.profile, link: [AppUrls.users, sub] }, { label: PageTitles.library }]);
    }

    const resolved = this.route.snapshot.data[RouteDataKeys.library] as ResolvedLibrary;
    if (resolved.status === ResolvedStatuses.forbidden) {
      this.viewerForbidden.set(true);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.gamesError.set(
        sub !== null ? USER_LIBRARY_LOAD_ERROR : LIBRARY_LOAD_ERROR,
      );
      return;
    }

    this.games.set(resolved.games);
    this.total.set(resolved.total);
    this.genreOptions.set(resolved.genres);
    this.schedule.set(resolved.schedule);
    this.trophyProgress.set(resolved.trophyProgress);
    this.hiddenCount.set(resolved.hiddenCount);
    this.psPlus.set(resolved.psPlus);

    this.watchQueryParams();
    this.seedPageSizeFromPreference();
  }

  protected setPageSize(size: number): void {
    writePageSize(LIBRARY_PAGE_SIZE_KEY, size);
    this.writeListStateToUrl({ pageSize: size === LIBRARY_PAGE_SIZE ? null : size });
  }

  protected pageParams(page: number): Params {
    return { page: page <= 1 ? null : page };
  }

  private writeListStateToUrl(queryParams: Params, resetPage = true): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: resetPage ? { ...queryParams, page: null } : queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private watchQueryParams(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.routeParams.set(params);
      const search = librarySearchFrom(params);
      this.committedSearch.set(search);
      if ((this.searchInput()?.trim() ?? null) !== search) {
        this.searchInput.set(search);
      }
      this.genreFilter.set(libraryGenreFrom(params));
      this.showingHidden.set(libraryShowsHiddenFrom(params));
      const key = libraryQueryKey(params, LIBRARY_PAGE_SIZE);
      if (key === this.loadedKey) {
        return;
      }
      this.loadedKey = key;
      this.reload();
    });
  }

  private seedPageSizeFromPreference(): void {
    if (this.route.snapshot.queryParams['pageSize'] !== undefined) {
      return;
    }
    const preferred = readPageSize(LIBRARY_PAGE_SIZE_KEY, this.pageSizeChoices, LIBRARY_PAGE_SIZE);
    if (preferred === LIBRARY_PAGE_SIZE) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pageSize: preferred },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.searchCommitSubscription?.unsubscribe();
    this.libraryRequestSubscription?.unsubscribe();
  }

  private currentQuery(): LibraryQuery {
    const sorting = this.sorting();
    const pagination = this.pagination();
    return {
      q: this.committedSearch() ?? undefined,
      genre: this.genreFilter() ?? undefined,
      sort: (sorting[0]?.id as LibrarySortField | undefined) ?? LibrarySortFields.title,
      sortDir: sorting[0]?.desc ? SortDirections.desc : SortDirections.asc,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      hidden: !this.viewerMode() && this.showingHidden() ? LibraryHiddenFilters.only : undefined,
    };
  }

  protected hiddenViewParams(): Params {
    return { hidden: this.showingHidden() ? null : LibraryHiddenFilters.only, page: null };
  }

  protected hideGame(game: LibraryGame): void {
    this.hidePending.set(game.game_id);
    this.gamesError.set(null);
    this.curator.hideLibraryGame(game.game_id).subscribe({
      next: () => {
        this.hidePending.set(null);
        this.reload();
      },
      error: () => {
        this.hidePending.set(null);
        this.gamesError.set(`Unable to hide ${game.title}.`);
      },
    });
  }

  protected unhideGame(game: LibraryGame): void {
    this.hidePending.set(game.game_id);
    this.gamesError.set(null);
    this.curator.unhideLibraryGame(game.game_id).subscribe({
      next: () => {
        this.hidePending.set(null);
        this.reload();
      },
      error: () => {
        this.hidePending.set(null);
        this.gamesError.set(`Unable to show ${game.title} again.`);
      },
    });
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
    return 'source' in game && game.source === LibraryEntrySources.manual;
  }

  protected toggleAddManual(): void {
    this.addingManual.update((open) => !open);
    this.manualSearch.set('');
    this.manualResults.set([]);
    this.manualError.set(null);
    this.manualAdded.set(null);
    this.storeUnlinked.set(false);
    this.allCatalogMatchesOwned.set(false);
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
    this.allCatalogMatchesOwned.set(false);
    this.askForCandidates(term, false);
  }

  protected checkTheStoreForCurrentSearch(): void {
    const term = this.manualSearch().trim();
    if (!term) {
      return;
    }
    this.manualSearching.set(true);
    this.manualError.set(null);
    this.askForCandidates(term, true);
  }

  private askForCandidates(term: string, includeStore: boolean): void {
    this.storeUnlinked.set(false);
    this.allCatalogMatchesOwned.set(false);
    this.curator.manualAddCandidates(term, includeStore, environment.libraryManualSearchLimit).subscribe({
      next: (answer) => {
        this.manualSearching.set(false);
        this.manualResults.set(answer.catalog);
        this.allCatalogMatchesOwned.set(answer.catalog.length === 0 && answer.already_owned > 0);
        this.storeUnlinked.set(answer.store_unavailable === StoreUnavailableReasons.noPsnLink);

        if (answer.store_unavailable === StoreUnavailableReasons.psnAuthFailed) {
          this.manualError.set('The PlayStation Store could not be checked — re-link your account.');
          return;
        }
        if (!answer.store_consulted) {
          return;
        }
        if (answer.store.length === 0) {
          this.manualError.set(`The PlayStation Store has nothing matching "${term}" either.`);
          return;
        }
        this.storeQuery.set(term);
        this.storeCandidates.set(answer.store);
        this.storeMatchError.set(null);
        this.openStoreMatch();
      },
      error: () => {
        this.manualSearching.set(false);
        this.manualResults.set([]);
        this.manualError.set('Unable to search for that game.');
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
    this.manualAdded.set(null);
    this.curator.addManualGame({ game_id: game.game_id }).subscribe({
      next: () => this.manualAddSucceeded(game.canonical_title),
      error: (err: HttpErrorResponse) => {
        this.manualPending.set(null);
        this.manualError.set(
          statusCodeOf(err) === HttpStatusCode.Conflict
            ? `${game.canonical_title} is already in your library from PlayStation Network.`
            : `Unable to add ${game.canonical_title}.`,
        );
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
    this.manualAdded.set(null);
    const addedTitle = candidate.name;
    this.curator.addManualGame({ store_hit: { query, id } }).subscribe({
      next: () => {
        this.closeStoreMatch();
        this.manualAddSucceeded(addedTitle);
      },
      error: (err: HttpErrorResponse) => {
        this.manualPending.set(null);
        this.storeMatchError.set(
          statusCodeOf(err) === HttpStatusCode.Conflict
            ? `${candidate.name} is already in your library from PlayStation Network.`
            : `Unable to add ${candidate.name}.`,
        );
      },
    });
  }

  private manualAddSucceeded(title: string | null): void {
    this.manualPending.set(null);
    this.addingManual.set(false);
    this.manualSearch.set('');
    this.manualResults.set([]);
    this.allCatalogMatchesOwned.set(false);
    this.manualAdded.set(title);
    this.reload();
  }

  protected removeManualGame(game: LibraryGame): void {
    this.manualPending.set(game.game_id);
    this.manualError.set(null);
    this.manualAdded.set(null);
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
    this.libraryRequests.next({ viewerMode, sub, query });
  }

  private libraryPageFor(request: LibraryRequest): Observable<LibraryLoadOutcome> {
    const page =
      request.viewerMode && request.sub !== null
        ? this.curator.getUserLibrary(request.sub, request.query)
        : this.curator.getLibrary(request.query);

    return page.pipe(
      map(
        (response): LibraryLoadOutcome => ({
          games: response.games,
          total: response.total,
          trophyProgress: trophyProgressOf(response),
          hiddenCount: hiddenCountOf(response),
          failure: null,
        }),
      ),
      catchError((err: HttpErrorResponse) =>
        of<LibraryLoadOutcome>({
          games: [],
          total: 0,
          trophyProgress: null,
          hiddenCount: 0,
          failure: request.viewerMode && statusCodeOf(err) === HttpStatusCode.Forbidden ? 'forbidden' : 'failed',
        }),
      ),
    );
  }

  private applyLibraryOutcome(outcome: LibraryLoadOutcome): void {
    this.gamesLoading.set(false);
    if (outcome.failure === 'forbidden') {
      this.viewerForbidden.set(true);
      return;
    }
    if (outcome.failure === 'failed') {
      this.gamesError.set(
        this.viewerMode() ? USER_LIBRARY_LOAD_ERROR : LIBRARY_LOAD_ERROR,
      );
      return;
    }
    this.games.set(outcome.games);
    this.total.set(outcome.total);
    if (!this.viewerMode()) {
      this.trophyProgress.set(outcome.trophyProgress);
      this.hiddenCount.set(outcome.hiddenCount);
    }
  }

  protected onSearchInput(value: string): void {
    this.searchInput.set(nullIfEmpty(value));
    this.searchCommit.next(value.trim());
  }

  protected onGenreFilterChange(value: string | null): void {
    this.writeListStateToUrl({ genre: value });
  }

  protected onMobileSortChange(value: string): void {
    const [id, dir] = value.split(':');
    this.writeListStateToUrl({ sort: id === DEFAULT_LIBRARY_SORT ? null : id, sortDir: dir === SortDirections.desc ? SortDirections.desc : null });
  }

  protected percentCompletedDisplay(percentCompleted: number | null): string {
    return percentCompleted === null ? '—' : `${percentCompleted}%`;
  }

  protected percentCompletedTitle(): string | undefined {
    if (this.viewerMode()) {
      return VIEWER_TROPHY_TITLE;
    }
    const progress = this.trophyProgress();
    if (progress === null || progress.state === TrophyProgressStates.on) {
      return undefined;
    }
    if (progress.state === TrophyProgressStates.pending) {
      return TROPHY_PENDING_TITLE;
    }
    return progress.reason === null ? undefined : TROPHY_PROGRESS_TITLES[progress.reason];
  }

  protected percentCompletedCellTitle(game: LibraryGame): string | undefined {
    if (!this.viewerMode() && 'trophy_match' in game && game.trophy_match === TrophyMatches.unmatched) {
      return TROPHY_UNMATCHED_TITLE;
    }
    return this.percentCompletedTitle();
  }

  protected headerLabel(header: Header<typeof LIBRARY_TABLE_FEATURES, LibraryGame, unknown>): string | null {
    if (header.isPlaceholder) {
      return null;
    }
    const label = header.column.columnDef.header;
    return typeof label === 'string' ? label : null;
  }

  protected headerSortParams(header: Header<typeof LIBRARY_TABLE_FEATURES, LibraryGame, unknown>): Params {
    const id = header.column.id;
    const descending = header.column.getIsSorted() === 'asc';
    return {
      sort: id === DEFAULT_LIBRARY_SORT ? null : id,
      sortDir: descending ? SortDirections.desc : null,
      page: null,
    };
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
        this.error.set(REFRESH_START_ERROR);
      },
    });
  }

  private startPolling(runId: string): void {
    if (!this.isBrowser) {
      this.refreshing.set(false);
      return;
    }

    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(environment.libraryPollIntervalMs)
      .pipe(
        switchMap(() => this.curator.getLibraryRefreshStatus(runId)),
        retry({ count: environment.libraryPollErrorRetryCount, delay: environment.libraryPollErrorRetryDelayMs, resetOnSuccess: true }),
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
          if (response.status === JobStatuses.succeeded) {
            if (libraryPageFrom(this.routeParams()) === 1) {
              this.reload();
            } else {
              this.writeListStateToUrl({});
            }
            this.loadGenres();
          }
        },
        error: () => {
          this.refreshing.set(false);
          this.error.set(REFRESH_JOB_LOST_ERROR);
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
