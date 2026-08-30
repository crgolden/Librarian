import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, interval, retry, switchMap, takeWhile } from 'rxjs';
import { CuratorService } from '../curator/curator.service';
import { EnrichmentPassSummary, EnrichmentRunStatusResponse } from '../curator/curator.models';
import { ResolvedEnrichmentRun } from './admin-enrichment.resolver';

const POLL_INTERVAL_MS = 2500;
const POLL_ERROR_RETRY_COUNT = 3;
const POLL_ERROR_RETRY_DELAY_MS = 2000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const KNOWN_STATUSES = new Set(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

const PROCESSED_COUNT_KEY = 'enriched_count';
const REMAINING_COUNT_KEY = 'remaining_count';
const PROVIDER_GAIN_KEYS: readonly (readonly [key: string, label: string])[] = [
  ['rawg_enriched_count', 'RAWG'],
  ['opencritic_enriched_count', 'OpenCritic'],
  ['psn_enriched_count', 'PSN'],
];

export interface EnrichmentPassCounts {
  processed: number;
  remaining: number;
  providerGains: string;
  hasProviderGains: boolean;
  gainedAnything: boolean;
}

function countAt(pass: EnrichmentPassSummary, key: string): number | null {
  const value = pass[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readEnrichmentPassCounts(pass: EnrichmentPassSummary): EnrichmentPassCounts | null {
  const processed = countAt(pass, PROCESSED_COUNT_KEY);
  const remaining = countAt(pass, REMAINING_COUNT_KEY);
  if (processed === null || remaining === null) {
    return null;
  }

  const gains = PROVIDER_GAIN_KEYS.flatMap(([key, label]) => {
    const count = countAt(pass, key);
    return count === null ? [] : [{ label, count }];
  });

  return {
    processed,
    remaining,
    providerGains: gains.map((gain) => `${gain.label} ${gain.count}`).join(', '),
    hasProviderGains: gains.length > 0,
    gainedAnything: gains.some((gain) => gain.count > 0),
  };
}

@Component({
  selector: 'app-admin-enrichment',
  imports: [],
  templateUrl: './admin-enrichment.component.html',
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

  protected passCounts(pass: EnrichmentPassSummary): EnrichmentPassCounts | null {
    return readEnrichmentPassCounts(pass);
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
