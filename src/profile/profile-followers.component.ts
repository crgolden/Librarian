import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FollowListEntryResponse } from '../curator/curator.models';
import { ResolvedFollowList } from './follow-list.resolver';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';

/** `/profile/followers` (owner) and `/u/:sub/followers` (viewer) — paginated list of the users
 * following the profile owner, each entry linking to `/u/{sub}` (self-canonicalizes to `/profile`
 * when the entry is your own). Follower lists are always visible, regardless of `is_public`. */
@Component({
  selector: 'app-profile-followers',
  imports: [RouterLink, DatePipe, BreadcrumbComponent],
  templateUrl: './profile-followers.component.html',
  styleUrl: './profile-followers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFollowersComponent implements OnInit {
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
      { label: 'Followers' },
    ]);

    const resolved = this.route.snapshot.data['followers'] as ResolvedFollowList;
    if (resolved.status === 'no-user') {
      this.loadError.set('Unable to determine the signed-in user.');
      return;
    }
    if (resolved.status === 'error') {
      this.loadError.set('Unable to load followers.');
      return;
    }

    this.entries.set(resolved.entries);
    this.total.set(resolved.total);
  }
}
