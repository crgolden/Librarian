import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface MeResponse {
  sub: string;
  email: string | null;
  linked: boolean;
  psn: { access_token_expires_at: string | null; refresh_token_expires_at: string | null } | null;
}

@Component({
  selector: 'app-psn-settings',
  imports: [FormsModule, DatePipe],
  templateUrl: './psn-settings.component.html',
  styleUrl: './psn-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsnSettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly npsso = signal('');
  protected readonly linked = signal(false);
  protected readonly accessTokenExpiresAt = signal<string | null>(null);
  protected readonly refreshTokenExpiresAt = signal<string | null>(null);
  protected readonly loadingStatus = signal(true);
  protected readonly linking = signal(false);
  protected readonly unlinking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly noRefreshToken = computed(
    () => this.linked() && this.accessTokenExpiresAt() !== null && this.refreshTokenExpiresAt() === null,
  );

  ngOnInit(): void {
    this.loadStatus();
  }

  private loadStatus(): void {
    this.loadingStatus.set(true);
    this.error.set(null);
    this.http.get<MeResponse>('/curator/api/me').subscribe({
      next: (me) => {
        this.linked.set(me.linked);
        this.accessTokenExpiresAt.set(me.psn?.access_token_expires_at ?? null);
        this.refreshTokenExpiresAt.set(me.psn?.refresh_token_expires_at ?? null);
        this.loadingStatus.set(false);
      },
      error: () => {
        this.error.set('Unable to load PSN link status.');
        this.loadingStatus.set(false);
      },
    });
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
      error: () => {
        this.linking.set(false);
        this.error.set('Failed to link PlayStation Network account. Check your NPSSO token and try again.');
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
}
