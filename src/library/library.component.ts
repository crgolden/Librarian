import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { LibraryRefreshStatusResponse } from '../curator/curator.models';

const POLL_INTERVAL_MS = 2500;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);

/** Trigger + poll only: `GET /library/refresh/{runId}` returns `{run_id, status, error}` and
 * nothing else — there is no endpoint that returns the caller's `library_entries`, so this page
 * cannot show "your library," only the state of a refresh job. */
@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrl: './library.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnDestroy {
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pollSubscription: Subscription | null = null;

  protected readonly refreshing = signal(false);
  protected readonly status = signal<LibraryRefreshStatusResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly unexpectedStatus = signal(false);

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
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
        },
        error: () => {
          this.refreshing.set(false);
          this.error.set('Lost track of the refresh job.');
        },
      });
  }
}
