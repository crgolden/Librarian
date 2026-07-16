import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionsComponent } from './collections.component';
import { CollectionGameResponse, DefinitionResponse } from '../curator/curator.models';

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

describe('CollectionsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
