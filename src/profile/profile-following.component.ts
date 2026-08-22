import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FollowListEntryResponse } from '../curator/curator.models';
import { ResolvedFollowList } from './follow-list.resolver';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';

/** `/profile/following` (owner) and `/u/:sub/following` (viewer) — paginated list of the users the
 * profile owner follows, each entry linking to `/u/{sub}` (self-canonicalizes to `/profile` when the
 * entry is your own). Following lists are always visible, regardless of `is_public`. */
@Component({
  selector: 'app-profile-following',
  imports: [RouterLink, DatePipe, BreadcrumbComponent, AvatarComponent],
  templateUrl: './profile-following.component.html',
  styleUrl: './profile-following.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFollowingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  protected readonly entries = signal<FollowListEntryResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly loadError = signal<string | null>(null);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    const routeSub = this.route.snapshot.paramMap.get('sub');
    this.breadcrumbItems.set([
      { label: 'Profile', link: routeSub ? ['/u', routeSub] : ['/profile'] },
      { label: 'Following' },
    ]);

    const resolved = this.route.snapshot.data['following'] as ResolvedFollowList;
    if (resolved.status === 'no-user') {
      this.loadError.set('Unable to determine the signed-in user.');
      return;
    }
    if (resolved.status === 'error') {
      this.loadError.set('Unable to load following.');
      return;
    }

    this.entries.set(resolved.entries);
    this.total.set(resolved.total);
  }
}
