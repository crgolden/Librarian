import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { FollowListEntryResponse } from '../curator/curator.models';
import { ResolvedFollowList } from './follow-list.resolver';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { CatalogMetaDirective } from '../shared/primitives/typography';
import { AppUrls, RouteDataKeys, RouteParams } from '../app/app-paths';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';
import { FOLLOWERS_LOAD_ERROR, SIGNED_IN_USER_UNKNOWN_ERROR, UNLINKED_USER_NAME } from './profile.messages';
import { PageTitles } from '../shared/page-title';
import { ResolvedStatuses } from '../shared/resolved-status';

@Component({
  selector: 'app-profile-followers',
  imports: [RouterLink, DatePipe, BreadcrumbComponent, AvatarComponent, CardDirective, PageSectionDirective, CatalogMetaDirective],
  templateUrl: './profile-followers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFollowersComponent implements OnInit {
  protected readonly appUrls = AppUrls;
  protected readonly unlinkedUserName = UNLINKED_USER_NAME;

  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  protected readonly entries = signal<FollowListEntryResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly loadError = signal<string | null>(null);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    this.meta.updateTag({ name: MetaNames.robots, content: RobotsDirectives.noIndexNoFollow });

    const routeSub = this.route.snapshot.paramMap.get(RouteParams.sub);
    this.breadcrumbItems.set([
      { label: PageTitles.profile, link: routeSub ? [AppUrls.users, routeSub] : [AppUrls.profile] },
      { label: PageTitles.followers },
    ]);

    const resolved = this.route.snapshot.data[RouteDataKeys.followers] as ResolvedFollowList;
    if (resolved.status === ResolvedStatuses.noUser) {
      this.loadError.set(SIGNED_IN_USER_UNKNOWN_ERROR);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.loadError.set(FOLLOWERS_LOAD_ERROR);
      return;
    }

    this.entries.set(resolved.entries);
    this.total.set(resolved.total);
  }
}
