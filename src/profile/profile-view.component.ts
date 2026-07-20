import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PublicProfileResponse } from '../curator/curator.models';
import { redirectIfOwnSub } from './own-sub-redirect';

/** `/profile` (owner) and `/u/:sub` (viewer, canonicalized away from your own sub) — renders the
 * PSN account id (or "Unlinked user"), a Follow/Unfollow button (hidden for the owner), follower/
 * following counts linking to the followers/following pages, library/collections links (gated on
 * visibility for viewer mode, always shown for the owner), a trophy card, and an identity card. */
@Component({
  selector: 'app-profile-view',
  imports: [RouterLink],
  templateUrl: './profile-view.component.html',
  styleUrl: './profile-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);

  protected readonly profile = signal<PublicProfileResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly followBusy = signal(false);
  protected readonly followError = signal<string | null>(null);

  protected readonly followersLink = signal<string[]>(['/profile', 'followers']);
  protected readonly followingLink = signal<string[]>(['/profile', 'following']);
  protected readonly libraryLink = signal<string[]>(['/library']);
  protected readonly collectionsLink = signal<string[]>(['/collections']);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    if (redirectIfOwnSub(this.route, this.router, this.auth, ['/profile'])) {
      return;
    }

    const routeSub = this.route.snapshot.paramMap.get('sub');
    const sub = routeSub ?? this.auth.sub();
    if (sub === null) {
      this.loadError.set('Unable to determine the signed-in user.');
      this.loading.set(false);
      return;
    }

    if (routeSub !== null) {
      this.followersLink.set(['/u', routeSub, 'followers']);
      this.followingLink.set(['/u', routeSub, 'following']);
      this.libraryLink.set(['/library', routeSub]);
      this.collectionsLink.set(['/collections', routeSub]);
    }

    this.loadProfile(sub);
  }

  private loadProfile(sub: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.curator.getUserProfile(sub).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Unable to load this profile.');
        this.loading.set(false);
      },
    });
  }

  protected trophiesEarnedTotal(profile: PublicProfileResponse): number {
    const earned = profile.trophies?.earned;
    if (!earned) {
      return 0;
    }
    return earned.bronze + earned.silver + earned.gold + earned.platinum;
  }

  protected follow(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    this.followBusy.set(true);
    this.followError.set(null);
    this.curator.followUser(profile.sub).subscribe({
      next: () => {
        this.followBusy.set(false);
        this.profile.set({
          ...profile,
          viewer_is_following: true,
          follower_count: profile.follower_count + 1,
        });
      },
      error: () => {
        this.followBusy.set(false);
        this.followError.set('Unable to follow this user.');
      },
    });
  }

  protected unfollow(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    this.followBusy.set(true);
    this.followError.set(null);
    this.curator.unfollowUser(profile.sub).subscribe({
      next: () => {
        this.followBusy.set(false);
        this.profile.set({
          ...profile,
          viewer_is_following: false,
          follower_count: Math.max(0, profile.follower_count - 1),
        });
      },
      error: () => {
        this.followBusy.set(false);
        this.followError.set('Unable to unfollow this user.');
      },
    });
  }
}
