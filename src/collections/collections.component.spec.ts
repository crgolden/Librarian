import { Location } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { CollectionsComponent } from './collections.component';
import {
  CollectionGameResponse,
  CollectionItemResponse,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

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

interface CollectionsHarness {
  kind: { set(value: string): void };
  consoleId: { set(value: string): void };
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
  unfollow(definitionId: string): void;
  toggleFollowViewerDefinition(definitionId: string): void;
}

function harness(fixture: ComponentFixture<CollectionsComponent>): CollectionsHarness {
  return fixture.componentInstance as unknown as CollectionsHarness;
}

function activatedRouteWithSub(sub: string | null): ActivatedRoute {
  return { snapshot: { paramMap: convertToParamMap(sub !== null ? { sub } : {}) } } as unknown as ActivatedRoute;
}

function authServiceWithSub(sub: string | null): AuthService {
  return { sub: () => sub } as unknown as AuthService;
}

describe('CollectionsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteWithSub(null) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createAndLoad(
    definitions: DefinitionResponse[],
    consoles: ConsoleResponse[] = [],
  ): ComponentFixture<CollectionsComponent> {
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/collections').flush(definitions);
    httpMock.expectOne('/curator/api/consoles').flush(consoles);
    fixture.detectChanges();
    return fixture;
  }

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
      },
    ];
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })], consoles);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'c1' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/c1/installs').flush({ game_ids: [] });
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
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ definitionId: 'd1' }) } } as unknown as ActivatedRoute,
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();

    httpMock.expectOne('/curator/api/consoles').flush([]);
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Weekend picks');
    httpMock.expectNone((req) => req.url === '/curator/api/collections');
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
    const previewReq = httpMock.expectOne('/curator/api/collections/preview');
    expect(previewReq.request.body).toEqual(expect.objectContaining({ min_percent_completed: 50, include_inactive: false }));
    previewReq.flush({ included: [], excluded: [], used_gb: null });
  });

  it('preview() renders included/excluded games, then saveDefinition() sends the preview game_ids', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    const previewReq = httpMock.expectOne('/curator/api/collections/preview');
    previewReq.flush({ included: [game('g1', 87)], excluded: [], used_gb: 40 });
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
    // Regression test: Librarian's original SaveDefinitionRequest never sent game_ids at all, so every
    // saved collection silently had zero members no matter what the create form said. This asserts the
    // request is explicit about that (game_ids: []), not merely "some field was missing."
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

  it('removeItem() PATCHes the remaining game_ids', () => {
    const fixture = createAndLoad([definition()]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock.expectOne('/curator/api/collections/d1').flush(definitionDetail({}, [item('g1'), item('g2')]));
    fixture.detectChanges();

    h.removeItem('g1');
    const patchReq = httpMock.expectOne('/curator/api/collections/d1');
    expect(patchReq.request.body).toEqual({ game_ids: ['g2'] });
    patchReq.flush(definitionDetail({}, [item('g2')]));
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Game g1');
    expect(compiled.textContent).toContain('Game g2');
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
    fixture.detectChanges();

    h.runSelected();
    httpMock.expectOne('/curator/api/collections/d1/runs').flush({ run_id: 'r1', included: [game('g1')], excluded: [], used_gb: 40 });
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

  it('install toggle surfaces an inline 404 error when the console is unknown', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'unknown-console' })]);
    const h = harness(fixture);
    h.openDefinition('d1');
    httpMock
      .expectOne('/curator/api/collections/d1')
      .flush(definitionDetail({ kind: 'capacity_fill', console_id: 'unknown-console' }, [item('g1')]));
    httpMock.expectOne('/curator/api/consoles/unknown-console/installs').flush(null, { status: 404, statusText: 'Not Found' });
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

    // The outer beforeEach already injects HttpTestingController, which instantiates the testing
    // module -- TestBed.overrideProvider() can no longer be used past that point. Reconfigure a
    // fresh module per viewer test instead, with route/auth providers specific to that test.
    function configureForViewer(routeSub: string, ownSub: string | null): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CollectionsComponent],
        providers: [
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: activatedRouteWithSub(routeSub) },
          { provide: AuthService, useValue: authServiceWithSub(ownSub) },
        ],
      });
      httpMock = TestBed.inject(HttpTestingController);
    }

    it('redirects to the bare /collections path without fetching when :sub equals the signed-in user\'s own sub', () => {
      configureForViewer('own-sub', 'own-sub');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();

      expect(navigateSpy).toHaveBeenCalledWith(['/collections'], { replaceUrl: true });
      httpMock.expectNone('/curator/api/collections');
      httpMock.expectNone('/curator/api/users/own-sub/collections');
    });

    it("renders another user's saved collections read-only, with a follow toggle", () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/users/other-sub/collections').flush([profileDefinition()]);
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
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/users/other-sub/collections').flush([]);
      httpMock.expectOne('/curator/api/collections/followed').flush([]);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No saved collections yet.');
    });

    it('shows an inline message on a 403 (section not public)', () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock
        .expectOne('/curator/api/users/other-sub/collections')
        .flush(null, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("This section isn't available.");
    });

    it('shows a generic error message on a non-403 failure', () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock
        .expectOne('/curator/api/users/other-sub/collections')
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain("Unable to load this user's collections.");
    });
  });
});
