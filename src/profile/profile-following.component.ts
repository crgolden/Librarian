import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { FollowListEntryResponse } from '../curator/curator.models';
import { redirectIfOwnSub } from './own-sub-redirect';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';

/** `/profile/following` (owner) and `/u/:sub/following` (viewer) — paginated list of the users the
 * profile owner follows, each entry linking to `/u/{sub}` (self-canonicalizes to `/profile` when the
 * entry is your own). Following lists are always visible, regardless of `is_public`. */
@Component({
  selector: 'app-profile-following',
  imports: [RouterLink, DatePipe, BreadcrumbComponent],
  templateUrl: './profile-following.component.html',
  styleUrl: './profile-following.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFollowingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);

  protected readonly entries = signal<FollowListEntryResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    if (redirectIfOwnSub(this.route, this.router, this.auth, ['/profile', 'following'])) {
      return;
    }

    const routeSub = this.route.snapshot.paramMap.get('sub');
    const sub = routeSub ?? this.auth.sub();
    if (sub === null) {
      this.loadError.set('Unable to determine the signed-in user.');
      this.loading.set(false);
      return;
    }

    this.breadcrumbItems.set([
      { label: 'Profile', link: routeSub ? ['/u', routeSub] : ['/profile'] },
      { label: 'Following' },
    ]);

    this.load(sub);
  }

  private load(sub: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.curator.getFollowing(sub).subscribe({
      next: (response) => {
        this.entries.set(response.entries);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load following.');
        this.loading.set(false);
      },
    });
  }
}
