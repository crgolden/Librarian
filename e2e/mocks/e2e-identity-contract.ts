import { newId, newPathSegment } from '@crgolden/modules/testing';
import { E2E_CONTRACT_VARIABLE } from './e2e-contract-constants';

export { E2E_CONTRACT_VARIABLE };

export interface E2eIdentityCookieNames {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly admin: string;
}

export interface ControlRoutePaths {
  readonly admin: string;
  readonly catalogGames: string;
  readonly consoleDeviceLink: string;
  readonly consoles: string;
  readonly enrichmentKeys: string;
  readonly enrichmentRun: string;
  readonly enrichmentRunOutcome: string;
  readonly follow: string;
  readonly hiddenLibraryGames: string;
  readonly libraryGames: string;
  readonly libraryRefreshOutcome: string;
  readonly psnLink: string;
  readonly psnPreferences: string;
  readonly reset: string;
  readonly seedUser: string;
  readonly storeSearchHits: string;
  readonly userCollections: string;
  readonly userFriendRequests: string;
  readonly userLibraryGames: string;
  readonly userProfileSettings: string;
  readonly userPsPlusRotation: string;
  readonly userPsnLink: string;
  readonly userPsnPreferences: string;
  readonly userPsnProfile: string;
  readonly userRefreshSchedule: string;
}

export interface E2eContract {
  readonly defaultSub: string;
  readonly subHeader: string;
  readonly identityCookies: E2eIdentityCookieNames;
  readonly controlRoutes: ControlRoutePaths;
}

function newControlRoute(): string {
  return `/${newPathSegment()}/${newPathSegment()}`;
}

export function newE2eContract(): E2eContract {
  return {
    defaultSub: newId(),
    subHeader: newPathSegment(),
    identityCookies: {
      sub: newPathSegment(),
      email: newPathSegment(),
      name: newPathSegment(),
      admin: newPathSegment(),
    },
    controlRoutes: {
      admin: newControlRoute(),
      catalogGames: newControlRoute(),
      consoleDeviceLink: newControlRoute(),
      consoles: newControlRoute(),
      enrichmentKeys: newControlRoute(),
      enrichmentRun: newControlRoute(),
      enrichmentRunOutcome: newControlRoute(),
      follow: newControlRoute(),
      hiddenLibraryGames: newControlRoute(),
      libraryGames: newControlRoute(),
      libraryRefreshOutcome: newControlRoute(),
      psnLink: newControlRoute(),
      psnPreferences: newControlRoute(),
      reset: newControlRoute(),
      seedUser: newControlRoute(),
      storeSearchHits: newControlRoute(),
      userCollections: newControlRoute(),
      userFriendRequests: newControlRoute(),
      userLibraryGames: newControlRoute(),
      userProfileSettings: newControlRoute(),
      userPsPlusRotation: newControlRoute(),
      userPsnLink: newControlRoute(),
      userPsnPreferences: newControlRoute(),
      userPsnProfile: newControlRoute(),
      userRefreshSchedule: newControlRoute(),
    },
  };
}

export function e2eContract(): E2eContract {
  const serialized = process.env[E2E_CONTRACT_VARIABLE];
  if (serialized === undefined || serialized.length === 0) {
    throw new Error(
      `${E2E_CONTRACT_VARIABLE} is unset; playwright.config.ts generates it once for the runner, its workers and the mock servers.`,
    );
  }
  return JSON.parse(serialized) as E2eContract;
}
