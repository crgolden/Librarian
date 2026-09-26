export const AccountActions = {
  accountDeleted: 'account_deleted',
  linkRequested: 'link_requested',
  unlinked: 'unlinked',
  enrichmentKeyAdded: 'enrichment_key_added',
  enrichmentKeyRemoved: 'enrichment_key_removed',
  friendAdded: 'friend_added',
  friendRequestSent: 'friend_request_sent',
  followed: 'followed',
  unfollowed: 'unfollowed',
} as const;

export const CuratorDetails = {
  adminClaimRequired: 'curator.admin claim required.',
  apiKeyEmpty: 'api_key must not be empty.',
  cannotFollowOwnCollection: 'Cannot follow your own collection.',
  cannotFollowYourself: 'Cannot follow yourself.',
  collectionDefinitionNotFound: 'Collection definition not found.',
  collectionNotFound: 'Collection not found.',
  consoleIdMissingOrUnknown: 'console_id is missing or unknown.',
  consoleNotFound: 'Console not found.',
  deviceHarvestingDisabled: 'Device harvesting is disabled for this account.',
  enrichmentRunNotFound: 'Enrichment run not found.',
  friendWritesNotPermitted: 'Friend writes are not permitted for this account.',
  identityHarvestingDisabled: 'Identity harvesting is disabled for this account.',
  invalidHandle: 'Handle must be 3-16 characters: letters, digits, - or _.',
  libraryRefreshRunNotFound: 'Library refresh run not found.',
  manualAddNeedsOneIdentifier: "Name the game with exactly one of 'game_id' or 'store_hit'.",
  noEnrichmentRunQueued: 'No enrichment run has been queued yet.',
  noLibraryEntry: 'No library entry for that game.',
  noManualEntry: 'No manually-added entry for that game.',
  noPendingRequest: 'no_pending_request',
  noRefreshSchedule: 'No refresh schedule is configured.',
  noSuchGame: 'No such game.',
  npssoRequired: 'npsso is required',
  presenceHarvestingDisabled: 'Presence harvesting is disabled for this account.',
  profileSectionNotPublic: "This section of the user's profile is not public.",
  psnNotLinked: 'PSN account is not linked.',
  psnNotLinkedForStoreSearch: 'PSN account not linked.',
  queryRequired: 'q is required.',
  storageDeviceNotFound: 'Storage device not found.',
  storeHitNotInResults: 'That title is not in the PlayStation Store results for this search.',
  trophyHarvestingDisabled: 'Trophy harvesting is disabled for this account.',
  unknownCadence: 'Unknown cadence.',
  unknownCollectionKind: "kind must be 'capacity_fill' or 'filter_list'.",
  unknownGame: 'Unknown game.',
  unknownProvider: 'Unknown provider.',
  unknownSite: 'Unknown site.',
  unknownVisibility: 'visibility must be "private", "unlisted", or "public".',
  userNotFound: 'User not found.',
} as const;

export const CuratorPageLimits = {
  library: 20,
  catalog: 50,
  collectionPreview: 50,
  followList: 50,
  manualCandidates: 10,
} as const;

export const CuratorConsoleCapacityDefaultsGb = {
  ps5: 825,
  ps4: 500,
  unlistedPlatform: 500,
} as const;

export const CuratorFallbacks = {
  genre: 'Unclassified',
} as const;

export const CuratorCollectionKinds = {
  manualList: 'manual_list',
} as const;

export const EnrichmentProviders = {
  rawg: 'rawg',
  opencritic: 'opencritic',
} as const;

export const PROFILE_LINK_HANDLE_PLACEHOLDER = '{handle}';

export const ProfileLinkSites = {
  psnProfiles: { site_key: 'psnprofiles', display_name: 'PSNProfiles', url_template: 'https://psnprofiles.com/{handle}' },
  trueTrophies: { site_key: 'truetrophies', display_name: 'TrueTrophies', url_template: 'https://www.truetrophies.com/gamer/{handle}' },
  exophase: { site_key: 'exophase', display_name: 'Exophase', url_template: 'https://www.exophase.com/psn/user/{handle}/' },
} as const;
