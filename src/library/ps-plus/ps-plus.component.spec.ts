import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PsPlusComponent } from './ps-plus.component';
import { ResolvedPsPlusRotation } from './ps-plus.resolver';
import { PsPlusRotationResponse, PsPlusTiers, PsPlusTitleResponse } from '../../curator/curator.models';
import { AppUrls, RouteDataKeys, catalogGameUrl } from '../../app/app-paths';
import { PageTitles } from '../../shared/page-title';
import { storeProductUrl } from '../../catalog/store-links';
import { CuratorRoutes } from '../../curator/curator-api';
import { PS_PLUS_ROTATION_LOAD_ERROR } from '../library.messages';
import { LinkRelTokens } from '../../testing/html-constants';
import { ResolvedStatuses } from '../../shared/resolved-status';
import { newCount, newId, newText, newUtcInstant, randomIntBetween } from '@crgolden/modules/testing';

const WALKED_AT = newUtcInstant();
const PREMIUM_WALKED_AT = newUtcInstant();
const EXTRA_TOTAL = newCount();
const PREMIUM_TOTAL = newCount();
const CATALOGUED_GAME_ID = newId();
const CATALOGUED_PRODUCT_ID = newId();
const STORE_ONLY_PRODUCT_ID = newId();

function psPlusTitle(overrides: Partial<PsPlusTitleResponse> = {}): PsPlusTitleResponse {
  return {
    title_id: newId(),
    game_id: null,
    title: newText(),
    tier: PsPlusTiers.extra,
    platforms: [newText()],
    cover_image_url: null,
    store_product_id: null,
    since_at: null,
    ...overrides,
  };
}

function rotation(overrides: Partial<PsPlusRotationResponse> = {}): PsPlusRotationResponse {
  return {
    catalog_walked_at: WALKED_AT,
    since: null,
    added: [],
    leaving: [],
    unclaimed: [],
    lapsed: [],
    categories: [
      { tier: PsPlusTiers.extra, walked_at: WALKED_AT, total: EXTRA_TOTAL },
      { tier: PsPlusTiers.premium, walked_at: PREMIUM_WALKED_AT, total: PREMIUM_TOTAL },
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
        { provide: ActivatedRoute, useValue: { snapshot: { data: { [RouteDataKeys.rotation]: resolved } } } },
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
    const fixture = render({ status: ResolvedStatuses.ok, rotation: rotation() });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')?.textContent).toContain(PageTitles.psPlus);
    expect(compiled.querySelector('#ps-plus-walked-at')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-category-extra')?.textContent).toContain(String(EXTRA_TOTAL));
    httpMock.expectNone((r) => r.url.includes(CuratorRoutes.mePsPlusRotation));
  });

  it('keeps the heading on the not-linked branch and sends the reader to the account page', () => {
    const fixture = render({ status: ResolvedStatuses.notLinked });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-not-linked a')?.getAttribute('href')).toBe(AppUrls.account);
    expect(compiled.querySelector('#ps-plus-unclaimed')).toBeNull();
  });

  it('keeps the heading on the error branch', () => {
    const fixture = render({ status: ResolvedStatuses.error });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-error')?.textContent).toContain(PS_PLUS_ROTATION_LOAD_ERROR);
  });

  it('says the catalog has not been walked rather than showing empty lists as a finding', () => {
    const fixture = render({ status: ResolvedStatuses.ok, rotation: rotation({ catalog_walked_at: null, categories: [] }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-not-walked')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-walked-at')).toBeNull();
  });

  it('links a catalogued title to its catalog page and a storefront-only one to the Store', () => {
    const catalogued = psPlusTitle({ game_id: CATALOGUED_GAME_ID, store_product_id: CATALOGUED_PRODUCT_ID });
    const storeOnly = psPlusTitle({ game_id: null, store_product_id: STORE_ONLY_PRODUCT_ID });
    const nowhere = psPlusTitle({ game_id: null, store_product_id: null });
    const fixture = render({ status: ResolvedStatuses.ok, rotation: rotation({ unclaimed: [catalogued, storeOnly, nowhere] }) });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-unclaimed-title-0')?.getAttribute('href')).toBe(catalogGameUrl(CATALOGUED_GAME_ID));
    const storeLink = compiled.querySelector<HTMLAnchorElement>('#ps-plus-unclaimed-title-1');
    expect(storeLink?.href).toBe(storeProductUrl(STORE_ONLY_PRODUCT_ID));
    expect(storeLink?.rel).toContain(LinkRelTokens.noopener);
    expect(compiled.querySelector('#ps-plus-unclaimed-title-2')?.tagName).toBe('SPAN');
  });

  it('renders every list with its own empty message when nothing is in it', () => {
    const compiled: HTMLElement = render({ status: ResolvedStatuses.ok, rotation: rotation() }).nativeElement;

    expect(compiled.querySelector('#ps-plus-unclaimed-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-leaving-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-added-empty')).not.toBeNull();
    expect(compiled.querySelector('#ps-plus-lapsed-empty')).not.toBeNull();
  });

  it('counts each list in its heading', () => {
    const leaving = Array.from({ length: randomIntBetween(1, 10) }, () => psPlusTitle());
    const lapsed = Array.from({ length: randomIntBetween(1, 10) }, () => psPlusTitle());
    const fixture = render({
      status: ResolvedStatuses.ok,
      rotation: rotation({ leaving, lapsed }),
    });

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#ps-plus-leaving h2')?.textContent).toContain(`(${leaving.length})`);
    expect(compiled.querySelector('#ps-plus-lapsed h2')?.textContent).toContain(`(${lapsed.length})`);
    expect(compiled.querySelector('#ps-plus-leaving-empty')).toBeNull();
  });
});
