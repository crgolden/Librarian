import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { PublicCollectionComponent } from './public-collection.component';
import {
  COLLECTION_LOAD_ERROR,
  COLLECTION_NOT_FOUND_TITLE,
  SIGN_IN_TO_FOLLOW_LABEL,
} from './public-collection.messages';
import { ResolvedPublicCollection } from './public-collection.resolver';
import { CollectionVisibilities, PublicCollectionResponse } from '../curator/curator.models';
import { AuthService } from '../auth/auth.service';
import { CuratorApi } from '../curator/curator-api';
import { BffPaths, loginUrlReturningTo } from '../shared/bff-contract';
import { AppPaths, RouteDataKeys, RouteParams, sharedCollectionUrl } from '../app/app-paths';
import { pageTitle } from '../shared/page-title';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';
import { ResolvedStatuses } from '../shared/resolved-status';
import { HttpMethods } from '../bff/http-headers';
import { newCount, newHttpsAddress, newId, newPercent, newText } from '@crgolden/modules/testing';

const DEFINITION_ID = newId();
const SHARE_SLUG = newId();
const COLLECTION_NAME = newText();

function publicCollection(overrides: Partial<PublicCollectionResponse> = {}): PublicCollectionResponse {
  return {
    definition_id: DEFINITION_ID,
    name: COLLECTION_NAME,
    description: newText(),
    visibility: CollectionVisibilities.unlisted,
    items: [],
    ...overrides,
  };
}

function ok(overrides: Partial<PublicCollectionResponse> = {}, following = false): ResolvedPublicCollection {
  return { status: ResolvedStatuses.ok, collection: publicCollection(overrides), following };
}

function activatedRoute(slug: string | null, resolved: ResolvedPublicCollection): ActivatedRoute {
  return {
    snapshot: {
      paramMap: convertToParamMap(slug !== null ? { [RouteParams.slug]: slug } : {}),
      url: slug !== null ? [{ path: AppPaths.sharedCollection.split('/')[0] }, { path: slug }] : [],
      data: { [RouteDataKeys.collection]: resolved },
    },
  } as unknown as ActivatedRoute;
}

function authService(isAuthenticated: boolean): AuthService {
  return { isAuthenticated: signal(isAuthenticated), loginUrl: BffPaths.login } as unknown as AuthService;
}

describe('PublicCollectionComponent', () => {
  let httpMock: HttpTestingController;

  function configure(slug: string | null, authenticated: boolean, resolved: ResolvedPublicCollection): void {
    TestBed.configureTestingModule({
      imports: [PublicCollectionComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRoute(slug, resolved) },
        { provide: AuthService, useValue: authService(authenticated) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('sets a noindex robots meta tag', () => {
    configure(SHARE_SLUG, false, ok());
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const meta = TestBed.inject(Meta);
    expect(meta.getTag(`name="${MetaNames.robots}"`)?.content).toBe(RobotsDirectives.noIndexNoFollow);
  });

  it('names the collection in the document title rather than leaving the route default', () => {
    const collection = publicCollection();
    configure(SHARE_SLUG, false, { status: ResolvedStatuses.ok, collection, following: false });
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    expect(TestBed.inject(Title).getTitle()).toBe(pageTitle(collection.name));
  });

  it('renders a shared collection with its items and cover art', () => {
    const gameTitle = newText();
    const coverUrl = newHttpsAddress();
    configure(
      SHARE_SLUG,
      false,
      ok({
        items: [
          {
            game_id: newId(),
            rank: newCount(),
            title: gameTitle,
            franchise: newText(),
            genre: newText(),
            aaa_tier: newText(),
            critical_score: newPercent(),
            oc_score: newPercent(),
            psn_rating: newPercent(),
            cover_image_url: coverUrl,
            owner_has_access: true,
            installed_on_target: null,
          },
        ],
      }),
    );
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain(COLLECTION_NAME);
    expect(compiled.textContent).toContain(gameTitle);
    expect(compiled.querySelector('#public-collection-cover-0')?.getAttribute('src')).toBe(coverUrl);
  });

  it('renders the collection on first paint, with no request of its own', () => {
    configure(SHARE_SLUG, false, ok());
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(COLLECTION_NAME);
    httpMock.expectNone(CuratorApi.publicCollectionsByShareSlug(SHARE_SLUG));
    httpMock.expectNone(CuratorApi.collectionsFollowed);
  });

  it('shows a not-found message when the share link is unknown or no longer shared', () => {
    configure(newId(), false, { status: ResolvedStatuses.notFound });
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')?.textContent?.trim()).toBe(COLLECTION_NOT_FOUND_TITLE);
    expect(compiled.querySelector('#public-collection-not-found')).not.toBeNull();
  });

  it('shows a generic error message on a non-404 failure', () => {
    configure(SHARE_SLUG, false, { status: ResolvedStatuses.error });
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(COLLECTION_LOAD_ERROR);
  });

  it('shows a "sign in to follow" link when anonymous', () => {
    configure(SHARE_SLUG, false, ok());
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const signIn = compiled.querySelector('#public-collection-sign-in');
    expect(signIn?.textContent?.trim()).toBe(SIGN_IN_TO_FOLLOW_LABEL);
    expect(signIn?.getAttribute('href')).toBe(loginUrlReturningTo(sharedCollectionUrl(SHARE_SLUG)));
  });

  it('follows and unfollows a collection when authenticated', () => {
    configure(SHARE_SLUG, true, ok());
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const followButton = () => compiled.querySelector('#public-collection-follow');
    expect(followButton()?.getAttribute('data-following')).toBe(String(false));

    followButton()?.dispatchEvent(new Event('click'));
    httpMock.expectOne({ url: CuratorApi.collectionsByDefinitionIdFollow(DEFINITION_ID), method: HttpMethods.post }).flush(null);
    fixture.detectChanges();

    expect(followButton()?.getAttribute('data-following')).toBe(String(true));
  });

  it('pre-selects the follow button as already-following when the resolver says the viewer follows it', () => {
    configure(SHARE_SLUG, true, ok({ definition_id: DEFINITION_ID }, true));
    const fixture = TestBed.createComponent(PublicCollectionComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#public-collection-follow')?.getAttribute('data-following')).toBe(String(true));
  });
});
