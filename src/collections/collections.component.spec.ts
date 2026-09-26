import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CollectionsComponent, RESULT_PAGE_SIZE, SIZE_SOURCE_LABELS } from './collections.component';
import { CollectionsModes, NO_INSTALLS, ResolvedCollections, ResolvedInstalls } from './collections.resolver';
import {
  CollectionGameResponse,
  CollectionItemResponse,
  CollectionItemSortFields,
  CollectionKinds,
  CollectionPreviewResponse,
  CollectionVisibilities,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
  SizeSource,
  SizeSources,
  StorageKinds,
  ConsolePlatforms,
  CONSOLE_PLATFORM_OPTIONS,
} from '../curator/curator.models';
import { CuratorApi, CuratorQueryParams } from '../curator/curator-api';
import { AppPaths, AppUrls, RouteDataKeys, collectionDefinitionUrl } from '../app/app-paths';
import {
  CAPACITY_FILL_LABEL,
  COLLECTION_DETAIL_LOAD_ERROR,
  COLLECTIONS_FORBIDDEN_MESSAGE,
  CONSOLE_REQUIRED_ERROR,
  FILTER_LIST_LABEL,
  SAVED_COLLECTIONS_LOAD_ERROR,
  USER_COLLECTIONS_LOAD_ERROR,
} from './collections.messages';
import { HttpMethods } from '../bff/http-headers';
import { ITEMS_PAGE_SIZE } from './collection-items.query';
import { newCount, newDisplayName, newHttpsAddress, newId, newPercent, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

const DEFINITION_ID = newId();
const FOLLOWED_DEFINITION_ID = newId();
const CONSOLE_ID = newId();
const UNKNOWN_CONSOLE_ID = newId();
const RUN_ID = newId();
const OTHER_SUB = newId();
const GAME_0 = newId();
const GAME_1 = newId();
const GAME_2 = newId();
const GAME_3 = newId();
const M2_DEVICE_ID = newId();
const USB_DEVICE_ID = newId();
const DEFAULT_SHARE_SLUG = newText();
const SHARE_SLUG = newText();
const DEFINITION_NAME = newText();
const NEW_COLLECTION_NAME = newText();
const EMPTY_COLLECTION_NAME = newText();
const RENAMED_NAME = newText();
const NEW_DESCRIPTION = newText();
const FOLLOWED_COLLECTION_NAME = newText();
const CONSOLE_NAME = newDisplayName();
const M2_DEVICE_NAME = newDisplayName();
const USB_DEVICE_NAME = newDisplayName();
const GENRE_A = newText();
const GENRE_B = newText();
const GENRE_C = newText();
const FRANCHISE = newText();
const AAA_TIER = newText();
const SIZE_GB = newCount();

function definition(overrides: Partial<DefinitionResponse> = {}): DefinitionResponse {
  return {
    definition_id: DEFINITION_ID,
    name: DEFINITION_NAME,
    description: null,
    kind: CollectionKinds.filterList,
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    include_inactive: false,
    min_percent_completed: null,
    sort_order: null,
    exclude_installed_on: [],
    install_target_console_id: null,
    visibility: CollectionVisibilities.private,
    share_slug: DEFAULT_SHARE_SLUG,
    item_count: 0,
    ...overrides,
  };
}

function item(id: string, overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    game_id: id,
    rank: 1,
    title: `Game ${id}`,
    franchise: FRANCHISE,
    genre: GENRE_A,
    aaa_tier: AAA_TIER,
    critical_score: newPercent(),
    oc_score: newPercent(),
    psn_rating: newPercent(),
    cover_image_url: null,
    owner_has_access: true,
    installed_on_target: null,
    ...overrides,
  };
}

function definitionDetail(
  overrides: Partial<DefinitionResponse> = {},
  items: CollectionItemResponse[] = [],
): DefinitionDetailResponse {
  return { ...definition(overrides), items };
}

function game(
  id: string,
  percentCompleted: number | null = null,
  sizeSource: SizeSource = SizeSources.estimated,
): CollectionGameResponse {
  return {
    game_id: id,
    title: `Game ${id}`,
    genre: GENRE_A,
    aaa_tier: AAA_TIER,
    franchise: FRANCHISE,
    composite_score: newPercent(),
    rank_score: 1,
    size_gb: SIZE_GB,
    percent_completed: percentCompleted,
    size_source: sizeSource,
  };
}

const previewUrl = (r: { url: string }): boolean => r.url === CuratorApi.collectionsPreview;

function emptyPreview(): CollectionPreviewResponse {
  return {
    included: [],
    excluded: [],
    included_total: 0,
    excluded_total: 0,
    included_game_ids: [],
    used_gb: null,
    ignored_filters: [],
    excluded_for_missing_trophy_data: 0,
  };
}

interface CollectionsHarness {
  kind: { set(value: string): void };
  consoleId: { set(value: string | null): void };
  genreFilter: { set(value: string[]): void };
  name: { set(value: string): void };
  minPercentCompleted: { set(value: number | null): void };
  editName: { set(value: string): void };
  editDescription: { set(value: string | null): void };
  showCreate(): void;
  showFollowed(): void;
  preview(): void;
  pagePreview(delta: number): void;
  saveDefinition(): void;
  startEditingMeta(): void;
  saveMeta(): void;
  removeItem(gameId: string): void;
  setVisibility(visibility: string): void;
  confirmDelete(): void;
  deleteDefinition(): void;
  runSelected(): void;
  adoptRunResult(): void;
  toggleInstall(gameId: string): void;
  toggleDeviceInstall(deviceId: string, gameId: string): void;
  measuredSizePlatform: { set(value: string): void };
  measuredSizeValue: { set(value: number | null): void };
  toggleMeasuredSizePanel(gameId: string): void;
  submitMeasuredSize(gameId: string): void;
  unfollow(definitionId: string): void;
  toggleFollowViewerDefinition(definitionId: string): void;
}

