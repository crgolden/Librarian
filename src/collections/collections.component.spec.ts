import { Location } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CollectionsComponent } from './collections.component';
import { ResolvedCollections } from './collections.resolver';
import {
  CollectionGameResponse,
  CollectionItemResponse,
  CollectionPreviewResponse,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';

function definition(overrides: Partial<DefinitionResponse> = {}): DefinitionResponse {
  return {
    definition_id: 'd1',
    name: 'Weekend picks',
    description: null,
    kind: 'filter_list',
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    include_inactive: false,
    min_percent_completed: null,
    sort_order: null,
    exclude_installed_on: [],
    visibility: 'private',
    share_slug: 'abc123xyz',
    item_count: 0,
    ...overrides,
  };
}

function item(id: string, overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    game_id: id,
    rank: 1,
    title: `Game ${id}`,
    franchise: 'Franchise',
    genre: 'RPG',
    aaa_tier: 'AAA',
    critical_score: 85,
    oc_score: 82,
    psn_rating: 4.5,
    cover_image_url: null,
    owner_has_access: true,
    ...overrides,
  };
}

function definitionDetail(
  overrides: Partial<DefinitionResponse> = {},
  items: CollectionItemResponse[] = [],
): DefinitionDetailResponse {
  return { ...definition(overrides), items };
}

function game(id: string, percentCompleted: number | null = null): CollectionGameResponse {
  return {
    game_id: id,
    title: `Game ${id}`,
    genre: 'RPG',
    aaa_tier: 'AAA',
    franchise: 'Franchise',
    composite_score: 8.5,
    rank_score: 1,
    size_gb: 40,
    percent_completed: percentCompleted,
  };
}

/** Preview and run now carry `limit`/`offset`, and `expectOne(string)` matches the URL *with* params. */
const previewUrl = (r: { url: string }): boolean => r.url === '/curator/api/collections/preview';

function emptyPreview(): CollectionPreviewResponse {
  return { included: [], excluded: [], included_total: 0, excluded_total: 0, included_game_ids: [], used_gb: null };
}

