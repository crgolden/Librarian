import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CuratorService } from '../curator/curator.service';
import {
  DevicesResponse,
  IdentityResponse,
  PresenceResponse,
  PsnPreferencesResponse,
  TrophySummaryResponse,
} from '../curator/curator.models';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { PsnStatus } from './psn-status.resolver';

type MeResponse = PsnStatus;

const LINK_ERROR_MESSAGES: Record<string, string> = {
  mismatch:
    "The PlayStation Network account you linked doesn't match your account email. Sign into the PSN account that uses this same email, then try again.",
  unverified:
    "That PlayStation Network account's email address isn't verified. Verify it with PlayStation, then try linking again.",
};

const GENERIC_LINK_ERROR_MESSAGE =
  'Failed to link PlayStation Network account. Check your NPSSO token and try again.';

function linkErrorMessage(err: HttpErrorResponse): string {
  const code = (err.error as { detail?: { error?: string } } | null)?.detail?.error;
  return (code ? LINK_ERROR_MESSAGES[code] : undefined) ?? GENERIC_LINK_ERROR_MESSAGE;
}

@Component({
  selector: 'app-psn-settings',
  imports: [FormsModule, DatePipe, LoadingOverlayComponent, RouterLink],
  templateUrl: './psn-settings.component.html',
  styleUrl: './psn-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsnSettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly curator = inject(CuratorService);

  protected readonly npsso = signal('');
  protected readonly linked = signal(false);
  protected readonly accessTokenExpiresAt = signal<string | null>(null);
  protected readonly refreshTokenExpiresAt = signal<string | null>(null);
  protected readonly loadingStatus = signal(false);
  protected readonly linking = signal(false);
  protected readonly unlinking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly confirmingDelete = signal(false);
  protected readonly deletingAccount = signal(false);
  protected readonly deleted = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly preferences = signal<PsnPreferencesResponse | null>(null);
  protected readonly preferencesError = signal<string | null>(null);
  protected readonly savingPreference = signal<keyof PsnPreferencesResponse | null>(null);

  protected readonly trophySummary = signal<TrophySummaryResponse | null>(null);
  protected readonly trophySummaryLoading = signal(false);
  protected readonly trophySummaryError = signal<string | null>(null);

  protected readonly identity = signal<IdentityResponse | null>(null);
  protected readonly identityLoading = signal(false);
  protected readonly identityError = signal<string | null>(null);

  protected readonly presence = signal<PresenceResponse | null>(null);
  protected readonly presenceLoading = signal(false);
  protected readonly presenceError = signal<string | null>(null);

  protected readonly devices = signal<DevicesResponse | null>(null);
  protected readonly devicesLoading = signal(false);
  protected readonly devicesError = signal<string | null>(null);

  protected readonly noRefreshToken = computed(
    () => this.linked() && this.accessTokenExpiresAt() !== null && this.refreshTokenExpiresAt() === null,
  );

  protected readonly overlayVisible = computed(
    () =>
      this.loadingStatus() ||
      this.linking() ||
      this.unlinking() ||
      this.deletingAccount() ||
      this.savingPreference() !== null,
  );

  ngOnInit(): void {
    const status = this.route.snapshot.data['status'] as MeResponse | null;
    if (status === null) {
      this.error.set('Unable to load PSN link status.');
      return;
    }
    this.applyStatus(status);
  }

  private applyStatus(me: MeResponse): void {
    this.linked.set(me.linked);
    this.accessTokenExpiresAt.set(me.psn?.access_token_expires_at ?? null);
    this.refreshTokenExpiresAt.set(me.psn?.refresh_token_expires_at ?? null);
    if (me.linked) {
      this.loadPreferences();
    }
  }

  private loadStatus(): void {
    this.loadingStatus.set(true);
    this.error.set(null);
    this.http.get<MeResponse>('/curator/api/me').subscribe({
      next: (me) => {
        this.applyStatus(me);
        this.loadingStatus.set(false);
      },
      error: () => {
        this.error.set('Unable to load PSN link status.');
        this.loadingStatus.set(false);
      },
    });
  }

  private loadPreferences(): void {
    this.preferencesError.set(null);
    this.curator.getPsnPreferences().subscribe({
      next: (prefs) => {
        this.preferences.set(prefs);
        if (prefs.harvest_trophies) {
          this.loadTrophySummary();
        }
        if (prefs.harvest_identity) {
          this.loadIdentity();
        }
        if (prefs.harvest_presence) {
          this.loadPresence();
        }
        if (prefs.harvest_devices) {
          this.loadDevices();
        }
      },
      error: () => {
        // No PSN link (unexpected here since linked() is already true) — leave preferences null
        // so no category UI renders rather than surfacing a confusing error.
        this.preferences.set(null);
      },
    });
  }

  private loadTrophySummary(): void {
    this.trophySummaryLoading.set(true);
    this.trophySummaryError.set(null);
    this.curator.getTrophySummary().subscribe({
      next: (summary) => {
        this.trophySummary.set(summary);
        this.trophySummaryLoading.set(false);
      },
      error: () => {
        this.trophySummaryError.set('Unable to load trophy summary.');
        this.trophySummaryLoading.set(false);
      },
    });
  }

  private loadIdentity(): void {
    this.identityLoading.set(true);
    this.identityError.set(null);
    this.curator.getIdentity().subscribe({
      next: (identity) => {
        this.identity.set(identity);
        this.identityLoading.set(false);
      },
      error: () => {
        this.identityError.set('Unable to load PSN identity.');
        this.identityLoading.set(false);
      },
    });
  }

  private loadPresence(): void {
    this.presenceLoading.set(true);
    this.presenceError.set(null);
    this.curator.getPresence().subscribe({
      next: (presence) => {
        this.presence.set(presence);
        this.presenceLoading.set(false);
      },
      error: () => {
        this.presenceError.set('Unable to load online presence.');
        this.presenceLoading.set(false);
      },
    });
  }

  private loadDevices(): void {
    this.devicesLoading.set(true);
    this.devicesError.set(null);
    this.curator.getDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.devicesLoading.set(false);
      },
      error: () => {
        this.devicesError.set('Unable to load registered devices.');
        this.devicesLoading.set(false);
      },
    });
  }

  protected onToggle(category: keyof PsnPreferencesResponse, newValue: boolean): void {
    const current = this.preferences();
    if (!current) {
      return;
    }

    const previous = current[category];
    this.preferences.set({ ...current, [category]: newValue });
    this.savingPreference.set(category);
    this.preferencesError.set(null);

    this.curator.setPsnPreferences({ ...current, [category]: newValue }).subscribe({
      next: () => {
        this.savingPreference.set(null);
        if (newValue) {
          this.loadForCategory(category);
        } else {
          this.clearForCategory(category);
        }
      },
      error: () => {
        const reverted = this.preferences();
        if (reverted) {
          this.preferences.set({ ...reverted, [category]: previous });
        }
        this.savingPreference.set(null);
        this.preferencesError.set('Failed to update preference. Please try again.');
      },
    });
  }

  private loadForCategory(category: keyof PsnPreferencesResponse): void {
    switch (category) {
      case 'harvest_trophies':
        this.loadTrophySummary();
        break;
      case 'harvest_identity':
        this.loadIdentity();
        break;
      case 'harvest_presence':
        this.loadPresence();
        break;
      case 'harvest_devices':
        this.loadDevices();
        break;
    }
  }

  private clearForCategory(category: keyof PsnPreferencesResponse): void {
    switch (category) {
      case 'harvest_trophies':
        this.trophySummary.set(null);
        break;
      case 'harvest_identity':
        this.identity.set(null);
        break;
      case 'harvest_presence':
        this.presence.set(null);
        break;
      case 'harvest_devices':
        this.devices.set(null);
        break;
    }
  }

  protected trophiesEarnedTotal(summary: TrophySummaryResponse): number {
    const { bronze, silver, gold, platinum } = summary.earned;
    return bronze + silver + gold + platinum;
  }

  protected link(): void {
    const token = this.npsso().trim();
    if (!token) {
      this.error.set('Enter your NPSSO token.');
      return;
    }

    this.linking.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post('/curator/api/psn/link', { npsso: token }).subscribe({
      next: () => {
        this.linking.set(false);
        this.success.set('PlayStation Network account linked.');
        this.npsso.set('');
        this.loadStatus();
      },
      error: (err: HttpErrorResponse) => {
        this.linking.set(false);
        this.error.set(linkErrorMessage(err));
      },
    });
  }

  protected unlink(): void {
    this.unlinking.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.delete('/curator/api/psn/link').subscribe({
      next: () => {
        this.unlinking.set(false);
        this.success.set('PlayStation Network account unlinked.');
        this.loadStatus();
      },
      error: () => {
        this.unlinking.set(false);
        this.error.set('Failed to unlink PlayStation Network account.');
      },
    });
  }

  protected requestDeleteMyData(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDeleteMyData(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDeleteMyData(): void {
    this.deletingAccount.set(true);
    this.deleteError.set(null);

    this.http.delete('/curator/api/me').subscribe({
      next: () => {
        this.deletingAccount.set(false);
        this.confirmingDelete.set(false);
        this.deleted.set(true);
      },
      error: () => {
        this.deletingAccount.set(false);
        this.deleteError.set('Failed to delete your account. Please try again.');
      },
    });
  }
}
