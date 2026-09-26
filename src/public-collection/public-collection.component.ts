import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ButtonPrimaryDirective, CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';
import { ResolvedPublicCollection } from './public-collection.resolver';
import { AppUrls, RouteDataKeys, RouteParams, sharedCollectionUrl } from '../app/app-paths';
import { loginUrlReturningTo } from '../shared/bff-contract';
import { pageTitle } from '../shared/page-title';
import { CatalogMetaDirective, CatalogTitleDirective, SpineLabelDirective } from '../shared/primitives/typography';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';
import { ResolvedStatuses } from '../shared/resolved-status';
import {
  COLLECTION_LOAD_ERROR,
  COLLECTION_NOT_FOUND_TITLE,
  FOLLOW_UPDATE_ERROR,
  OWN_COLLECTION_FOLLOW_ERROR,
  SIGN_IN_TO_FOLLOW_LABEL,
} from './public-collection.messages';
import { statusCodeOf } from '../shared/http-status';

@Component({
  selector: 'app-public-collection',
  imports: [
    ButtonPrimaryDirective,
    CardDirective,
    PageSectionDirective,
    CatalogMetaDirective,
    CatalogTitleDirective,
    SpineLabelDirective,
  ],
  templateUrl: './public-collection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicCollectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  protected readonly notFoundTitle = COLLECTION_NOT_FOUND_TITLE;
  protected readonly signInToFollowLabel = SIGN_IN_TO_FOLLOW_LABEL;

  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly collection = signal<PublicCollectionResponse | null>(null);

  protected readonly following = signal(false);
  protected readonly followPending = signal(false);
  protected readonly followError = signal<string | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;

  ngOnInit(): void {
    this.meta.updateTag({ name: MetaNames.robots, content: RobotsDirectives.noIndexNoFollow });

    const resolved = this.route.snapshot.data[RouteDataKeys.collection] as ResolvedPublicCollection;
    if (resolved.status === ResolvedStatuses.notFound) {
      this.notFound.set(true);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.error.set(COLLECTION_LOAD_ERROR);
      return;
    }

    this.collection.set(resolved.collection);
    this.title.setTitle(pageTitle(resolved.collection.name));
    this.following.set(resolved.following);
  }

  protected returnToUrl(): string {
    const slug = this.route.snapshot.paramMap.get(RouteParams.slug);
    return loginUrlReturningTo(slug === null ? AppUrls.sharedCollections : sharedCollectionUrl(slug));
  }

  protected toggleFollow(): void {
    const collection = this.collection();
    if (!collection || this.followPending()) {
      return;
    }

    this.followPending.set(true);
    this.followError.set(null);
    const request = this.following()
      ? this.curator.unfollowDefinition(collection.definition_id)
      : this.curator.followDefinition(collection.definition_id);

    request.subscribe({
      next: () => {
        this.followPending.set(false);
        this.following.update((value) => !value);
      },
      error: (err: HttpErrorResponse) => {
        this.followPending.set(false);
        this.followError.set(
          statusCodeOf(err) === HttpStatusCode.BadRequest ? OWN_COLLECTION_FOLLOW_ERROR : FOLLOW_UPDATE_ERROR,
        );
      },
    });
  }
}