interface CollectionsHarness {
  kind: { set(value: string): void };
  consoleId: { set(value: string): void };
  genreFilter: { set(value: string[]): void };
  name: { set(value: string): void };
  minPercentCompleted: { set(value: number | null): void };
  editName: { set(value: string): void };
  editDescription: { set(value: string): void };
  showCreate(): void;
  showFollowed(): void;
  preview(): void;
  saveDefinition(): void;
  openDefinition(definitionId: string): void;
  backToList(): void;
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

function activatedRouteStub(
  params: Record<string, string>,
  resolved: ResolvedCollections,
  genres: string[] = [],
): ActivatedRoute {
  return {
    snapshot: { paramMap: convertToParamMap(params), data: { collections: resolved, genres } },
  } as unknown as ActivatedRoute;
}

describe('CollectionsComponent', () => {
  let httpMock: HttpTestingController;

  function configure(
    params: Record<string, string>,
    resolved: ResolvedCollections,
    genres: string[] = [],
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteStub(params, resolved, genres) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    configure({}, { mode: 'list', definitions: [], consoles: [] });
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(
    definitions: DefinitionResponse[],
    consoles: ConsoleResponse[] = [],
    genres: string[] = [],
  ): ComponentFixture<CollectionsComponent> {
    configure({}, { mode: 'list', definitions, consoles }, genres);
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  describe('genre filter', () => {
    it('offers one option per genre resolved for the route, in a multi-select', () => {
      const fixture = createAndLoad([], [], ['RPG', 'Shooter', 'Puzzle']);
      harness(fixture).showCreate();
      fixture.detectChanges();

      const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#genreFilter');
      expect(select).not.toBeNull();
      expect(select?.multiple).toBe(true);
      expect(Array.from(select?.options ?? []).map((option) => option.textContent)).toEqual([
        'RPG',
        'Shooter',
        'Puzzle',
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
      const fixture = createAndLoad([], [], ['RPG', 'Shooter']);
      const component = harness(fixture);
      component.showCreate();
      component.genreFilter.set(['RPG', 'Shooter']);
      fixture.detectChanges();

      component.preview();

      const request = httpMock.expectOne(previewUrl);
      expect(request.request.body.genre_filter).toEqual(['RPG', 'Shooter']);
      request.flush(emptyPreview());
    });
  });

  it('shows an empty state when there are no saved collections', () => {
    const fixture = createAndLoad([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("haven't saved any collections");
  });

  it('lists saved collections with their item count and visibility', () => {
    const fixture = createAndLoad([definition({ item_count: 3, visibility: 'public' })]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Weekend picks');
    expect(text).toContain('3 games');
    expect(text).toContain('public');
  });

  it('shows a humanized label for a collection kind instead of the raw enum value', () => {
    const fixture = createAndLoad([
      definition({ definition_id: 'd1', kind: 'filter_list' }),
      definition({ definition_id: 'd2', kind: 'capacity_fill', console_id: 'c1' }),
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Filter list');
    expect(text).toContain('Capacity fill');
    expect(text).not.toContain('filter_list');
    expect(text).not.toContain('capacity_fill');
  });

  it("shows a capacity-fill collection's console name in the detail view, not its raw id", () => {
    const consoles: ConsoleResponse[] = [
      {
        console_id: 'c1',
        name: 'Living Room PS5',
        platform: 'ps5',
        raw_capacity_gb: 800,
        model: null,
        update_buffer_gb: 40,
        effective_capacity_gb: 760,
        routing_genres: [],
        fill_order: 0,
        capacity_is_default: false,
      },
    ];
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })], consoles);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: [] });
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Console: Living Room PS5');
    expect(text).not.toContain('Console: c1');
  });

  it('opening a definition updates the URL to /collections/d/:definitionId, and going back restores /collections', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    const location = TestBed.inject(Location);

    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail());
    fixture.detectChanges();

    expect(location.path()).toBe('/collections/d/d1');

    h.backToList();
    httpMock.expectOne('/curator/api/collections').flush([]);
    fixture.detectChanges();

    expect(location.path()).toBe('/collections');
  });

  it('a direct deep link to /collections/d/:definitionId opens the detail view immediately, without loading the list first', () => {
    configure({ definitionId: 'd1' }, { mode: 'detail', definition: definitionDetail(), consoles: [] });

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Weekend picks');
    httpMock.expectNone((req) => req.url === '/curator/api/collections');
    httpMock.expectNone((req) => req.url === '/curator/api/collections/d1');
  });

  it('a deep link to a definition that fails to load shows the detail error, not the list', () => {
    configure({ definitionId: 'd1' }, { mode: 'detail-error', consoles: [] });

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load this collection.');
    httpMock.expectNone((req) => req.url === '/curator/api/collections');
  });

  it('shows the list error when the resolver could not load saved collections', () => {
    configure({}, { mode: 'list-error', consoles: [] });

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load your saved collections.');
  });

  it('preview() shows a validation error and makes no request when capacity_fill has no console', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();
    h.kind.set('capacity_fill');

    h.preview();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A console is required for a capacity-fill collection.',
    );
    httpMock.expectNone('/curator/api/collections/preview');
  });

  it('preview() sends minPercentCompleted through to the request body', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();
    h.minPercentCompleted.set(50);

    h.preview();
    const previewReq = httpMock.expectOne(previewUrl);
    expect(previewReq.request.body).toEqual(expect.objectContaining({ min_percent_completed: 50, include_inactive: false }));
    expect(previewReq.request.params.get('limit')).toBe('50');
    expect(previewReq.request.params.get('offset')).toBe('0');
    previewReq.flush(emptyPreview());
  });

