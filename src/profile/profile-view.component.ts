import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonGhostDirective, ButtonPrimaryDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFolderOpen,
  lucideLibraryBig,
  lucideLink,
  lucideMedal,
  lucideStamp,
  lucideTrophy,
  lucideUserPlus,
  lucideUsers,
} from '@ng-icons/lucide';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PublicProfileResponse } from '../curator/curator.models';
import { ResolvedProfile } from './profile.resolver';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { CatalogMetaDirective, StampLabelDirective } from '../shared/primitives/typography';
import { AppUrls, FollowListKinds, RouteDataKeys, RouteParams } from '../app/app-paths';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';
import {
  FOLLOW_USER_ERROR,
  FRIEND_REQUEST_ERROR,
  PROFILE_LOAD_ERROR,
  PSN_ACCOUNT_FALLBACK_NAME,
  SIGNED_IN_USER_UNKNOWN_ERROR,
  TROPHIES_OFF_NOTICE,
  UNLINKED_USER_NAME,
  followersAccessibleName,
  followingAccessibleName,
} from './profile.messages';
import { ResolvedStatuses } from '../shared/resolved-status';

@Component({
  selector: 'app-profile-view',
  imports: [
    DatePipe,
    NgIcon,
    RouterLink,
    AvatarComponent,
    ButtonGhostDirective,
    ButtonPrimaryDirective,
    PageSectionDirective,
    CatalogMetaDirective,
    StampLabelDirective,
  ],
  templateUrl: './profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideFolderOpen,
      lucideLibraryBig,
      lucideLink,
      lucideMedal,
      lucideStamp,
      lucideTrophy,
      lucideUserPlus,
      lucideUsers,
    }),
  ],
})
export class ProfileViewComponent implements OnInit {
  protected readonly appUrls = AppUrls;
  protected readonly trophiesOffNotice = TROPHIES_OFF_NOTICE;

  private readonly route = inject(ActivatedRoute);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);
  protected readonly auth = inject(AuthService);

  protected ownPictureFor(profile: PublicProfileResponse): string | null {
    return profile.viewer_is_owner ? this.auth.picture() : null;
  }

  protected readonly profile = signal<PublicProfileResponse | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly followBusy = signal(false);
  protected readonly followError = signal<string | null>(null);

  protected readonly viewerMayAddFriend = signal(false);
  protected readonly confirmingFriendRequest = signal(false);
  protected readonly friendRequestBusy = signal(false);
  protected readonly friendRequestSent = signal(false);
  protected readonly friendRequestError = signal<string | null>(null);

  protected readonly followersLink = signal<string[]>([AppUrls.profile, FollowListKinds.followers]);
  protected readonly followingLink = signal<string[]>([AppUrls.profile, FollowListKinds.following]);
  protected readonly libraryLink = signal<string[]>([AppUrls.library]);
  protected readonly collectionsLink = signal<string[]>([AppUrls.collections]);

  ngOnInit(): void {
    this.meta.updateTag({ name: MetaNames.robots, content: RobotsDirectives.noIndexNoFollow });

    const routeSub = this.route.snapshot.paramMap.get(RouteParams.sub);
    if (routeSub !== null) {
      this.followersLink.set([AppUrls.users, routeSub, FollowListKinds.followers]);
      this.followingLink.set([AppUrls.users, routeSub, FollowListKinds.following]);
      this.libraryLink.set([AppUrls.library, routeSub]);
      this.collectionsLink.set([AppUrls.collections, routeSub]);
    }

    const resolved = this.route.snapshot.data[RouteDataKeys.profile] as ResolvedProfile;
    if (resolved.status === ResolvedStatuses.noUser) {
      this.loadError.set(SIGNED_IN_USER_UNKNOWN_ERROR);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.loadError.set(PROFILE_LOAD_ERROR);
      return;
    }

    this.profile.set(resolved.profile);
    this.viewerMayAddFriend.set(
      !resolved.profile.viewer_is_owner &&
        resolved.profile.identity?.online_id !== undefined &&
        resolved.viewerPreferences?.allow_friend_writes === true,
    );
  }

  protected startFriendRequest(): void {
    this.confirmingFriendRequest.set(true);
    this.friendRequestError.set(null);
  }

  protected cancelFriendRequest(): void {
    this.confirmingFriendRequest.set(false);
  }

  protected sendFriendRequest(): void {
    const onlineId = this.profile()?.identity?.online_id;
    if (onlineId === undefined) {
      return;
    }
    this.friendRequestBusy.set(true);
    this.friendRequestError.set(null);
    this.curator.sendFriendRequest(onlineId).subscribe({
      next: () => {
        this.friendRequestBusy.set(false);
        this.confirmingFriendRequest.set(false);
        this.friendRequestSent.set(true);
      },
      error: () => {
        this.friendRequestBusy.set(false);
        this.friendRequestError.set(FRIEND_REQUEST_ERROR);
      },
    });
  }

  protected displayName(profile: PublicProfileResponse): string {
    return profile.identity?.online_id ?? (profile.psn_account_id ? PSN_ACCOUNT_FALLBACK_NAME : UNLINKED_USER_NAME);
  }

  protected readonly followersName = followersAccessibleName;
  protected readonly followingName = followingAccessibleName;

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
        this.followError.set(FOLLOW_USER_ERROR);
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