function harness(fixture: ComponentFixture<CollectionsComponent>): CollectionsHarness {
  return fixture.componentInstance as unknown as CollectionsHarness;
}

let queryParams$: BehaviorSubject<Params>;

function activatedRouteStub(
  params: Record<string, string>,
  resolved: ResolvedCollections,
  genres: string[] = [],
  queryParams: Params = {},
): ActivatedRoute {
  queryParams$ = new BehaviorSubject<Params>(queryParams);
  return {
    snapshot: { paramMap: convertToParamMap(params), data: { [RouteDataKeys.collections]: resolved, [RouteDataKeys.genres]: genres }, queryParams },
    queryParams: queryParams$.asObservable(),
  } as unknown as ActivatedRoute;
}

function setQueryParams(next: Params): void {
  queryParams$.next(next);
}

describe('CollectionsComponent', () => {
  let httpMock: HttpTestingController;

  function configure(
    params: Record<string, string>,
    resolved: ResolvedCollections,
    genres: string[] = [],
    queryParams: Params = {},
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([{ path: AppPaths.collections, children: [] }]),
        { provide: ActivatedRoute, useValue: activatedRouteStub(params, resolved, genres, queryParams) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    configure({}, { mode: CollectionsModes.list, definitions: [], consoles: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(
    definitions: DefinitionResponse[],
    consoles: ConsoleResponse[] = [],
    genres: string[] = [],
  ): ComponentFixture<CollectionsComponent> {
    configure({}, { mode: CollectionsModes.list, definitions, consoles }, genres);
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  function createDetail(
    detail: DefinitionDetailResponse,
    consoles: ConsoleResponse[] = [],
    genres: string[] = [],
    installs: ResolvedInstalls = NO_INSTALLS,
    queryParams: Params = {},
  ): ComponentFixture<CollectionsComponent> {
    configure(
      { definitionId: detail.definition_id },
      { mode: CollectionsModes.detail, definition: detail, consoles, installs },
      genres,
      queryParams,
    );
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  describe('genre filter', () => {
    it('offers one option per genre resolved for the route, in a multi-select', () => {
      const fixture = createAndLoad([], [], [GENRE_A, GENRE_B, GENRE_C]);
      harness(fixture).showCreate();
      fixture.detectChanges();

      const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#genreFilter');
      expect(select).not.toBeNull();
      expect(select?.multiple).toBe(true);
      expect(Array.from(select?.options ?? []).map((option) => option.textContent)).toEqual([
        GENRE_A,
        GENRE_B,
        GENRE_C,
      ]);
    });

    it('renders no options when the route resolved no genres, rather than a free-text fallback', () => {
      const fixture = createAndLoad([], [], []);
      harness(fixture).showCreate();
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelectorAll('#genreFilter option')).toHaveLength(0);
      expect(root.querySelector('input#genreFilter')).toBeNull();
    });

    it('sends the selected genres as genre_filter on the preview request', () => {
      const fixture = createAndLoad([], [], [GENRE_A, GENRE_B]);
      const component = harness(fixture);
      component.showCreate();
      component.genreFilter.set([GENRE_A, GENRE_B]);
      fixture.detectChanges();

      component.preview();

      const request = httpMock.expectOne(previewUrl);
      expect(request.request.body.genre_filter).toEqual([GENRE_A, GENRE_B]);
      request.flush(emptyPreview());
    });
  });

  describe('completion floor notices', () => {
    function ignoredCompletionFloor(): { filter: string; reason: string }[] {
      return [{ filter: newText(), reason: newId() }];
    }

    function previewAnswering(answer: CollectionPreviewResponse): ComponentFixture<CollectionsComponent> {
      const fixture = createAndLoad([]);
      const h = harness(fixture);
      h.showCreate();
      fixture.detectChanges();

      h.preview();
      httpMock.expectOne(previewUrl).flush(answer);
      fixture.detectChanges();
      return fixture;
    }

    function runAnswering(answer: CollectionPreviewResponse): ComponentFixture<CollectionsComponent> {
      const fixture = createDetail(definitionDetail({ kind: CollectionKinds.filterList }, [item(GAME_0)]));
      fixture.detectChanges();

      harness(fixture).runSelected();
      httpMock
        .expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdRuns(DEFINITION_ID))
        .flush({ run_id: newId(), ...answer });
      fixture.detectChanges();
      return fixture;
    }

    it('warns that a preview ignored the completion floor, and counts the titles it dropped for having no trophy data', () => {
      const dropped = newCount();
      const fixture = previewAnswering({
        ...emptyPreview(),
        ignored_filters: ignoredCompletionFloor(),
        excluded_for_missing_trophy_data: dropped,
      });

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#preview-ignored-filters')).not.toBeNull();
      expect(compiled.querySelector('#preview-excluded-missing-trophy')?.textContent).toContain(`${dropped} title(s)`);
    });

    it('says neither thing about a preview that ignored nothing and dropped nothing', () => {
      const fixture = previewAnswering(emptyPreview());

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#preview-ignored-filters')).toBeNull();
      expect(compiled.querySelector('#preview-excluded-missing-trophy')).toBeNull();
    });

    it('warns and counts the same way for a run result', () => {
      const dropped = newCount();
      const fixture = runAnswering({
        ...emptyPreview(),
        ignored_filters: ignoredCompletionFloor(),
        excluded_for_missing_trophy_data: dropped,
      });

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#run-ignored-filters')).not.toBeNull();
      expect(compiled.querySelector('#run-excluded-missing-trophy')?.textContent).toContain(`${dropped} title(s)`);
    });

    it('says neither thing about a run that ignored nothing and dropped nothing', () => {
      const fixture = runAnswering(emptyPreview());

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector('#run-ignored-filters')).toBeNull();
      expect(compiled.querySelector('#run-excluded-missing-trophy')).toBeNull();
    });
  });

  describe('size provenance', () => {
    function previewWith(included: CollectionGameResponse[]): ComponentFixture<CollectionsComponent> {
      const fixture = createAndLoad([]);
      const h = harness(fixture);
      h.showCreate();
      fixture.detectChanges();

      h.preview();
      httpMock.expectOne(previewUrl).flush({
        included,
        excluded: [],
        included_total: included.length,
        excluded_total: 0,
        included_game_ids: included.map((g) => g.game_id),
        used_gb: included.length * SIZE_GB,
        ignored_filters: [],
        excluded_for_missing_trophy_data: 0,
      });
      fixture.detectChanges();
      return fixture;
    }

    const rungs: SizeSource[] = [SizeSources.measured, SizeSources.download, SizeSources.estimated, SizeSources.cappedDefault, SizeSources.default];

    it('labels every included title with the rung its size came from, addressable by id', () => {
      const fixture = previewWith(rungs.map((rung, index) => game(`g${index}`, null, rung)));
      const compiled: HTMLElement = fixture.nativeElement;

      rungs.forEach((rung, index) => {
        const badge = compiled.querySelector(`#preview-included-size-source-${index}`);
        expect(badge).not.toBeNull();
        expect(badge?.getAttribute('data-size-source')).toBe(rung);
        expect(badge?.textContent?.trim()).toBe(SIZE_SOURCE_LABELS[rung]);
      });
    });

    it('calls an unmeasured size "not measured" rather than showing the raw enum value', () => {
      const fixture = previewWith([game(GAME_0, null, SizeSources.default)]);
      const badge = (fixture.nativeElement as HTMLElement).querySelector('#preview-included-size-source-0');

      expect(badge?.textContent?.trim()).toBe(SIZE_SOURCE_LABELS.default);
      expect(badge?.textContent).not.toContain(SizeSources.default);
    });

    it('prompts to contribute a real size, counting only the titles packing at a placeholder', () => {
      const unmeasured = [game(GAME_0, null, SizeSources.default), game(GAME_2, null, SizeSources.default)];
      const sized = [game(GAME_1, null, SizeSources.measured), game(GAME_3, null, SizeSources.estimated)];
      const included = [...unmeasured, ...sized];
      const fixture = previewWith(included);

      const prompt = (fixture.nativeElement as HTMLElement).querySelector('#preview-unmeasured-sizes');
      expect(prompt?.getAttribute('data-unmeasured-count')).toBe(String(unmeasured.length));
      expect(prompt?.getAttribute('data-shown-count')).toBe(String(included.length));
    });

    it('stays silent when every included title already has a real size', () => {
      const fixture = previewWith([game(GAME_0, null, SizeSources.measured), game(GAME_1, null, SizeSources.estimated)]);

      expect((fixture.nativeElement as HTMLElement).querySelector('#preview-unmeasured-sizes')).toBeNull();
    });

    it('counts a download size and a media ceiling as sizes somebody reported, not as placeholders', () => {
      const fixture = previewWith([game(GAME_0, null, SizeSources.download), game(GAME_1, null, SizeSources.cappedDefault)]);

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#preview-unmeasured-sizes'),
        'only the bare default rung means nobody reported a size; a download figure comes from Sony and a '
          + 'media ceiling from the platform, so prompting for either asks the owner to fix what is not broken',
      ).toBeNull();
    });

    it('names the download rung after its source rather than repeating "measured"', () => {
      const fixture = previewWith([game(GAME_0, null, SizeSources.download), game(GAME_1, null, SizeSources.cappedDefault)]);
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector('#preview-included-size-source-0')?.textContent?.trim()).toBe(SIZE_SOURCE_LABELS.download);
      expect(compiled.querySelector('#preview-included-size-source-1')?.textContent?.trim()).toBe(SIZE_SOURCE_LABELS.capped_default);
    });

    function runWith(included: CollectionGameResponse[]): ComponentFixture<CollectionsComponent> {
      const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_0)]));
      const h = harness(fixture);
      fixture.detectChanges();

      h.runSelected();
      httpMock.expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdRuns(DEFINITION_ID)).flush({
        run_id: RUN_ID,
        included,
        excluded: [],
        included_total: included.length,
        excluded_total: 0,
        included_game_ids: included.map((g) => g.game_id),
        used_gb: included.length * SIZE_GB,
        ignored_filters: [],
        excluded_for_missing_trophy_data: 0,
      });
      fixture.detectChanges();
      return fixture;
    }

    it('badges a run result with the same rungs as a preview, under the run ids', () => {
      const fixture = runWith(rungs.map((rung, index) => game(`g${index}`, null, rung)));
      const compiled: HTMLElement = fixture.nativeElement;

      rungs.forEach((rung, index) => {
        const badge = compiled.querySelector(`#run-included-size-source-${index}`);
        expect(badge, `the run view renders no size-source badge at index ${index}`).not.toBeNull();
        expect(badge?.getAttribute('data-size-source')).toBe(rung);
        expect(badge?.textContent?.trim()).toBe(SIZE_SOURCE_LABELS[rung]);
      });
    });

    it('counts a run result unmeasured titles the way a preview counts them', () => {
      const unmeasured = [game(GAME_0, null, SizeSources.default), game(GAME_2, null, SizeSources.default)];
      const included = [...unmeasured, game(GAME_1, null, SizeSources.measured)];
      const fixture = runWith(included);

      const prompt = (fixture.nativeElement as HTMLElement).querySelector('#run-unmeasured-sizes');
      expect(prompt?.getAttribute('data-unmeasured-count')).toBe(String(unmeasured.length));
      expect(prompt?.getAttribute('data-shown-count')).toBe(String(included.length));
    });
  });

  it('shows an empty state when there are no saved collections', () => {
    const fixture = createAndLoad([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('#collections-empty')).not.toBeNull();
  });

  it('lists saved collections with their item count and visibility', () => {
    const itemCount = newCount();
    const fixture = createAndLoad([definition({ item_count: itemCount, visibility: CollectionVisibilities.public })]);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(DEFINITION_NAME);
    expect(compiled.querySelector('#collection-item-count-0')?.getAttribute('data-item-count')).toBe(String(itemCount));
    expect(compiled.querySelector('#collection-visibility-0')?.getAttribute('data-visibility')).toBe(CollectionVisibilities.public);
  });

  it('shows a humanized label for a collection kind instead of the raw enum value', () => {
    const fixture = createAndLoad([
      definition({ definition_id: DEFINITION_ID, kind: CollectionKinds.filterList }),
      definition({ definition_id: FOLLOWED_DEFINITION_ID, kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }),
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(FILTER_LIST_LABEL);
    expect(text).toContain(CAPACITY_FILL_LABEL);
    expect(text).not.toContain(CollectionKinds.filterList);
    expect(text).not.toContain(CollectionKinds.capacityFill);
  });

  it("shows a capacity-fill collection's console name in the detail view, not its raw id", () => {
    const consoles: ConsoleResponse[] = [
      {
        console_id: CONSOLE_ID,
        name: CONSOLE_NAME,
        platform: ConsolePlatforms.ps5,
        raw_capacity_gb: newCount(),
        model: null,
        update_buffer_gb: newCount(),
        effective_capacity_gb: newCount(),
        routing_genres: [],
        fill_order: 0,
        capacity_is_default: false,
        device_link: null,
      },
    ];
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]), consoles);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(`Console: ${CONSOLE_NAME}`);
    expect(text).not.toContain(`Console: ${CONSOLE_ID}`);
  });

  it('renders each collection as a real link, so it can be middle-clicked, opened in a new tab or copied', () => {
    const fixture = createAndLoad([definition()]);
    const link = (fixture.nativeElement as HTMLElement).querySelector('#collection-open-0');

    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe(collectionDefinitionUrl(DEFINITION_ID));
  });

  it('leaves a modified click to the browser, rather than swallowing it into an in-place navigation', () => {
    const fixture = createAndLoad([definition()]);
    const link = (fixture.nativeElement as HTMLElement).querySelector('#collection-open-0');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });

    (link as HTMLAnchorElement).dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(false);
    httpMock.expectNone(CuratorApi.collectionsByDefinitionId(DEFINITION_ID));
  });

  it('leaves both directions to the router, so the address bar and Router state cannot disagree', () => {
    const listFixture = createAndLoad([definition()]);
    const open = (listFixture.nativeElement as HTMLElement).querySelector('#collection-open-0');

    expect((open as HTMLAnchorElement).getAttribute('href')).toBe(collectionDefinitionUrl(DEFINITION_ID));

    const detailFixture = createDetail(definitionDetail());
    const back = (detailFixture.nativeElement as HTMLElement).querySelector('#collections-back');

    expect(back).toBeInstanceOf(HTMLAnchorElement);
    expect((back as HTMLAnchorElement).getAttribute('href')).toBe(AppUrls.collections);
  });

  it('a direct deep link to /collections/d/:definitionId opens the detail view immediately, without loading the list first', () => {
    configure(
      { definitionId: DEFINITION_ID },
      { mode: CollectionsModes.detail, definition: definitionDetail(), consoles: [], installs: NO_INSTALLS },
    );

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(DEFINITION_NAME);
    httpMock.expectNone((req) => req.url === CuratorApi.collections);
    httpMock.expectNone((req) => req.url === CuratorApi.collectionsByDefinitionId(DEFINITION_ID));
  });

  it('a deep link to a definition that fails to load shows the detail error, not the list', () => {
    configure({ definitionId: DEFINITION_ID }, { mode: CollectionsModes.detailError, consoles: [] });

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(COLLECTION_DETAIL_LOAD_ERROR);
    httpMock.expectNone((req) => req.url === CuratorApi.collections);
  });

  it('shows the list error when the resolver could not load saved collections', () => {
    configure({}, { mode: CollectionsModes.listError, consoles: [] });

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SAVED_COLLECTIONS_LOAD_ERROR);
  });

  it('preview() shows a validation error and makes no request when capacity_fill has no console', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();
    h.kind.set(CollectionKinds.capacityFill);

    h.preview();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      CONSOLE_REQUIRED_ERROR,
    );
    httpMock.expectNone(CuratorApi.collectionsPreview);
  });

  it('preview() sends minPercentCompleted through to the request body', () => {
    const COMPLETION_FLOOR = newPercent();
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();
    h.minPercentCompleted.set(COMPLETION_FLOOR);

    h.preview();
    const previewReq = httpMock.expectOne(previewUrl);
    expect(previewReq.request.body).toEqual(expect.objectContaining({ min_percent_completed: COMPLETION_FLOOR, include_inactive: false }));
    expect(previewReq.request.params.get(CuratorQueryParams.limit)).toBe(String(RESULT_PAGE_SIZE));
    expect(Number(previewReq.request.params.get(CuratorQueryParams.offset))).toBe(0);
    previewReq.flush(emptyPreview());
  });

  it('the preview pager labels the last page by what it holds, not by the page size', () => {
    const titlesOnTheLastPage = randomIntBetween(1, RESULT_PAGE_SIZE);
    const includedTotal = RESULT_PAGE_SIZE + titlesOnTheLastPage;
    const allIncludedIds = Array.from({ length: includedTotal }, (_, index) => `g${index}`);
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    httpMock.expectOne(previewUrl).flush({
      included: allIncludedIds.slice(0, RESULT_PAGE_SIZE).map((id) => game(id)),
      excluded: [],
      included_total: includedTotal,
      excluded_total: 0,
      included_game_ids: allIncludedIds,
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`1–${RESULT_PAGE_SIZE} of ${includedTotal}`);

    h.pagePreview(1);
    const lastPage = httpMock.expectOne(previewUrl);
    expect(lastPage.request.params.get(CuratorQueryParams.offset)).toBe(String(RESULT_PAGE_SIZE));
    lastPage.flush({
      included: allIncludedIds.slice(RESULT_PAGE_SIZE).map((id) => game(id)),
      excluded: [],
      included_total: includedTotal,
      excluded_total: 0,
      included_game_ids: allIncludedIds,
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(`${RESULT_PAGE_SIZE + 1}–${includedTotal} of ${includedTotal}`);
    expect(text).not.toContain(`${RESULT_PAGE_SIZE + 1}–${RESULT_PAGE_SIZE * 2} of ${includedTotal}`);
  });

  it('saveDefinition() sends every included id, not just the page the preview rendered', () => {
    const PERCENT_COMPLETED = newPercent();
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    httpMock.expectOne(previewUrl).flush({
      included: [game(GAME_1, PERCENT_COMPLETED)],
      excluded: [],
      included_total: [GAME_1, GAME_2, GAME_3].length,
      excluded_total: 0,
      included_game_ids: [GAME_1, GAME_2, GAME_3],
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();

    h.name.set(NEW_COLLECTION_NAME);
    h.saveDefinition();
    const saveReq = httpMock.expectOne(CuratorApi.collections);
    expect(saveReq.request.body).toEqual(expect.objectContaining({ game_ids: [GAME_1, GAME_2, GAME_3] }));
    saveReq.flush(definition({ name: NEW_COLLECTION_NAME }));

    httpMock.expectOne(CuratorApi.collections).flush([definition({ name: NEW_COLLECTION_NAME })]);
  });

  it('preview() renders included/excluded games, then saveDefinition() sends the preview game_ids', () => {
    const PERCENT_COMPLETED = newPercent();
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    const previewReq = httpMock.expectOne(previewUrl);
    previewReq.flush({
      included: [game(GAME_1, PERCENT_COMPLETED)],
      excluded: [],
      included_total: 1,
      excluded_total: 0,
      included_game_ids: [GAME_1],
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`Game ${GAME_1}`);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`${PERCENT_COMPLETED}% complete`);

    h.name.set(NEW_COLLECTION_NAME);
    h.saveDefinition();
    const saveReq = httpMock.expectOne(CuratorApi.collections);
    expect(saveReq.request.method).toBe(HttpMethods.post);
    expect(saveReq.request.body).toEqual(expect.objectContaining({ name: NEW_COLLECTION_NAME, kind: CollectionKinds.filterList, game_ids: [GAME_1] }));
    saveReq.flush(definition({ name: NEW_COLLECTION_NAME }));

    httpMock.expectOne(CuratorApi.collections).flush([definition({ name: NEW_COLLECTION_NAME })]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(NEW_COLLECTION_NAME);
  });

  it('saveDefinition() without a preview saves an empty collection rather than silently dropping membership', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.name.set(EMPTY_COLLECTION_NAME);
    h.saveDefinition();
    const saveReq = httpMock.expectOne(CuratorApi.collections);
    expect(saveReq.request.body).toEqual(expect.objectContaining({ name: EMPTY_COLLECTION_NAME, game_ids: [] }));
    saveReq.flush(definition({ name: EMPTY_COLLECTION_NAME }));
    httpMock.expectOne(CuratorApi.collections).flush([definition({ name: EMPTY_COLLECTION_NAME })]);
  });

  it('the detail view renders items, cover art, and unavailable-title styling', () => {
    const COVER_URL = newHttpsAddress();
    const AVAILABLE_ITEM_INDEX = 0;
    const UNAVAILABLE_ITEM_INDEX = 1;
    const fixture = createDetail(
      definitionDetail({}, [
        item(GAME_1, { cover_image_url: COVER_URL }),
        item(GAME_2, { owner_has_access: false }),
      ]),
    );

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('img[id^="collection-item-cover-"]')?.getAttribute('src')).toBe(COVER_URL);
    expect(compiled.querySelector(`#collection-item-inactive-${AVAILABLE_ITEM_INDEX}`)).toBeNull();
    expect(compiled.querySelector(`#collection-item-inactive-${UNAVAILABLE_ITEM_INDEX}`)).not.toBeNull();
  });

  it('saveMeta() renames a collection via PATCH', () => {
    const fixture = createDetail(definitionDetail());
    const h = harness(fixture);

    h.startEditingMeta();
    h.editName.set(RENAMED_NAME);
    h.editDescription.set(NEW_DESCRIPTION);
    h.saveMeta();

    const patchReq = httpMock.expectOne(CuratorApi.collectionsByDefinitionId(DEFINITION_ID));
    expect(patchReq.request.method).toBe(HttpMethods.patch);
    expect(patchReq.request.body).toEqual({ name: RENAMED_NAME, description: NEW_DESCRIPTION });
    patchReq.flush(definitionDetail({ name: RENAMED_NAME, description: NEW_DESCRIPTION }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(RENAMED_NAME);
  });

  it('removeItem() DELETEs the one title instead of rewriting the membership', () => {
    const fixture = createDetail(definitionDetail({}, [item(GAME_1), item(GAME_2)]));
    const h = harness(fixture);

    h.removeItem(GAME_1);
    const deleteReq = httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionIdItemsByGameId(DEFINITION_ID, GAME_1), method: HttpMethods.delete });
    expect(deleteReq.request.body).toBeNull();
    deleteReq.flush(null);

    httpMock
      .expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdItems(DEFINITION_ID))
      .flush({ items: [item(GAME_2)], total: 1 });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain(`Game ${GAME_1}`);
    expect(compiled.textContent).toContain(`Game ${GAME_2}`);
  });

  it('removeItem() never sends a whole-membership replacement, which would drop other pages', () => {
    const fixture = createDetail(definitionDetail({}, [item(GAME_1), item(GAME_2)]));
    const h = harness(fixture);

    h.removeItem(GAME_1);

    httpMock.expectNone((r) => r.method === HttpMethods.patch);
    httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionIdItemsByGameId(DEFINITION_ID, GAME_1), method: HttpMethods.delete }).flush(null);
    httpMock.expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdItems(DEFINITION_ID)).flush({ items: [], total: 0 });
  });

  it('opens a deep link straight at the item page the URL names', () => {
    const ITEM_PAGE = randomIntBetween(2, 5);
    createDetail(definitionDetail({ item_count: ITEM_PAGE * ITEMS_PAGE_SIZE }, [item(GAME_1)]), [], [], NO_INSTALLS, { itemPage: String(ITEM_PAGE) });

    const req = httpMock.expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdItems(DEFINITION_ID));
    expect(req.request.params.get(CuratorQueryParams.offset)).toBe(String((ITEM_PAGE - 1) * ITEMS_PAGE_SIZE));
    req.flush({ items: [item(GAME_2)], total: ITEM_PAGE * ITEMS_PAGE_SIZE });
  });

  it('takes the resolver first page as answered rather than refetching it', () => {
    createDetail(definitionDetail({ item_count: ITEMS_PAGE_SIZE + 1 }, [item(GAME_1)]));

    httpMock.expectNone((r) => r.url === CuratorApi.collectionsByDefinitionIdItems(DEFINITION_ID));
  });

  it('turns the item pager into links, and leaves an inert control where there is nowhere to go', () => {
    const fixture = createDetail(definitionDetail({ item_count: ITEMS_PAGE_SIZE + 1 }, [item(GAME_1)]));

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#collection-items-prev')?.tagName).toBe('BUTTON');
    expect(compiled.querySelector('#collection-items-next')?.tagName).toBe('A');
  });

  it('exposes which field the item list is sorted by, and its direction, to assistive tech', () => {
    const fixture = createDetail(definitionDetail({}, [item(GAME_1)]));

    const compiled: HTMLElement = fixture.nativeElement;
    const rank = compiled.querySelector('#collection-sort-rank');
    const openCritic = compiled.querySelector('#collection-sort-oc');
    expect(rank?.tagName, 'a sort control that changes the URL is a link, not a toggle button').toBe('A');
    expect(rank?.getAttribute('aria-current')).toBe(String(true));
    expect(rank?.textContent).toContain('▲');
    expect(openCritic?.getAttribute('aria-current')).toBeNull();

    setQueryParams({ itemSort: CollectionItemSortFields.ocScore });
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdItems(DEFINITION_ID) && r.params.get(CuratorQueryParams.sort) === CollectionItemSortFields.ocScore)
      .flush({ items: [item(GAME_1)], total: 1 });
    fixture.detectChanges();

    expect(compiled.querySelector('#collection-sort-rank')?.getAttribute('aria-current')).toBeNull();
    expect(compiled.querySelector('#collection-sort-oc')?.getAttribute('aria-current')).toBe(String(true));
  });

  it('setVisibility() shows a copyable share link once a collection stops being private', () => {
    const fixture = createDetail(definitionDetail({ visibility: CollectionVisibilities.private, share_slug: SHARE_SLUG }));
    const h = harness(fixture);

    h.setVisibility(CollectionVisibilities.unlisted);
    const putReq = httpMock.expectOne(CuratorApi.collectionsByDefinitionIdVisibility(DEFINITION_ID));
    expect(putReq.request.method).toBe(HttpMethods.put);
    expect(putReq.request.body).toEqual({ visibility: CollectionVisibilities.unlisted });
    putReq.flush(definition({ visibility: CollectionVisibilities.unlisted, share_slug: SHARE_SLUG }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#collection-share-url')?.getAttribute('data-share-slug')).toBe(SHARE_SLUG);
  });

  it('deleteDefinition() removes the collection and navigates back to the list rather than refetching it', async () => {
    const fixture = createDetail(definitionDetail());
    const h = harness(fixture);

    h.confirmDelete();
    h.deleteDefinition();
    httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionId(DEFINITION_ID), method: HttpMethods.delete }).flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(AppUrls.collections);
    httpMock.expectNone(CuratorApi.collections);
  });

  it('runSelected() proposes a fresh list and adoptRunResult() PATCHes it as the new membership', () => {
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_0)]));
    const h = harness(fixture);
    fixture.detectChanges();

    h.runSelected();
    httpMock.expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdRuns(DEFINITION_ID)).flush({
      run_id: RUN_ID,
      included: [game(GAME_1)],
      excluded: [],
      included_total: 1,
      excluded_total: 0,
      included_game_ids: [GAME_1],
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();

    h.adoptRunResult();
    const patchReq = httpMock.expectOne(CuratorApi.collectionsByDefinitionId(DEFINITION_ID));
    expect(patchReq.request.body).toEqual({ game_ids: [GAME_1] });
    patchReq.flush(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]));
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(`Game ${GAME_1}`);
  });

  it('a truncated run says so rather than offering a pager that would re-run and re-persist it', () => {
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_0)]));
    const h = harness(fixture);
    fixture.detectChanges();

    const proposedBeyondOnePage = randomIntBetween(1, RESULT_PAGE_SIZE);
    const includedTotal = RESULT_PAGE_SIZE + proposedBeyondOnePage;
    const allIncludedIds = Array.from({ length: includedTotal }, (_, index) => `g${index}`);

    h.runSelected();
    const runReq = httpMock.expectOne((r) => r.url === CuratorApi.collectionsByDefinitionIdRuns(DEFINITION_ID));
    expect(Number(runReq.request.params.get(CuratorQueryParams.offset))).toBe(0);
    runReq.flush({
      run_id: RUN_ID,
      included: allIncludedIds.slice(0, RESULT_PAGE_SIZE).map((id) => game(id)),
      excluded: [],
      included_total: includedTotal,
      excluded_total: 0,
      included_game_ids: allIncludedIds,
      used_gb: SIZE_GB,
      ignored_filters: [],
      excluded_for_missing_trophy_data: 0,
    });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#run-truncation-note')?.textContent).toContain(
      `Each list shows its first ${RESULT_PAGE_SIZE}`,
    );
    expect(compiled.querySelector('#run-next')).toBeNull();
    httpMock.verify();
  });

  it('install toggle opens from the resolved install state and persists via PUT for capacity_fill', () => {
    const fixture = createDetail(
      definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]),
      [],
      [],
      { ...NO_INSTALLS, installedGameIds: [GAME_0] },
    );
    const h = harness(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#collection-item-install-0')?.getAttribute('data-installed')).toBe(String(false));

    h.toggleInstall(GAME_1);
    const installReq = httpMock.expectOne(CuratorApi.consolesByConsoleIdInstallsByGameId(CONSOLE_ID, GAME_1));
    expect(installReq.request.method).toBe(HttpMethods.put);
    expect(installReq.request.body).toEqual({ installed: true });
    installReq.flush({ console_id: CONSOLE_ID, game_id: GAME_1, installed: true });
    fixture.detectChanges();

    expect(compiled.querySelector('#collection-item-install-0')?.getAttribute('data-installed')).toBe(String(true));
  });

  it('device install toggle opens from the resolved device installs and persists via PUT, without auto-carrying to another device or the console', () => {
    const M2_CAPACITY_GB = newCount();
    const USB_CAPACITY_GB = newCount();
    const fixture = createDetail(
      definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]),
      [],
      [],
      {
        installedGameIds: [],
        attachedDevices: [
          {
            device_id: M2_DEVICE_ID,
            console_id: CONSOLE_ID,
            name: M2_DEVICE_NAME,
            kind: StorageKinds.m2,
            capacity_gb: M2_CAPACITY_GB,
            buffer_gb: 0,
            effective_capacity_gb: M2_CAPACITY_GB,
          },
          {
            device_id: USB_DEVICE_ID,
            console_id: CONSOLE_ID,
            name: USB_DEVICE_NAME,
            kind: StorageKinds.usb,
            capacity_gb: USB_CAPACITY_GB,
            buffer_gb: 0,
            effective_capacity_gb: USB_CAPACITY_GB,
          },
        ],
        deviceInstalls: [
          { deviceId: M2_DEVICE_ID, gameIds: [GAME_0] },
          { deviceId: USB_DEVICE_ID, gameIds: [] },
        ],
      },
    );
    const h = harness(fixture);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(`Mark on ${M2_DEVICE_NAME}`);
    expect(compiled.textContent).toContain(`Mark on ${USB_DEVICE_NAME}`);
    expect(compiled.querySelector('#collection-item-install-0')?.getAttribute('data-installed')).toBe(String(false));

    h.toggleDeviceInstall(M2_DEVICE_ID, GAME_1);
    const installReq = httpMock.expectOne(CuratorApi.storageDevicesByDeviceIdInstallsByGameId(M2_DEVICE_ID, GAME_1));
    expect(installReq.request.method).toBe(HttpMethods.put);
    expect(installReq.request.body).toEqual({ installed: true });
    installReq.flush({ device_id: M2_DEVICE_ID, game_id: GAME_1, installed: true });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(`On ${M2_DEVICE_NAME}`);
    expect(compiled.textContent).toContain(`Mark on ${USB_DEVICE_NAME}`);
    expect(compiled.querySelector('#collection-item-install-0')?.getAttribute('data-installed')).toBe(String(false));
  });

  it('measured-size panel lazily hydrates on first expand and PUTs a new contribution', () => {
    const PS5_SIZE_GB = newCount();
    const PS4_SIZE_GB = newCount();
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]));
    const h = harness(fixture);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    httpMock.expectNone(CuratorApi.gamesByGameIdMeasuredSizes(GAME_1));

    h.toggleMeasuredSizePanel(GAME_1);
    httpMock.expectOne(CuratorApi.gamesByGameIdMeasuredSizes(GAME_1)).flush([
      { game_id: GAME_1, platform: ConsolePlatforms.ps5, size_gb: PS5_SIZE_GB, recorded_by: newId(), recorded_at: newUtcInstant() },
    ]);
    fixture.detectChanges();

    expect(compiled.textContent).toContain(`${ConsolePlatforms.ps5}: ${PS5_SIZE_GB} GB`);

    h.measuredSizePlatform.set(ConsolePlatforms.ps4);
    h.measuredSizeValue.set(PS4_SIZE_GB);
    h.submitMeasuredSize(GAME_1);
    const putReq = httpMock.expectOne(CuratorApi.gamesByGameIdMeasuredSizesByPlatform(GAME_1, ConsolePlatforms.ps4));
    expect(putReq.request.method).toBe(HttpMethods.put);
    expect(putReq.request.body).toEqual({ size_gb: PS4_SIZE_GB });
    putReq.flush({ game_id: GAME_1, platform: ConsolePlatforms.ps4, size_gb: PS4_SIZE_GB, recorded_by: newId(), recorded_at: newUtcInstant() });
    fixture.detectChanges();

    expect(compiled.textContent).toContain(`${ConsolePlatforms.ps4}: ${PS4_SIZE_GB} GB`);
    expect(compiled.textContent).toContain(`${ConsolePlatforms.ps5}: ${PS5_SIZE_GB} GB`);

    h.toggleMeasuredSizePanel(GAME_1);
    h.toggleMeasuredSizePanel(GAME_1);
    httpMock.expectNone(CuratorApi.gamesByGameIdMeasuredSizes(GAME_1));
  });

  it('measured-size panel offers every platform Curator accepts a size for', () => {
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: CONSOLE_ID }, [item(GAME_1)]));
    const h = harness(fixture);
    fixture.detectChanges();

    h.toggleMeasuredSizePanel(GAME_1);
    httpMock.expectOne(CuratorApi.gamesByGameIdMeasuredSizes(GAME_1)).flush([]);
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector(`#measured-size-platform-${GAME_1}`);
    const labels = Array.from(select?.querySelectorAll('option') ?? []).map((option) => option.textContent?.trim());
    expect(labels).toEqual(CONSOLE_PLATFORM_OPTIONS);
  });

  it('install toggle surfaces an inline 404 error when the console is unknown', () => {
    const fixture = createDetail(definitionDetail({ kind: CollectionKinds.capacityFill, console_id: UNKNOWN_CONSOLE_ID }, [item(GAME_1)]));
    const h = harness(fixture);

    h.toggleInstall(GAME_1);
    httpMock
      .expectOne(CuratorApi.consolesByConsoleIdInstallsByGameId(UNKNOWN_CONSOLE_ID, GAME_1))
      .flush(null, { status: HttpStatusCode.NotFound, statusText: HttpStatusCode[HttpStatusCode.NotFound] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`Console '${UNKNOWN_CONSOLE_ID}' not found`);
  });

  it('showFollowed() lists followed collections and unfollow() removes one', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showFollowed();
    httpMock.expectOne(CuratorApi.collectionsFollowed).flush([definition({ definition_id: FOLLOWED_DEFINITION_ID, name: FOLLOWED_COLLECTION_NAME })]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(FOLLOWED_COLLECTION_NAME);

    h.unfollow(FOLLOWED_DEFINITION_ID);
    httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionIdFollow(FOLLOWED_DEFINITION_ID), method: HttpMethods.delete }).flush(null);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(FOLLOWED_COLLECTION_NAME);
  });

  describe('viewer mode', () => {
    const VIEWER_ITEM_COUNT = newCount();

    function profileDefinition(overrides: Partial<ProfileDefinitionResponse> = {}): ProfileDefinitionResponse {
      return { definition_id: DEFINITION_ID, name: DEFINITION_NAME, kind: CollectionKinds.filterList, console_id: null, item_count: VIEWER_ITEM_COUNT, ...overrides };
    }

    function configureForViewer(routeSub: string, resolved: ResolvedCollections): void {
      configure({ sub: routeSub }, resolved);
    }

    it("renders another user's saved collections read-only, with a follow toggle", () => {
      configureForViewer(OTHER_SUB, {
        mode: CollectionsModes.viewer,
        definitions: [profileDefinition()],
        followedIds: [],
      });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain(DEFINITION_NAME);
      expect(compiled.textContent).toContain(`${VIEWER_ITEM_COUNT} games`);
      expect(compiled.querySelector('#collection-follow-0')?.getAttribute('aria-pressed')).toBe(String(false));

      harness(fixture).toggleFollowViewerDefinition(DEFINITION_ID);
      const followReq = httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionIdFollow(DEFINITION_ID), method: HttpMethods.post });
      followReq.flush(null);
      fixture.detectChanges();

      expect(compiled.querySelector('#collection-follow-0')?.getAttribute('aria-pressed')).toBe(String(true));
    });

    it('shows an empty state for another user with no saved collections', () => {
      configureForViewer(OTHER_SUB, { mode: CollectionsModes.viewer, definitions: [], followedIds: [] });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('#collections-viewer-empty')).not.toBeNull();
    });

    it('opens the follow toggle as already-following for a collection the resolver says the viewer follows', () => {
      configureForViewer(OTHER_SUB, {
        mode: CollectionsModes.viewer,
        definitions: [profileDefinition()],
        followedIds: [DEFINITION_ID],
      });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('#collection-follow-0')?.getAttribute('aria-pressed')).toBe(String(true));
    });

    it('shows an inline message when the resolver reports the section is not public', () => {
      configureForViewer(OTHER_SUB, { mode: CollectionsModes.viewerForbidden });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      const forbidden = (fixture.nativeElement as HTMLElement).querySelector('#collections-forbidden');
      expect(forbidden?.textContent).toContain(COLLECTIONS_FORBIDDEN_MESSAGE);
    });

    it('shows a generic error message when the resolver reports a non-403 failure', () => {
      configureForViewer(OTHER_SUB, { mode: CollectionsModes.viewerError });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(USER_COLLECTIONS_LOAD_ERROR);
    });
  });
});
