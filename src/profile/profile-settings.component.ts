import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonGhostSmallDirective, CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { CuratorService } from '../curator/curator.service';
import {
  ProfileLinkResponse,
  ProfileLinkSiteResponse,
  ProfileSettingKeys,
  ProfileSettingsResponse,
} from '../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { ResolvedProfileSettings } from './profile-settings.resolver';
import { AppUrls, RouteDataKeys } from '../app/app-paths';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';
import { LINK_SAVE_ERROR, PROFILE_SETTINGS_LOAD_ERROR, SETTING_UPDATE_ERROR } from './profile.messages';
import { PageTitles } from '../shared/page-title';
import { ResolvedStatuses } from '../shared/resolved-status';

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

@Component({
  selector: 'app-profile-settings',
  imports: [FormsModule, RouterLink, BreadcrumbComponent, ButtonGhostSmallDirective, CardDirective, PageSectionDirective],
  templateUrl: './profile-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsComponent implements OnInit {
  protected readonly appUrls = AppUrls;
  protected readonly settingKeys = ProfileSettingKeys;

  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: PageTitles.profile, link: [AppUrls.profile] },
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
    this.meta.updateTag({ name: MetaNames.robots, content: RobotsDirectives.noIndexNoFollow });

    const resolved = this.route.snapshot.data[RouteDataKeys.settings] as ResolvedProfileSettings;
    if (resolved.status === ResolvedStatuses.error) {
      this.loadError.set(PROFILE_SETTINGS_LOAD_ERROR);
      return;
    }
    this.settings.set(resolved.settings);
    this.linkSites.set(resolved.sites);
    this.setLinks(resolved.links);
    this.handleDrafts.set(Object.fromEntries(resolved.links.map((link) => [link.site_key, link.handle])));
  }

  protected handleFor(siteKey: string): string | null {
    return this.handleDrafts()[siteKey] ?? null;
  }

  private trimmedHandleFor(siteKey: string): string | null {
    const draft = this.handleFor(siteKey);
    if (draft === null) {
      return null;
    }
    const trimmed = draft.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  protected linkFor(siteKey: string): ProfileLinkResponse | null {
    return this.links().find((link) => link.site_key === siteKey) ?? null;
  }

  protected onHandleInput(siteKey: string, value: string): void {
    this.handleDrafts.update((drafts) => ({ ...drafts, [siteKey]: value }));
  }

  protected isHandleValid(siteKey: string): boolean {
    const trimmed = this.trimmedHandleFor(siteKey);
    return trimmed !== null && HANDLE_PATTERN.test(trimmed);
  }

  protected isHandleUnchanged(siteKey: string): boolean {
    return this.trimmedHandleFor(siteKey) === (this.linkFor(siteKey)?.handle ?? null);
  }

  protected saveLink(siteKey: string): void {
    const handle = this.trimmedHandleFor(siteKey);
    if (handle === null || !HANDLE_PATTERN.test(handle)) {
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
        this.linkError.set(LINK_SAVE_ERROR);
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
        this.saveError.set(SETTING_UPDATE_ERROR);
      },
    });
  }
}
