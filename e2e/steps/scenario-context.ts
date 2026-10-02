import type { LibraryGameFixture } from '../fixtures.js';

export class ScenarioContext {
  libraryGames: LibraryGameFixture[] = [];
  trophyLevel: number | null = null;
  platinumCount: number | null = null;
  downloadedFileName: string | null = null;
  private savedKeyValue: string | null = null;

  get savedKey(): string {
    if (this.savedKeyValue === null) {
      throw new Error('The scenario reads a saved key before a step saved one.');
    }
    return this.savedKeyValue;
  }

  set savedKey(key: string) {
    this.savedKeyValue = key;
  }
  private psnAccountIdValue: string | null = null;
  private onlineIdValue: string | null = null;
  private profileHandleValue: string | null = null;

  get psnAccountId(): string {
    if (this.psnAccountIdValue === null) {
      throw new Error('The scenario reads a PlayStation account id before a Given linked one.');
    }
    return this.psnAccountIdValue;
  }

  set psnAccountId(accountId: string) {
    this.psnAccountIdValue = accountId;
  }

  get onlineId(): string {
    if (this.onlineIdValue === null) {
      throw new Error('The scenario reads an online id before a Given disclosed one.');
    }
    return this.onlineIdValue;
  }

  set onlineId(onlineId: string) {
    this.onlineIdValue = onlineId;
  }

  get profileHandle(): string {
    if (this.profileHandleValue === null) {
      throw new Error('The scenario reads a profile handle before a step saved one.');
    }
    return this.profileHandleValue;
  }

  set profileHandle(handle: string) {
    this.profileHandleValue = handle;
  }
  overflowCount = 0;
  openCriticTitleCount = 0;
  private searchTermValue: string | null = null;
  private firstStoreHitIdValue: string | null = null;

  get searchTerm(): string {
    if (this.searchTermValue === null) {
      throw new Error('The scenario searches before a Given chose what to search for.');
    }
    return this.searchTermValue;
  }

  set searchTerm(term: string) {
    this.searchTermValue = term;
  }

  get firstStoreHitId(): string {
    if (this.firstStoreHitIdValue === null) {
      throw new Error('The scenario reads a Store match before a Given seeded the Store.');
    }
    return this.firstStoreHitIdValue;
  }

  set firstStoreHitId(storeId: string) {
    this.firstStoreHitIdValue = storeId;
  }

  curatorRequests: string[] = [];
  expectedSizeSources: string[] = [];
  unmeasuredCount = 0;
  renamedCollection: string | null = null;
  storedCollectionName: string | null = null;
  enrichmentStarts = 0;
  enrichmentPolls = 0;
  private enrichmentRunIdValue: string | null = null;

  get enrichmentRunId(): string {
    if (this.enrichmentRunIdValue === null) {
      throw new Error('The scenario reads its enrichment run before a Given recorded one.');
    }
    return this.enrichmentRunIdValue;
  }

  set enrichmentRunId(runId: string) {
    this.enrichmentRunIdValue = runId;
  }
  answeredGameIds: string[] = [];
  markersAtTheLeave: number | null = null;
  private rawgScoreValue: number | null = null;
  private openCriticScoreValue: number | null = null;
  private chosenGenreValue: string | null = null;
  private seededCatalogCountValue: number | null = null;
  private otherGameIdValue: string | null = null;
  private publicDefinitionIdValue: string | null = null;
  private sharedDefinitionIdValue: string | null = null;
  private consoleIdValue: string | null = null;
  private consolePlatformValue: string | null = null;

  get consoleId(): string {
    if (this.consoleIdValue === null) {
      throw new Error('The scenario reads its console before a step added one.');
    }
    return this.consoleIdValue;
  }

  set consoleId(consoleId: string) {
    this.consoleIdValue = consoleId;
  }

  get consolePlatform(): string {
    if (this.consolePlatformValue === null) {
      throw new Error('The scenario reads its console platform before a step chose one.');
    }
    return this.consolePlatformValue;
  }

  set consolePlatform(platform: string) {
    this.consolePlatformValue = platform;
  }
  private sharePathValue: string | null = null;

  get sharedDefinitionId(): string {
    if (this.sharedDefinitionIdValue === null) {
      throw new Error('The scenario reads its shared collection before a Given shared one.');
    }
    return this.sharedDefinitionIdValue;
  }

