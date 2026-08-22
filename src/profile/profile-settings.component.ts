import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CuratorService } from '../curator/curator.service';
import { ProfileLinkResponse, ProfileLinkSiteResponse, ProfileSettingsResponse } from '../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { ResolvedProfileSettings } from './profile-settings.resolver';

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

/** `/profile/settings` — owner-only (no `:sub` variant; settings are inherently self-scoped). The
 * visibility toggles update optimistically and revert on error; the profile links commit on save. */
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
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Profile', link: ['/profile'] },
    { label: 'Settings' },
  ];

  protected readonly settings = signal<ProfileSettingsResponse | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal<keyof ProfileSettingsResponse | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly linkSites = signal<ProfileLinkSiteResponse[]>([]);
  protected readonly links = signal<ProfileLinkResponse[]>([]);
  protected readonly savingLink = signal<string | null>(null);
  protected readonly linkError = signal<string | null>(null);
  protected readonly handleDrafts = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    const resolved = this.route.snapshot.data['settings'] as ResolvedProfileSettings;
    if (resolved.status === 'error') {
      this.loadError.set('Unable to load profile settings.');
      return;
    }
    this.settings.set(resolved.settings);
    this.linkSites.set(resolved.sites);
    this.setLinks(resolved.links);
    this.handleDrafts.set(Object.fromEntries(resolved.links.map((link) => [link.site_key, link.handle])));
  }

  protected handleFor(siteKey: string): string {
    return this.handleDrafts()[siteKey] ?? '';
  }

  protected linkFor(siteKey: string): ProfileLinkResponse | null {
    return this.links().find((link) => link.site_key === siteKey) ?? null;
  }

  protected onHandleInput(siteKey: string, value: string): void {
    this.handleDrafts.update((drafts) => ({ ...drafts, [siteKey]: value }));
  }

  protected isHandleValid(siteKey: string): boolean {
    return HANDLE_PATTERN.test(this.handleFor(siteKey).trim());
  }

  protected isHandleUnchanged(siteKey: string): boolean {
    return this.handleFor(siteKey).trim() === (this.linkFor(siteKey)?.handle ?? '');
  }

  protected saveLink(siteKey: string): void {
    const handle = this.handleFor(siteKey).trim();
    if (!HANDLE_PATTERN.test(handle)) {
      return;
    }

    this.savingLink.set(siteKey);
    this.linkError.set(null);
    this.curator.setProfileLink(siteKey, handle).subscribe({
      next: (saved) => {
        this.setLinks([...this.links().filter((link) => link.site_key !== siteKey), saved]);
        this.onHandleInput(siteKey, saved.handle);
        this.savingLink.set(null);
      },
      error: () => {
        this.savingLink.set(null);
        this.linkError.set('Failed to save the link. Please try again.');
      },
    });
  }

  protected removeLink(siteKey: string): void {
    this.savingLink.set(siteKey);
    this.linkError.set(null);
    this.curator.deleteProfileLink(siteKey).subscribe({
      next: () => {
        this.setLinks(this.links().filter((link) => link.site_key !== siteKey));
        this.onHandleInput(siteKey, '');
        this.savingLink.set(null);
      },
      error: () => {
        this.savingLink.set(null);
        this.linkError.set('Failed to remove the link. Please try again.');
      },
    });
  }

  private setLinks(links: ProfileLinkResponse[]): void {
    const ordered = this.linkSites().map((site) => links.find((link) => link.site_key === site.site_key));
    this.links.set(ordered.filter((link): link is ProfileLinkResponse => link !== undefined));
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
