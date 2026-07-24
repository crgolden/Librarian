import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogComponent } from './catalog.component';
import { GameSummaryResponse } from '../curator/curator.models';

function game(id: string, title: string): GameSummaryResponse {
  return { game_id: id, canonical_title: title, franchise: 'Franchise', genre: 'Action', aaa_tier: 'AAA' };
}

interface CatalogHarness {
  franchise: { set(value: string): void };
  genre: { set(value: string): void };
  aaaTier: { set(value: string): void };
  applyFilters(): void;
  nextPage(): void;
  prevPage(): void;
}

function harness(fixture: ComponentFixture<CatalogComponent>): CatalogHarness {
  return fixture.componentInstance as unknown as CatalogHarness;
}

describe('CatalogComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads and renders a page of games on init', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    req.flush({ games: [game('g1', 'Bloodborne')] });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Bloodborne');
    expect(compiled.querySelector('button[disabled]')?.textContent).toContain('Previous');
  });

  it('applying filters resets the offset and re-requests with the given params', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: [] });
    fixture.detectChanges();

    const h = harness(fixture);
    h.franchise.set('Uncharted');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('franchise')).toBe('Uncharted');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ games: [] });
  });

  it('shows an error message when the catalog request fails', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the catalog.');
  });

  it('nextPage advances the offset only when a full page came back', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    const fullPage = Array.from({ length: 50 }, (_, i) => game(`g${i}`, `Game ${i}`));
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: fullPage });
    fixture.detectChanges();

    harness(fixture).nextPage();
    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('offset')).toBe('50');
    req.flush({ games: [] });
  });
});
