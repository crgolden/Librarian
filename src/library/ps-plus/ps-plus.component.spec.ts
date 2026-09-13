import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PsPlusComponent } from './ps-plus.component';
import { ResolvedPsPlusRotation } from './ps-plus.resolver';
import { PsPlusRotationResponse, PsPlusTitleResponse } from '../../curator/curator.models';

let nextTitleNumber = 0;

function psPlusTitle(overrides: Partial<PsPlusTitleResponse> = {}): PsPlusTitleResponse {
  nextTitleNumber += 1;
  return {
    title_id: `CUSA${String(nextTitleNumber).padStart(5, '0')}_00`,
    game_id: null,
    title: `Title ${nextTitleNumber}`,
    tier: 'extra',
    platforms: ['PS5'],
    cover_image_url: null,
    store_product_id: null,
    since_at: null,
    ...overrides,
  };
}

function rotation(overrides: Partial<PsPlusRotationResponse> = {}): PsPlusRotationResponse {
  return {
    catalog_walked_at: '2026-09-01T04:00:00Z',
    since: null,
    added: [],
    leaving: [],
    unclaimed: [],
    lapsed: [],
    categories: [
      { tier: 'extra', walked_at: '2026-09-01T04:00:00Z', total: 400 },
      { tier: 'premium', walked_at: '2026-09-01T04:10:00Z', total: 120 },
    ],
    ...overrides,
  };
}

describe('PsPlusComponent', () => {
  let httpMock: HttpTestingController;

  function render(resolved: ResolvedPsPlusRotation): ComponentFixture<PsPlusComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PsPlusComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { rotation: resolved } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PsPlusComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the resolved rotation with no request of its own', () => {
    const fixture = render({ status: 'ok', rotation: rotation() });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')?.textContent).toContain('PlayStation Plus');
    expect(compiled.querySelector('#ps-plus-walked-at')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-category-extra')?.textContent).toContain('400');
    httpMock.expectNone((r) => r.url.includes('/ps-plus-rotation'));
  });

  it('keeps the heading on the not-linked branch and sends the reader to the account page', () => {
    const fixture = render({ status: 'not-linked' });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-not-linked a')?.getAttribute('href')).toBe('/account');
    expect(compiled.querySelector('#ps-plus-unclaimed')).toBeNull();
  });

  it('keeps the heading on the error branch', () => {
    const fixture = render({ status: 'error' });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-error')?.textContent).toContain('Unable to load');
  });

  it('says the catalog has not been walked rather than showing empty lists as a finding', () => {
    const fixture = render({ status: 'ok', rotation: rotation({ catalog_walked_at: null, categories: [] }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-not-walked')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-walked-at')).toBeNull();
  });

  it('links a catalogued title to its catalog page and a storefront-only one to the Store', () => {
    const catalogued = psPlusTitle({ game_id: 'g-catalogued', store_product_id: 'UP9000-CUSA00001_00-X' });
    const storeOnly = psPlusTitle({ game_id: null, store_product_id: 'UP9000-CUSA00002_00-Y' });
    const nowhere = psPlusTitle({ game_id: null, store_product_id: null });
    const fixture = render({ status: 'ok', rotation: rotation({ unclaimed: [catalogued, storeOnly, nowhere] }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-unclaimed-title-0')?.getAttribute('href')).toBe('/catalog/g-catalogued');
    const storeLink = compiled.querySelector<HTMLAnchorElement>('#ps-plus-unclaimed-title-1');
    expect(storeLink?.href).toContain('store.playstation.com/product/UP9000-CUSA00002_00-Y');
    expect(storeLink?.rel).toContain('noopener');
    expect(compiled.querySelector('#ps-plus-unclaimed-title-2')?.tagName).toBe('SPAN');
  });

  it('renders every list with its own empty message when nothing is in it', () => {
    const compiled: HTMLElement = render({ status: 'ok', rotation: rotation() }).nativeElement;

    expect(compiled.querySelector('#ps-plus-unclaimed-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-leaving-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-added-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-lapsed-empty')).not.toBeNull();
  });

  it('counts each list in its heading', () => {
    const fixture = render({
      status: 'ok',
      rotation: rotation({ leaving: [psPlusTitle(), psPlusTitle()], lapsed: [psPlusTitle()] }),
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-leaving h2')?.textContent).toContain('(2)');
    expect(compiled.querySelector('#ps-plus-lapsed h2')?.textContent).toContain('(1)');
    expect(compiled.querySelector('#ps-plus-leaving-empty')).toBeNull();
  });
});