  set sharedDefinitionId(definitionId: string) {
    this.sharedDefinitionIdValue = definitionId;
  }

  get sharePath(): string {
    if (this.sharePathValue === null) {
      throw new Error('The scenario opens a share link before a Given shared a collection.');
    }
    return this.sharePathValue;
  }

  set sharePath(path: string) {
    this.sharePathValue = path;
  }

  get rawgScore(): number {
    if (this.rawgScoreValue === null) {
      throw new Error('The scenario reads a RAWG score before a Given gave a game one.');
    }
    return this.rawgScoreValue;
  }

  set rawgScore(score: number) {
    this.rawgScoreValue = score;
  }

  get openCriticScore(): number {
    if (this.openCriticScoreValue === null) {
      throw new Error('The scenario reads an OpenCritic score before a Given gave a game one.');
    }
    return this.openCriticScoreValue;
  }

  set openCriticScore(score: number) {
    this.openCriticScoreValue = score;
  }

  get chosenGenre(): string {
    if (this.chosenGenreValue === null) {
      throw new Error('The scenario filters by a genre before a Given chose one.');
    }
    return this.chosenGenreValue;
  }

  set chosenGenre(genre: string) {
    this.chosenGenreValue = genre;
  }

  get seededCatalogCount(): number {
    if (this.seededCatalogCountValue === null) {
      throw new Error('The scenario counts the catalog before a Given seeded it.');
    }
    return this.seededCatalogCountValue;
  }

  set seededCatalogCount(count: number) {
    this.seededCatalogCountValue = count;
  }

  get otherGameId(): string {
    if (this.otherGameIdValue === null) {
      throw new Error('The scenario reads its second catalog entry before a Given seeded one.');
    }
    return this.otherGameIdValue;
  }

  set otherGameId(gameId: string) {
    this.otherGameIdValue = gameId;
  }

  get publicDefinitionId(): string {
    if (this.publicDefinitionIdValue === null) {
      throw new Error('The scenario reads its public collection before a Given saved one.');
    }
    return this.publicDefinitionIdValue;
  }

  set publicDefinitionId(definitionId: string) {
    this.publicDefinitionIdValue = definitionId;
  }
  private catalogGameIdValue: string | null = null;
  private readerPositionValue: number | null = null;
  private libraryCountValue: number | null = null;

  get catalogGameId(): string {
    if (this.catalogGameIdValue === null) {
      throw new Error('The scenario reads its catalog game before a Given put one in the catalog.');
    }
    return this.catalogGameIdValue;
  }

  set catalogGameId(gameId: string) {
    this.catalogGameIdValue = gameId;
  }

  private releaseAppBootstrapValue: (() => void) | null = null;

  get releaseAppBootstrap(): () => void {
    if (this.releaseAppBootstrapValue === null) {
      throw new Error("The scenario releases the app's scripts before a Given held them.");
    }
    return this.releaseAppBootstrapValue;
  }

  set releaseAppBootstrap(release: () => void) {
    this.releaseAppBootstrapValue = release;
  }

  get readerPosition(): number {
    if (this.readerPositionValue === null) {
      throw new Error("The scenario checks the reader's place before a Given scrolled the catalog.");
    }
    return this.readerPositionValue;
  }

  set readerPosition(position: number) {
    this.readerPositionValue = position;
  }

  private collectionCountValue: number | null = null;
  private collectionEntryCountValue: number | null = null;

  get libraryCount(): number {
    if (this.libraryCountValue === null) {
      throw new Error('The scenario reads the library size before a Given filled the library.');
    }
    return this.libraryCountValue;
  }

  set libraryCount(count: number) {
    this.libraryCountValue = count;
  }

  get collectionCount(): number {
    if (this.collectionCountValue === null) {
      throw new Error('The scenario reads the collection count before a Given saved any collections.');
    }
    return this.collectionCountValue;
  }

  set collectionCount(count: number) {
    this.collectionCountValue = count;
  }

  get collectionEntryCount(): number {
    if (this.collectionEntryCountValue === null) {
      throw new Error('The scenario reads the collection entry count before a Given saved any collections.');
    }
    return this.collectionEntryCountValue;
  }

  set collectionEntryCount(count: number) {
    this.collectionEntryCountValue = count;
  }
}
