import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { LibraryGameResponse, LibraryRefreshStatusResponse } from '../curator/curator.models';

const POLL_INTERVAL_MS = 2500;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);
const SUMMARY_TITLE_DISPLAY_CAP = 10;

/** Trigger + poll a refresh job (`POST/GET /library/refresh[/{runId}]`), and render the caller's own
 * library (`GET /library`) as a table with per-provider (RAWG/OpenCritic) enrichment checkmarks — works
 * identically for a user with zero enrichment keys configured (checks reflect titles already in the
 * shared cache) and a user with keys (checks fill in as their own quota resolves new titles). */
@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrl: './library.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pollSubscription: Subscription | null = null;

  protected readonly refreshing = signal(false);
  protected readonly status = signal<LibraryRefreshStatusResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly unexpectedStatus = signal(false);

  protected readonly games = signal<LibraryGameResponse[] | null>(null);
  protected readonly gamesError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadLibrary();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  private loadLibrary(): void {
    this.gamesError.set(null);
    this.curator.getLibrary().subscribe({
      next: (games) => this.games.set(games),
      error: () => this.gamesError.set('Unable to load your library.'),
    });
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
        takeWhile((response) => !TERMINAL_STATUSES.has(response.status) && KNOWN_STATUSES.has(response.status), true),
      )
      .subscribe({
        next: (response) => {
          this.status.set(response);
          if (!KNOWN_STATUSES.has(response.status)) {
            this.unexpectedStatus.set(true);
          }
          if (TERMINAL_STATUSES.has(response.status) || !KNOWN_STATUSES.has(response.status)) {
            this.refreshing.set(false);
          }
          if (response.status === 'succeeded') {
            this.loadLibrary();
          }
        },
        error: () => {
          this.refreshing.set(false);
          this.error.set('Lost track of the refresh job.');
        },
      });
  }
}