  it('saveDefinition() sends every included id, not just the page the preview rendered', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    // One page of objects, but the full membership alongside it — saving must use the latter.
    httpMock.expectOne(previewUrl).flush({
      included: [game('g1', 87)],
      excluded: [],
      included_total: 3,
      excluded_total: 0,
      included_game_ids: ['g1', 'g2', 'g3'],
      used_gb: 40,
    });
    fixture.detectChanges();

    h.name.set('My picks');
    h.saveDefinition();
    const saveReq = httpMock.expectOne('/curator/api/collections');
    expect(saveReq.request.body).toEqual(expect.objectContaining({ game_ids: ['g1', 'g2', 'g3'] }));
    saveReq.flush(definition({ name: 'My picks' }));

    httpMock.expectOne('/curator/api/collections').flush([definition({ name: 'My picks' })]);
  });

  it('preview() renders included/excluded games, then saveDefinition() sends the preview game_ids', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    const previewReq = httpMock.expectOne(previewUrl);
    previewReq.flush({
      included: [game('g1', 87)],
      excluded: [],
      included_total: 1,
      excluded_total: 0,
      included_game_ids: ['g1'],
      used_gb: 40,
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Game g1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('87% complete');

    h.name.set('My picks');
    h.saveDefinition();
    const saveReq = httpMock.expectOne('/curator/api/collections');
    expect(saveReq.request.method).toBe('POST');
    expect(saveReq.request.body).toEqual(expect.objectContaining({ name: 'My picks', kind: 'filter_list', game_ids: ['g1'] }));
    saveReq.flush(definition({ name: 'My picks' }));

    httpMock.expectOne('/curator/api/collections').flush([definition({ name: 'My picks' })]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('My picks');
  });

  it('saveDefinition() without a preview saves an empty collection rather than silently dropping membership', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.name.set('Empty for now');
    h.saveDefinition();
    const saveReq = httpMock.expectOne('/curator/api/collections');
    expect(saveReq.request.body).toEqual(expect.objectContaining({ name: 'Empty for now', game_ids: [] }));
    saveReq.flush(definition({ name: 'Empty for now' }));
    httpMock.expectOne('/curator/api/collections').flush([definition({ name: 'Empty for now' })]);
  });

  it('openDefinition() loads the detail view with items, cover art, and unavailable-title styling', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    fixture.detectChanges();

    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(
        definitionDetail({}, [
          item('g1', { cover_image_url: 'https://img.example/g1.jpg' }),
          item('g2', { owner_has_access: false }),
        ]),
      );
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('img.cover-art')?.getAttribute('src')).toBe('https://img.example/g1.jpg');
    expect(compiled.textContent).toContain("No longer in owner's library");
  });

  it('saveMeta() renames a collection via PATCH', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail());
    fixture.detectChanges();

    h.startEditingMeta();
    h.editName.set('Renamed');
    h.editDescription.set('New description');
    h.saveMeta();

    const patchReq = httpMock.expectOne('/curator/api/collections/d1');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ name: 'Renamed', description: 'New description' });
    patchReq.flush(definitionDetail({ name: 'Renamed', description: 'New description' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Renamed');
  });

  it('removeItem() DELETEs the one title instead of rewriting the membership', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail({}, [item('g1'), item('g2')]));
    fixture.detectChanges();

    h.removeItem('g1');
    const deleteReq = httpMock.expectOne({ url: '/curator/api/collections/d1/items/g1', method: 'DELETE' });
    expect(deleteReq.request.body).toBeNull();
    deleteReq.flush(null);

    httpMock
      .expectOne((r) => r.url === '/curator/api/collections/d1/items')
      .flush({ items: [item('g2')], total: 1 });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Game g1');
    expect(compiled.textContent).toContain('Game g2');
  });

  it('removeItem() never sends a whole-membership replacement, which would drop other pages', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail({}, [item('g1'), item('g2')]));
    fixture.detectChanges();

    h.removeItem('g1');

    httpMock.expectNone((r) => r.method === 'PATCH');
    httpMock.expectOne({ url: '/curator/api/collections/d1/items/g1', method: 'DELETE' }).flush(null);
    httpMock.expectOne((r) => r.url === '/curator/api/collections/d1/items').flush({ items: [], total: 0 });
  });

  it('setVisibility() shows a copyable share link once a collection stops being private', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail({ visibility: 'private', share_slug: 'slug1' }));
    fixture.detectChanges();

    h.setVisibility('unlisted');
    const putReq = httpMock.expectOne('/curator/api/collections/d1/visibility');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ visibility: 'unlisted' });
    putReq.flush(definition({ visibility: 'unlisted', share_slug: 'slug1' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('/c/slug1');
  });

  it('deleteDefinition() removes the collection and returns to the list', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail());
    fixture.detectChanges();

    h.confirmDelete();
    h.deleteDefinition();
    httpMock.expectOne({ url: '/curator/api/collections/d1', method: 'DELETE' }).flush(null);
    httpMock.expectOne('/curator/api/collections').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("haven't saved any collections");
  });

  it('runSelected() proposes a fresh list and adoptRunResult() PATCHes it as the new membership', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g0')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: [] });
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    h.runSelected();
    httpMock.expectOne((r) => r.url === '/curator/api/collections/d1/runs').flush({
      run_id: 'r1',
      included: [game('g1')],
      excluded: [],
      included_total: 1,
      excluded_total: 0,
      included_game_ids: ['g1'],
      used_gb: 40,
    });
    fixture.detectChanges();

    h.adoptRunResult();
    const patchReq = httpMock.expectOne('/curator/api/collections/d1');
    expect(patchReq.request.body).toEqual({ game_ids: ['g1'] });
    patchReq.flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Game g1');
  });

  it('install toggle hydrates from GET installs and persists via PUT for capacity_fill', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: ['g0'] });
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Mark installed');

    h.toggleInstall('g1');
    const installReq = httpMock.expectOne('/curator/api/consoles/c1/installs/g1');
    expect(installReq.request.method).toBe('PUT');
    expect(installReq.request.body).toEqual({ installed: true });
    installReq.flush({ console_id: 'c1', game_id: 'g1', installed: true });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Installed');
  });

  it('device install toggle hydrates from GET storage-devices + installs and persists via PUT', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: [] });
    httpMock.expectOne('/curator/api/storage-devices').flush([
      {
        device_id: 'dev1',
        console_id: 'c1',
        name: 'M.2 Expansion',
        kind: 'm2',
        capacity_gb: 1000,
        buffer_gb: 0,
        effective_capacity_gb: 1000,
      },
      {
        device_id: 'dev2',
        console_id: 'some-other-console',
        name: 'Unrelated USB',
        kind: 'usb',
        capacity_gb: 500,
        buffer_gb: 0,
        effective_capacity_gb: 500,
      },
    ]);
    httpMock.expectOne('/curator/api/storage-devices/dev1/installs').flush({ game_ids: ['g0'] });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Mark on M.2 Expansion');
    expect(compiled.textContent).not.toContain('Unrelated USB');

    h.toggleDeviceInstall('dev1', 'g1');
    const installReq = httpMock.expectOne('/curator/api/storage-devices/dev1/installs/g1');
    expect(installReq.request.method).toBe('PUT');
    expect(installReq.request.body).toEqual({ installed: true });
    installReq.flush({ device_id: 'dev1', game_id: 'g1', installed: true });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('On M.2 Expansion');
  });

  it('measured-size panel lazily hydrates on first expand and PUTs a new contribution', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: [] });
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    httpMock.expectNone('/curator/api/games/g1/measured-sizes');

    h.toggleMeasuredSizePanel('g1');
    httpMock.expectOne('/curator/api/games/g1/measured-sizes').flush([
      { game_id: 'g1', platform: 'PS5', size_gb: 42.5, recorded_by: 'sub-other', recorded_at: '2026-01-01T00:00:00Z' },
    ]);
    fixture.detectChanges();

    expect(compiled.textContent).toContain('PS5: 42.5 GB');

    h.measuredSizePlatform.set('PS4');
    h.measuredSizeValue.set(30);
    h.submitMeasuredSize('g1');
    const putReq = httpMock.expectOne('/curator/api/games/g1/measured-sizes/PS4');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ size_gb: 30 });
    putReq.flush({ game_id: 'g1', platform: 'PS4', size_gb: 30, recorded_by: 'sub-a', recorded_at: '2026-01-02T00:00:00Z' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('PS4: 30 GB');
    expect(compiled.textContent).toContain('PS5: 42.5 GB');

    h.toggleMeasuredSizePanel('g1');
    h.toggleMeasuredSizePanel('g1');
    httpMock.expectNone('/curator/api/games/g1/measured-sizes');
  });

  it('install toggle surfaces an inline 404 error when the console is unknown', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'unknown-console' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'unknown-console' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/unknown-console/installs').flush(null, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne('/curator/api/storage-devices').flush([]);
    fixture.detectChanges();

    h.toggleInstall('g1');
    httpMock
      .expectOne('/curator/api/consoles/unknown-console/installs/g1')
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Console 'unknown-console' not found");
  });

  it('showFollowed() lists followed collections and unfollow() removes one', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showFollowed();
    httpMock.expectOne('/curator/api/collections/followed').flush([definition({ definition_id: 'd2', name: 'Someone else’s picks' })]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Someone else’s picks');

    h.unfollow('d2');
    httpMock.expectOne({ url: '/curator/api/collections/d2/follow', method: 'DELETE' }).flush(null);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Someone else’s picks');
  });

  describe('viewer mode', () => {
    function profileDefinition(overrides: Partial<ProfileDefinitionResponse> = {}): ProfileDefinitionResponse {
      return { definition_id: 'd1', name: 'Weekend picks', kind: 'filter_list', console_id: null, item_count: 5, ...overrides };
    }

    function configureForViewer(routeSub: string, resolved: ResolvedCollections): void {
      configure({ sub: routeSub }, resolved);
    }

    it("renders another user's saved collections read-only, with a follow toggle", () => {
      configureForViewer('other-sub', { mode: 'viewer', definitions: [profileDefinition()] });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/collections/followed').flush([]);
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain('Weekend picks');
      expect(compiled.textContent).toContain('5 games');
      const followButton = compiled.querySelector('button');
      expect(followButton?.textContent?.trim()).toBe('Follow');

      harness(fixture).toggleFollowViewerDefinition('d1');
      const followReq = httpMock.expectOne({ url: '/curator/api/collections/d1/follow', method: 'POST' });
      followReq.flush(null);
      fixture.detectChanges();

      expect(compiled.querySelector('button')?.textContent?.trim()).toBe('Unfollow');
    });

    it('shows an empty state for another user with no saved collections', () => {
      configureForViewer('other-sub', { mode: 'viewer', definitions: [] });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/collections/followed').flush([]);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No saved collections yet.');
    });

    it('shows an inline message when the resolver reports the section is not public', () => {
      configureForViewer('other-sub', { mode: 'viewer-forbidden' });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("This section isn't available.");
    });

    it('shows a generic error message when the resolver reports a non-403 failure', () => {
      configureForViewer('other-sub', { mode: 'viewer-error' });

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("Unable to load this user's collections.");
    });
  });
});
