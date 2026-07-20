import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { CollectionsComponent } from './collections.component';
import { CollectionGameResponse, DefinitionResponse, ProfileDefinitionResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';

function definition(overrides: Partial<DefinitionResponse> = {}): DefinitionResponse {
  return {
    definition_id: 'd1',
    name: 'Weekend picks',
    kind: 'filter_list',
    console_id: null,
    genre_filter: [],
    min_score: null,
    aaa_tier_filter: null,
    ...overrides,
  };
}

function game(id: string): CollectionGameResponse {
  return {
    game_id: id,
    title: `Game ${id}`,
    genre: 'RPG',
    aaa_tier: 'AAA',
    franchise: 'Franchise',
    composite_score: 8.5,
    rank_score: 1,
    size_gb: 40,
  };
}

interface CollectionsHarness {
  kind: { set(value: string): void };
  consoleId: { set(value: string): void };
  name: { set(value: string): void };
  showCreate(): void;
  preview(): void;
  saveDefinition(): void;
  selectDefinition(def: DefinitionResponse): void;
  runSelected(): void;
  toggleInstall(g: CollectionGameResponse): void;
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
        provideHttpClient(),
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

  function createAndLoad(definitions: DefinitionResponse[]): ComponentFixture<CollectionsComponent> {
    const fixture = TestBed.createComponent(CollectionsComponent);
    fixture.detectChanges();
    httpMock.expectOne('/curator/api/collections').flush(definitions);
    fixture.detectChanges();
    return fixture;
  }

  it('shows an empty state when there are no saved collections', () => {
    const fixture = createAndLoad([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("haven't saved any collections");
  });

  it('lists saved collections', () => {
    const fixture = createAndLoad([definition()]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Weekend picks');
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

  it('preview() renders included/excluded games, then saveDefinition() persists and returns to the list', () => {
    const fixture = createAndLoad([]);
    const h = harness(fixture);
    h.showCreate();
    fixture.detectChanges();

    h.preview();
    const previewReq = httpMock.expectOne('/curator/api/collections/preview');
    previewReq.flush({ included: [game('g1')], excluded: [], used_gb: 40 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Game g1');

    h.name.set('My picks');
    h.saveDefinition();
    const saveReq = httpMock.expectOne('/curator/api/collections');
    expect(saveReq.request.method).toBe('POST');
    expect(saveReq.request.body).toEqual(
      expect.objectContaining({ name: 'My picks', kind: 'filter_list' }),
    );
    saveReq.flush(definition({ name: 'My picks' }));

    const reloadReq = httpMock.expectOne('/curator/api/collections');
    reloadReq.flush([definition({ name: 'My picks' })]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('My picks');
  });

  it('selecting a definition and running it renders results with an install toggle for capacity_fill', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'c1' })]);
    const h = harness(fixture);
    h.selectDefinition(definition({ kind: 'capacity_fill', console_id: 'c1' }));
    fixture.detectChanges();

    h.runSelected();
    const runReq = httpMock.expectOne('/curator/api/collections/d1/runs');
    runReq.flush({ run_id: 'r1', included: [game('g1')], excluded: [], used_gb: 40 });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Mark installed');

    h.toggleInstall(game('g1'));
    const installReq = httpMock.expectOne('/curator/api/consoles/c1/installs/g1');
    expect(installReq.request.method).toBe('PUT');
    expect(installReq.request.body).toEqual({ installed: true });
    installReq.flush({ console_id: 'c1', game_id: 'g1', installed: true });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Installed');
  });

  it('surfaces an inline 404 error when the console is unknown', () => {
    const fixture = createAndLoad([definition({ kind: 'capacity_fill', console_id: 'unknown-console' })]);
    const h = harness(fixture);
    h.selectDefinition(definition({ kind: 'capacity_fill', console_id: 'unknown-console' }));
    fixture.detectChanges();

    h.runSelected();
    httpMock
      .expectOne('/curator/api/collections/d1/runs')
      .flush({ run_id: 'r1', included: [game('g1')], excluded: [], used_gb: 40 });
    fixture.detectChanges();

    h.toggleInstall(game('g1'));
    httpMock
      .expectOne('/curator/api/consoles/unknown-console/installs/g1')
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Console 'unknown-console' not found");
  });

  describe('viewer mode', () => {
    function profileDefinition(overrides: Partial<ProfileDefinitionResponse> = {}): ProfileDefinitionResponse {
      return { definition_id: 'd1', name: 'Weekend picks', kind: 'filter_list', console_id: null, ...overrides };
    }

    // The outer beforeEach already injects HttpTestingController, which instantiates the testing
    // module -- TestBed.overrideProvider() can no longer be used past that point. Reconfigure a
    // fresh module per viewer test instead, with route/auth providers specific to that test.
    function configureForViewer(routeSub: string, ownSub: string | null): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CollectionsComponent],
        providers: [
          provideHttpClient(),
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

    it('renders another user\'s saved collections read-only, with no create/save/run controls', () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/users/other-sub/collections').flush([profileDefinition()]);
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.textContent).toContain('Weekend picks');
      expect(compiled.querySelector('button')).toBeNull();
      httpMock.expectNone('/curator/api/collections');
    });

    it('shows an empty state for another user with no saved collections', () => {
      configureForViewer('other-sub', null);

      const fixture = TestBed.createComponent(CollectionsComponent);
      fixture.detectChanges();
      httpMock.expectOne('/curator/api/users/other-sub/collections').flush([]);
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
