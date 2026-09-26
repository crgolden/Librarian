import { type TrophyProgressReason, TrophyProgressReasons } from '../curator/curator.models';

export const REFRESH_JOB_LOST_ERROR = 'Lost track of the refresh job.';

export const REFRESH_START_ERROR = 'Unable to start a library refresh.';

export const LIBRARY_LOAD_ERROR = 'Unable to load your library.';

export const USER_LIBRARY_LOAD_ERROR = "Unable to load this user's library.";

export const VIEWER_TROPHY_TITLE = "Trophy completion isn't shown for other users' libraries yet.";

export const TROPHY_PENDING_TITLE = 'Trophy completion appears after your next library refresh.';

export const TROPHY_UNMATCHED_TITLE = 'No PlayStation trophy title matched this game, so its completion cannot be shown.';

export const TROPHY_PROGRESS_TITLES: Readonly<Record<TrophyProgressReason, string>> = {
  [TrophyProgressReasons.noLink]: 'Link a PlayStation Network account on your account page to see trophy completion.',
  [TrophyProgressReasons.harvestOff]: 'Trophy harvesting is off in your PSN preferences; turn it on to see completion.',
  [TrophyProgressReasons.neverRefreshed]: TROPHY_PENDING_TITLE,
};

export const LIBRARY_FORBIDDEN_MESSAGE =
  'This user keeps their library private. Only they can change that, in their own profile settings — following them does not grant access.';

export const EMPTY_OWN_LIBRARY_MESSAGE = 'No games yet — run a refresh to build your library.';

export const EMPTY_VIEWED_LIBRARY_MESSAGE = 'No games in this library yet.';

export const ALL_GENRES_LABEL = 'All genres';

export const PS_PLUS_NOT_WALKED_MESSAGE = 'PlayStation Plus: the catalog has not been walked yet';

export const STORE_MATCH_CATALOG_EMPTY_LEAD = 'Nothing in the shared catalog matches';

export const PS_PLUS_ROTATION_LOAD_ERROR = 'Unable to load the PlayStation Plus rotation.';
