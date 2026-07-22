import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CuratorService } from '../curator/curator.service';
import { ProfileSettingsResponse } from '../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';

/** `/profile/settings` — owner-only (no `:sub` variant; settings are inherently self-scoped). Five
 * optimistic-update toggles mirroring `PsnSettingsComponent.onToggle`'s revert-on-error pattern. */
@Component({
  selector: 'app-profile-settings',
  imports: [FormsModule, RouterLink, BreadcrumbComponent],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsComponent implements OnInit {
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);

  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Profile', link: ['/profile'] },
    { label: 'Settings' },
  ];

  protected readonly settings = signal<ProfileSettingsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal<keyof ProfileSettingsResponse | null>(null);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadSettings();
  }

  private loadSettings(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.curator.getProfileSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load profile settings.');
        this.loading.set(false);
      },
    });
  }

  protected onToggle(field: keyof ProfileSettingsResponse, newValue: boolean): void {
    const current = this.settings();
    if (!current) {
      return;
    }

    const previous = current[field];
    const next = { ...current, [field]: newValue };
    this.settings.set(next);
    this.saving.set(field);
    this.saveError.set(null);

    this.curator.setProfileSettings(next).subscribe({
      next: (response) => {
        this.settings.set(response);
        this.saving.set(null);
      },
      error: () => {
        const reverted = this.settings();
        if (reverted) {
          this.settings.set({ ...reverted, [field]: previous });
        }
        this.saving.set(null);
        this.saveError.set('Failed to update setting. Please try again.');
      },
    });
  }
}
