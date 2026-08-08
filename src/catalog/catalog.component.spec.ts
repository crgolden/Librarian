import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogComponent } from './catalog.component';
import { GameSummaryResponse } from '../curator/curator.models';

function game(id: string, title: string, overrides: Partial<GameSummaryResponse> = {}): GameSummaryResponse {
  return {
    game_id: id,
    canonical_title: title,
    franchise: 'Franchise',
    genre: 'Action',
    aaa_tier: 'AAA',
    cover_image_url: null,
    store_product_id: null,
    ...overrides,
  };
}

interface CatalogHarness {
  search: { set(value: string): void };
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
    req.flush({ games: [game('g1', 'Bloodborne')], total: 1 });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Bloodborne');
    expect(compiled.querySelector('button[disabled]')?.textContent).toContain('Previous');
  });

  it('sends the title search term as q', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: [], total: 0 });
    fixture.detectChanges();

    const h = harness(fixture);
    h.search.set('tomb');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('q')).toBe('tomb');
    req.flush({ games: [], total: 0 });
  });

  it('renders cover art and a PlayStation Store link when the catalog has them', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({
      games: [game('g1', 'Bloodborne', { cover_image_url: 'https://img/cover.jpg', store_product_id: 'UP9000-CUSA00207_00-X' })],
      total: 1,
    });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('img.cover-art')?.getAttribute('src')).toBe('https://img/cover.jpg');
    const link = compiled.querySelector<HTMLAnchorElement>('#catalog-store-link-0');
    expect(link?.href).toContain('store.playstation.com/product/');
    expect(link?.rel).toContain('noopener');
  });

  it('omits the store link for a game with no store product id', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/curator/api/catalog/games')
      .flush({ games: [game('g1', 'Unknown')], total: 1 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#catalog-store-link-0')).toBeNull();
  });

  it('disables Next on the last page even when the page came back full', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    const fullPage = Array.from({ length: 50 }, (_, i) => game(`g${i}`, `Game ${i}`));
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: fullPage, total: 50 });
    fixture.detectChanges();

    const next = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#catalog-next')!;
    expect(next.disabled).toBe(true);
  });

  it('applying filters resets the offset and re-requests with the given params', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: [], total: 0 });
    fixture.detectChanges();

    const h = harness(fixture);
    h.franchise.set('Uncharted');
    h.applyFilters();

    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('franchise')).toBe('Uncharted');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ games: [], total: 0 });
  });

  it('shows an error message when the catalog request fails', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load the catalog.');
  });

  it('nextPage advances the offset by one page', () => {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();

    const fullPage = Array.from({ length: 50 }, (_, i) => game(`g${i}`, `Game ${i}`));
    httpMock.expectOne((r) => r.url === '/curator/api/catalog/games').flush({ games: fullPage, total: 120 });
    fixture.detectChanges();

    harness(fixture).nextPage();
    const req = httpMock.expectOne((r) => r.url === '/curator/api/catalog/games');
    expect(req.request.params.get('offset')).toBe('50');
    req.flush({ games: [], total: 120 });
  });
});
