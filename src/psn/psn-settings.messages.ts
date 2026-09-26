import { type RefreshCadence, RefreshCadences, SchedulePausedReasons } from '../curator/curator.models';

export const PREFERENCE_UPDATE_ERROR ='Failed to update preference. Please try again.';

export const ACTION_HISTORY_FILE_NAME = 'librarian-account-history.json';

export const ACTION_HISTORY_LOAD_ERROR = 'Unable to load your action history.';

export const LINK_STATUS_LOAD_ERROR = 'Unable to load PSN link status.';

export const PSN_UNLINKED_MESSAGE = 'PlayStation Network account unlinked.';

export const PSN_LINKED_MESSAGE = 'PlayStation Network account linked.';

export const PSN_UNLINK_ERROR = 'Failed to unlink PlayStation Network account.';

export const ACCOUNT_DELETE_ERROR = 'Failed to delete your account. Please try again.';

export const NPSSO_REQUIRED_ERROR = 'Enter your NPSSO token.';

export const NPSSO_LENGTH = 64;

export function npssoLengthError(length: number): string {
  return `That NPSSO token is ${length} characters; it should be ${NPSSO_LENGTH}. Copy the whole value and try again.`;
}

export const PsnLinkErrorCodes = {
  mismatch: 'mismatch',
  unverified: 'unverified',
  authFailed: 'auth_failed',
  invalidNpsso: 'invalid_npsso',
} as const;

export const LINK_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [PsnLinkErrorCodes.mismatch]:
    "The PlayStation Network account you linked doesn't match your account email. Sign into the PSN account that uses this same email, then try again.",
  [PsnLinkErrorCodes.unverified]:
    "That PlayStation Network account's email address isn't verified. Verify it with PlayStation, then try linking again.",
  [PsnLinkErrorCodes.authFailed]:
    'PlayStation rejected that NPSSO token. It has most likely expired, or was copied incompletely. Get a fresh one and try again — see the FAQ.',
  [PsnLinkErrorCodes.invalidNpsso]:
    "That doesn't look like an NPSSO token. Paste either the token itself or the whole {\"npsso\": \"...\"} response — see the FAQ.",
};

export const SCHEDULE_PAUSED_LABELS: Readonly<Record<string, string>> = {
  [SchedulePausedReasons.psnLinkExpired]:
    'Your PlayStation Network link expired, so scheduled refreshes stopped. Re-link above to resume them.',
  [SchedulePausedReasons.tooManyConsecutiveFailures]:
    'Too many refreshes failed in a row, so scheduled refreshes stopped. Save the schedule again to resume them.',
};

export const SCHEDULE_PAUSED_FALLBACK_LABEL = 'Scheduled refreshes are paused.';

export const REFRESH_CADENCE_LABELS: Readonly<Record<RefreshCadence, string>> = {
  [RefreshCadences.daily]: 'Daily',
  [RefreshCadences.weekly]: 'Weekly',
  [RefreshCadences.monthly]: 'Monthly',
};

export const SCHEDULE_COST_MESSAGE =
  "These runs happen while you're away, using your saved PlayStation Network token and any keys below. Daily is the shortest option: OpenCritic's free plan resets 200 requests each day. RAWG's resets 20,000 each month, so a daily schedule uses that up about seven times faster than a weekly one.";

export const ACCOUNT_CHANGES_MESSAGE =
  'Everything above only reads your PlayStation Network account. These two let Curator write to it instead — both off by default, and capped together at 50 changes a day.';

export const FRIEND_WRITES_DISCLOSURE =
  "Let Curator add or remove friends on your account. Every change affects one other player, and PlayStation already requires their agreement before you're friends. Removing someone can't be undone from here — they'd have to accept a new request.";

export const CHAT_WRITES_DISCLOSURE =
  "Let Curator create and leave chat groups on your account. Creating a group puts it in front of everyone you invite, and none of them agreed to hear from Curator — that's publishing, not just reading. Leaving a group can't be undone from here — you'd need a fresh invite to rejoin.";

export const DEVICE_LINK_PLACEHOLDER = 'Select a console…';

export const DEVICE_LINK_CONSOLE_REQUIRED_ERROR = 'Choose a console to link this device to.';

export const RAWG_KEY_SAVE_ERROR = 'Failed to save RAWG key.';

export const GENERIC_LINK_ERROR_MESSAGE =
  'Failed to link PlayStation Network account. Check your NPSSO token and try again.';

export const RAWG_KEY_REQUIRED_ERROR = 'Enter a RAWG API key.';
