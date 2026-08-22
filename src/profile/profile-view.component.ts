import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorArchive,
  phosphorBooks,
  phosphorLink,
  phosphorMedal,
  phosphorRanking,
  phosphorStamp,
  phosphorUserPlus,
  phosphorUsersThree,
} from '@ng-icons/phosphor-icons/regular';
import { CuratorService } from '../curator/curator.service';
import { PublicProfileResponse } from '../curator/curator.models';
import { ResolvedProfile } from './profile.resolver';
import { AvatarComponent } from '../shared/avatar/avatar.component';

@Component({
  selector: 'app-profile-view',
  imports: [DatePipe, NgIcon, RouterLink, AvatarComponent],
  templateUrl: './profile-view.component.html',
  styleUrl: './profile-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      phosphorArchive,
      phosphorBooks,
      phosphorLink,
      phosphorMedal,
      phosphorRanking,
      phosphorStamp,
      phosphorUserPlus,
      phosphorUsersThree,
    }),
  ],
})
export class ProfileViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);

  protected readonly profile = signal<PublicProfileResponse | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly followBusy = signal(false);
  protected readonly followError = signal<string | null>(null);

  protected readonly followersLink = signal<string[]>(['/profile', 'followers']);
  protected readonly followingLink = signal<string[]>(['/profile', 'following']);
  protected readonly libraryLink = signal<string[]>(['/library']);
  protected readonly collectionsLink = signal<string[]>(['/collections']);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    const routeSub = this.route.snapshot.paramMap.get('sub');
    if (routeSub !== null) {
      this.followersLink.set(['/u', routeSub, 'followers']);
      this.followingLink.set(['/u', routeSub, 'following']);
      this.libraryLink.set(['/library', routeSub]);
      this.collectionsLink.set(['/collections', routeSub]);
    }

    const resolved = this.route.snapshot.data['profile'] as ResolvedProfile;
    if (resolved.status === 'no-user') {
      this.loadError.set('Unable to determine the signed-in user.');
      return;
    }
    if (resolved.status === 'error') {
      this.loadError.set('Unable to load this profile.');
      return;
    }

    this.profile.set(resolved.profile);
  }

  protected displayName(profile: PublicProfileResponse): string {
    return profile.identity?.online_id ?? (profile.psn_account_id ? 'PlayStation account' : 'Unlinked user');
  }

  protected followerLabel(count: number): string {
    return count === 1 ? 'follower' : 'followers';
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
