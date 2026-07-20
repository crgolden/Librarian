import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { LibraryGameResponse, LibraryRefreshStatusResponse, ProfileLibraryGameResponse } from '../curator/curator.models';
import { redirectIfOwnSub } from '../profile/own-sub-redirect';

const POLL_INTERVAL_MS = 2500;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);
const SUMMARY_TITLE_DISPLAY_CAP = 10;

/** `/library` (owner) and `/library/:sub` (viewer, canonicalized away from your own sub).
 *
 * Owner mode: unchanged — trigger + poll a refresh job (`POST/GET /library/refresh[/{runId}]`), and
 * render the caller's own library (`GET /library`) as a table with per-provider (RAWG/OpenCritic)
 * enrichment checkmarks.
 *
 * Viewer mode: read-only render of another user's library (`GET /users/{sub}/library`) — no refresh
 * trigger. A 403 (someone typed the URL directly for a section the profile page wouldn't have linked)
 * renders an inline "this section isn't available" message instead of the table. */
@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrl: './library.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pollSubscription: Subscription | null = null;

  protected readonly viewerMode = signal(false);
  protected readonly viewerForbidden = signal(false);

  protected readonly refreshing = signal(false);
  protected readonly status = signal<LibraryRefreshStatusResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly unexpectedStatus = signal(false);

  protected readonly games = signal<(LibraryGameResponse | ProfileLibraryGameResponse)[] | null>(null);
  protected readonly gamesError = signal<string | null>(null);

  ngOnInit(): void {
    if (redirectIfOwnSub(this.route, this.router, this.auth, ['/library'])) {
      return;
    }

    const sub = this.route.snapshot.paramMap.get('sub');
    if (sub !== null) {
      this.viewerMode.set(true);
      this.loadViewerLibrary(sub);
    } else {
      this.loadLibrary();
    }
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

  private loadViewerLibrary(sub: string): void {
    this.gamesError.set(null);
    this.curator.getUserLibrary(sub).subscribe({
      next: (games) => this.games.set(games),
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.viewerForbidden.set(true);
        } else {
          this.gamesError.set("Unable to load this user's library.");
        }
      },
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
