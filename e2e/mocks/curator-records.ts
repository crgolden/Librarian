import {
  LARGEST_PERCENT,
  newCount,
  newDisplayName,
  newId,
  newMemberOf,
  newPercent,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { AaaTiers, CONSOLE_PLATFORM_OPTIONS } from '../../src/curator/curator.models';
import { PsnClassifications, PsnStoreHitKinds } from '../psn-constants';
import type { GameSummary, LibraryGame, StoreSearchHit, TrophySummary } from './curator.js';

export type SeededLibraryGame = Pick<LibraryGame, 'game_id' | 'title' | 'rawg_enriched' | 'opencritic_enriched'> &
  Partial<LibraryGame>;

export function newAaaTier(): string {
  return newMemberOf(Object.values(AaaTiers));
}

export function newScore(): number {
  return randomIntBetween(1, LARGEST_PERCENT + 1);
}

export function newPsnRating(): number {
  return Number(`${randomIntBetween(1, 5)}.${randomIntBetween(0, 10)}`);
}

export function newFutureInstant(): string {
  const now = Date.now();
  return new Date(now + (now - Date.parse(newUtcInstant()))).toISOString();
}

export function newCatalogGame(): GameSummary {
  return {
    game_id: newId(),
    canonical_title: newText(),
    franchise: null,
    genre: newText(),
    aaa_tier: newAaaTier(),
  };
}

export function newLibraryGame(): SeededLibraryGame {
  return {
    game_id: newId(),
    title: newText(),
    rawg_enriched: false,
    opencritic_enriched: false,
  };
}

export function newStoreHit(nameFragment: string): StoreSearchHit {
  return {
    id: newId(),
    kind: PsnStoreHitKinds.concept,
    default_product_id: newId(),
    name: `${nameFragment} ${newDisplayName()}`,
    platforms: [newMemberOf(CONSOLE_PLATFORM_OPTIONS)],
    cover_image_url: null,
    classification: PsnClassifications.fullGame,
    price: newText(),
    discounted_price: null,
    is_free: false,
  };
}

export function newTrophySummary(): TrophySummary {
  return {
    level: newCount(),
    progress: newPercent(),
    tier: randomIntBetween(1, 11),
    earned: { bronze: newCount(), silver: newCount(), gold: newCount(), platinum: newCount() },
    account_id: newId(),
  };
}
