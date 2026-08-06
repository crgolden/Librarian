import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import { PublicCollectionResponse } from '../curator/curator.models';

/** `/c/:slug` — the one anonymous, unauthenticated page in Librarian, mirroring Curator's one
 * anonymous route (`GET /public/collections/{share_slug}`). Reachable by anyone with the link,
 * signed in or not — the entire point of a share link (see the collections detail view's "Copy share
 * link" control). `noindex` — `"unlisted"` visibility means "unguessable link," not "crawlable page,"
 * and Librarian has no collection-discovery/search feature for `"public"` to opt into either. */
@Component({
  selector: 'app-public-collection',
  imports: [],
  templateUrl: './public-collection.component.html',
  styleUrl: './public-collection.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicCollectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly collection = signal<PublicCollectionResponse | null>(null);

  protected readonly following = signal(false);
  protected readonly followPending = signal(false);
  protected readonly followError = signal<string | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly loginUrl = this.auth.loginUrl;

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.curator.getPublicCollection(slug).subscribe({
      next: (collection) => {
        this.loading.set(false);
        this.collection.set(collection);
        this.title.setTitle(`${collection.name} — Librarian`);
        this.loadFollowState(collection.definition_id);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set('Unable to load this collection.');
        }
      },
    });
  }

  private loadFollowState(definitionId: string): void {
    // Fails silently for an anonymous visitor (401) — following.set(false) is already the initial
    // state, so there's nothing more to do for that case.
    this.curator.listFollowedCollections().subscribe({
      next: (definitions) => this.following.set(definitions.some((definition) => definition.definition_id === definitionId)),
      error: () => undefined,
    });
  }

  protected returnToUrl(): string {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    return `${this.loginUrl}?returnTo=${encodeURIComponent(`/c/${slug}`)}`;
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
          err.status === 400 ? "You can't follow your own collection." : 'Unable to update follow state.',
        );
      },
    });
  }
}
