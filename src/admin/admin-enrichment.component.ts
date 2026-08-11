import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, interval, retry, switchMap, takeWhile } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { EnrichmentRunStatusResponse } from '../curator/curator.models';
import { ResolvedEnrichmentRun } from './admin-enrichment.resolver';

const POLL_INTERVAL_MS = 2500;
const POLL_ERROR_RETRY_COUNT = 3;
const POLL_ERROR_RETRY_DELAY_MS = 2000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed']);

/** `/admin/enrichment` -- admin-gated (`authGuard` + `adminGuard`). Triggers and polls
 * `POST/GET /enrichment/runs[/latest|/{run_id}]`: a global catalog-wide re-enrichment pass (OpenCritic
 * cache refresh, franchise/tier reclassification, best-effort full enrichment for unenriched games).
 *
 * Mirrors `psn-settings.component.ts`'s two-step confirm pattern (this spends real provider quota and
 * rewrites catalog data, same class of action as "Delete my data") and `library.component.ts`'s exact
 * polling mechanism (interval + retry + takeWhile), reused as-is since enrichment-run jobs share the
 * same status vocabulary. */
@Component({
  selector: 'app-admin-enrichment',
  imports: [],
  templateUrl: './admin-enrichment.component.html',
  styleUrl: './admin-enrichment.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEnrichmentComponent implements OnInit, OnDestroy {
  private readonly curator = inject(CuratorService);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly loadError = signal<string | null>(null);
  protected readonly run = signal<EnrichmentRunStatusResponse | null>(null);

  protected readonly confirming = signal(false);
  protected readonly starting = signal(false);
  protected readonly startError = signal<string | null>(null);

  private pollSubscription: Subscription | null = null;

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['latestRun'] as ResolvedEnrichmentRun;
    if (resolved.status === 'error') {
      this.loadError.set('Unable to load the latest enrichment run.');
      return;
    }
    if (resolved.status === 'ok') {
      this.run.set(resolved.run);
    }
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  protected requestRun(): void {
    this.confirming.set(true);
  }

  protected cancelRun(): void {
    this.confirming.set(false);
  }

  protected confirmRun(): void {
    this.starting.set(true);
    this.startError.set(null);

    this.curator.startEnrichmentRun().subscribe({
      next: ({ run_id }) => {
        this.starting.set(false);
        this.confirming.set(false);
        this.startPolling(run_id);
      },
      error: () => {
        this.starting.set(false);
        this.startError.set('Unable to start an enrichment run.');
      },
    });
  }

  private startPolling(runId: string): void {
    if (!this.isBrowser) {
      return;
    }

    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.curator.getEnrichmentRunStatus(runId)),
        retry({ count: POLL_ERROR_RETRY_COUNT, delay: POLL_ERROR_RETRY_DELAY_MS, resetOnSuccess: true }),
        takeWhile((response) => !TERMINAL_STATUSES.has(response.status) && KNOWN_STATUSES.has(response.status), true),
      )
      .subscribe({
        next: (response) => this.run.set(response),
        error: () => this.startError.set('Lost track of the enrichment run.'),
      });
  }
}
