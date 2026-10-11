export const SIGNED_IN_USER_UNKNOWN_ERROR = 'Unable to determine the signed-in user.';

export const UNLINKED_USER_NAME = 'Unlinked user';

export const PSN_ACCOUNT_FALLBACK_NAME = 'PlayStation account';

export const PROFILE_LOAD_ERROR = 'Unable to load this profile.';

export const FOLLOW_USER_ERROR = 'Unable to follow this user.';

export const FRIEND_REQUEST_ERROR = 'Unable to send a friend request.';

export const TROPHIES_OFF_NOTICE = 'Not catalogued — trophy data is switched off for your account.';

export const FOLLOWERS_LOAD_ERROR = 'Unable to load followers.';

export const FOLLOWING_LOAD_ERROR = 'Unable to load following.';

export const PROFILE_SETTINGS_LOAD_ERROR = 'Unable to load profile settings.';

export const SETTING_UPDATE_ERROR = 'Failed to update setting. Please try again.';

export const LINK_SAVE_ERROR = 'Failed to save the link. Please try again.';

export const StatTileCaptions = {
  followers: 'Followers',
  following: 'Following',
} as const;

export function statTileAccessibleName(caption: string, count: number): string {
  return `${caption} ${count}`;
}
