import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import {
  CollectionPreviewResponse,
  CollectionRunResponse,
  CollectionSpecRequest,
  CollectionVisibility,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';
import { redirectIfOwnSub } from '../profile/own-sub-redirect';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';

type CollectionKind = 'filter_list' | 'capacity_fill';
type View = 'list' | 'create' | 'detail' | 'followed';

/** `/collections` (owner) and `/collections/:sub` (viewer, canonicalized away from your own sub).
 *
 * Owner mode: list saved definitions, create/preview/save, view a definition's detail (with its stored
 * items — cover art, rename/description, visibility + share link, membership edits), run a fresh
 * proposal and adopt it, delete, and browse "Collections I follow".
 *
 * Viewer mode: read-only render of another user's saved collections (`GET /users/{sub}/collections`),
 * plus a follow/unfollow toggle per collection (any collection listed there is already visibility
 * `"public"` — see `curator.profile_routes.get_user_collections` — so it's always followable). A 403
 * renders an inline "this section isn't available" message. */
@Component({
  selector: 'app-collections',
  imports: [FormsModule, RouterLink, BreadcrumbComponent],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly viewerMode = signal(false);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);
  protected readonly viewerForbidden = signal(false);
  protected readonly viewerDefinitions = signal<ProfileDefinitionResponse[]>([]);
  protected readonly viewerDefinitionsError = signal<string | null>(null);
  protected readonly viewerLoading = signal(true);
  protected readonly viewerFollowedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly viewerFollowPending = signal<ReadonlySet<string>>(new Set());

  protected readonly view = signal<View>('list');

  // List
  protected readonly definitions = signal<DefinitionResponse[]>([]);
  protected readonly loadingDefinitions = signal(true);
  protected readonly definitionsError = signal<string | null>(null);

  // Collections I follow
  protected readonly followedDefinitions = signal<DefinitionResponse[]>([]);
  protected readonly loadingFollowed = signal(false);
  protected readonly followedError = signal<string | null>(null);
  protected readonly unfollowingIds = signal<ReadonlySet<string>>(new Set());

  // Create / preview / save
  protected readonly kind = signal<CollectionKind>('filter_list');
  protected readonly consoleId = signal('');
  protected readonly consoles = signal<ConsoleResponse[]>([]);
  protected readonly genreFilter = signal('');
  protected readonly minScore = signal<number | null>(null);
  protected readonly aaaTierFilter = signal('');
  protected readonly includeInactive = signal(false);
  protected readonly minPercentCompleted = signal<number | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewResult = signal<CollectionPreviewResponse | null>(null);
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // Detail / edit
  protected readonly selectedDefinition = signal<DefinitionDetailResponse | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);

  protected readonly editingMeta = signal(false);
  protected readonly editName = signal('');
  protected readonly editDescription = signal('');
  protected readonly savingMeta = signal(false);
  protected readonly metaError = signal<string | null>(null);

  protected readonly visibilitySaving = signal(false);
  protected readonly visibilityError = signal<string | null>(null);
  protected readonly shareLinkCopied = signal(false);

  protected readonly removingGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly itemsError = signal<string | null>(null);

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly running = signal(false);
  protected readonly runError = signal<string | null>(null);
  protected readonly runResult = signal<CollectionRunResponse | null>(null);
  protected readonly adopting = signal(false);
  protected readonly adoptError = signal<string | null>(null);

  // Console-install toggle, hydrated from GET /consoles/{id}/installs — persisted, not session-only.
  protected readonly installedGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly installErrors = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly installingGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly installsLoading = signal(false);

  ngOnInit(): void {
    if (redirectIfOwnSub(this.route, this.router, this.auth, ['/collections'])) {
      return;
    }

    const sub = this.route.snapshot.paramMap.get('sub');
    if (sub !== null) {
      this.viewerMode.set(true);
      this.breadcrumbItems.set([{ label: 'Profile', link: ['/u', sub] }, { label: 'Collections' }]);
      this.loadViewerDefinitions(sub);
    } else {
      this.loadDefinitions();
      this.curator.listConsoles().subscribe({
        next: (consoles) => this.consoles.set(consoles),
        error: () => undefined,
      });
    }
  }

  private loadViewerDefinitions(sub: string): void {
    this.viewerLoading.set(true);
    this.viewerDefinitionsError.set(null);
    this.curator.getUserCollections(sub).subscribe({
      next: (definitions) => {
        this.viewerDefinitions.set(definitions);
        this.viewerLoading.set(false);
        this.loadViewerFollowedIds();
      },
      error: (err: HttpErrorResponse) => {
        this.viewerLoading.set(false);
        if (err.status === 403) {
          this.viewerForbidden.set(true);
        } else {
          this.viewerDefinitionsError.set("Unable to load this user's collections.");
        }
      },
    });
  }

  private loadViewerFollowedIds(): void {
    this.curator.listFollowedCollections().subscribe({
      next: (definitions) => this.viewerFollowedIds.set(new Set(definitions.map((definition) => definition.definition_id))),
      error: () => undefined,
    });
  }

  protected isFollowingViewerDefinition(definitionId: string): boolean {
    return this.viewerFollowedIds().has(definitionId);
  }

  protected isFollowPending(definitionId: string): boolean {
    return this.viewerFollowPending().has(definitionId);
  }

  protected toggleFollowViewerDefinition(definitionId: string): void {
    const currentlyFollowing = this.viewerFollowedIds().has(definitionId);
    this.viewerFollowPending.update((ids) => new Set(ids).add(definitionId));
    this.viewerDefinitionsError.set(null);

    const request = currentlyFollowing
      ? this.curator.unfollowDefinition(definitionId)
      : this.curator.followDefinition(definitionId);

    request.subscribe({
      next: () => {
        this.viewerFollowPending.update((ids) => {
          const next = new Set(ids);
          next.delete(definitionId);
          return next;
        });
        this.viewerFollowedIds.update((ids) => {
          const next = new Set(ids);
          if (currentlyFollowing) {
            next.delete(definitionId);
          } else {
            next.add(definitionId);
          }
          return next;
        });
      },
      error: () => {
        this.viewerFollowPending.update((ids) => {
          const next = new Set(ids);
          next.delete(definitionId);
          return next;
        });
        this.viewerDefinitionsError.set('Unable to update follow state.');
      },
    });
  }

  private loadDefinitions(): void {
    this.loadingDefinitions.set(true);
    this.definitionsError.set(null);
    this.curator.listDefinitions().subscribe({
      next: (definitions) => {
        this.definitions.set(definitions);
        this.loadingDefinitions.set(false);
      },
      error: () => {
        this.definitionsError.set('Unable to load your saved collections.');
        this.loadingDefinitions.set(false);
      },
    });
  }

  protected showCreate(): void {
    this.kind.set('filter_list');
    this.consoleId.set('');
    this.genreFilter.set('');
    this.minScore.set(null);
    this.aaaTierFilter.set('');
    this.includeInactive.set(false);
    this.minPercentCompleted.set(null);
    this.createError.set(null);
    this.previewResult.set(null);
    this.name.set('');
    this.description.set('');
    this.saveError.set(null);
    this.view.set('create');
  }

  protected showFollowed(): void {
    this.view.set('followed');
    this.loadFollowed();
  }

  private loadFollowed(): void {
    this.loadingFollowed.set(true);
    this.followedError.set(null);
    this.curator.listFollowedCollections().subscribe({
      next: (definitions) => {
        this.followedDefinitions.set(definitions);
        this.loadingFollowed.set(false);
      },
      error: () => {
        this.followedError.set('Unable to load the collections you follow.');
        this.loadingFollowed.set(false);
      },
    });
  }

  protected unfollow(definitionId: string): void {
    this.unfollowingIds.update((ids) => new Set(ids).add(definitionId));
    this.curator.unfollowDefinition(definitionId).subscribe({
      next: () => {
        this.unfollowingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(definitionId);
          return next;
        });
        this.followedDefinitions.update((defs) => defs.filter((d) => d.definition_id !== definitionId));
      },
      error: () => {
        this.unfollowingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(definitionId);
          return next;
        });
        this.followedError.set('Unable to unfollow that collection.');
      },
    });
  }

  protected shareUrlFor(shareSlug: string): string | null {
    return this.isBrowser ? `${window.location.origin}/c/${shareSlug}` : null;
  }

  private buildSpec(): CollectionSpecRequest | null {
    if (this.kind() === 'capacity_fill' && !this.consoleId().trim()) {
      this.createError.set('A console is required for a capacity-fill collection.');
      return null;
    }

    return {
      kind: this.kind(),
      console_id: this.kind() === 'capacity_fill' ? this.consoleId().trim() : null,
      genre_filter: this.genreFilter()
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      min_score: this.minScore(),
      aaa_tier_filter: this.aaaTierFilter() || null,
      include_inactive: this.includeInactive(),
      min_percent_completed: this.minPercentCompleted(),
    };
  }

  protected preview(): void {
    this.createError.set(null);
    const spec = this.buildSpec();
    if (!spec) {
      return;
    }

    this.previewing.set(true);
    this.previewResult.set(null);
    this.curator.previewCollection(spec).subscribe({
      next: (result) => {
        this.previewing.set(false);
        this.previewResult.set(result);
      },
      error: () => {
        this.previewing.set(false);
        this.createError.set('Unable to generate a preview for this spec.');
      },
    });
  }

  protected saveDefinition(): void {
    const trimmedName = this.name().trim();
    if (!trimmedName) {
      this.saveError.set('Enter a name for this collection.');
      return;
    }

    const spec = this.buildSpec();
    if (!spec) {
      return;
    }

    const gameIds = this.previewResult()?.included.map((game) => game.game_id) ?? [];

    this.saving.set(true);
    this.saveError.set(null);
    this.curator
      .saveDefinition({ ...spec, name: trimmedName, description: this.description().trim() || null, game_ids: gameIds })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.view.set('list');
          this.loadDefinitions();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.saveError.set(
            err.status === 409 ? `You already have a collection named "${trimmedName}".` : 'Unable to save this collection.',
          );
        },
      });
  }

  protected openDefinition(definitionId: string): void {
    this.view.set('detail');
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedDefinition.set(null);
    this.editingMeta.set(false);
    this.metaError.set(null);
    this.visibilityError.set(null);
    this.shareLinkCopied.set(false);
    this.itemsError.set(null);
    this.confirmingDelete.set(false);
    this.deleteError.set(null);
    this.runResult.set(null);
    this.runError.set(null);
    this.adoptError.set(null);
    this.installedGameIds.set(new Set());
    this.installErrors.set(new Map());

    this.curator.getDefinition(definitionId).subscribe({
      next: (definition) => {
        this.detailLoading.set(false);
        this.selectedDefinition.set(definition);
        this.editName.set(definition.name);
        this.editDescription.set(definition.description ?? '');
        if (definition.kind === 'capacity_fill' && definition.console_id) {
          this.hydrateInstalls(definition.console_id);
        }
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set('Unable to load this collection.');
      },
    });
  }

  private hydrateInstalls(consoleId: string): void {
    this.installsLoading.set(true);
    this.curator.getConsoleInstalls(consoleId).subscribe({
      next: (response) => {
        this.installsLoading.set(false);
        this.installedGameIds.set(new Set(response.game_ids));
      },
      error: () => {
        this.installsLoading.set(false);
      },
    });
  }

  protected backToList(): void {
    this.selectedDefinition.set(null);
    this.view.set('list');
    this.loadDefinitions();
  }

  protected startEditingMeta(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }
    this.editName.set(definition.name);
    this.editDescription.set(definition.description ?? '');
    this.metaError.set(null);
    this.editingMeta.set(true);
  }

  protected cancelEditingMeta(): void {
    this.editingMeta.set(false);
  }

  protected saveMeta(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }
    const trimmedName = this.editName().trim();
    if (!trimmedName) {
      this.metaError.set('Enter a name for this collection.');
      return;
    }

    this.savingMeta.set(true);
    this.metaError.set(null);
    this.curator
      .updateDefinition(definition.definition_id, { name: trimmedName, description: this.editDescription().trim() || null })
      .subscribe({
        next: (updated) => {
          this.savingMeta.set(false);
          this.editingMeta.set(false);
          this.selectedDefinition.set(updated);
        },
        error: (err: HttpErrorResponse) => {
          this.savingMeta.set(false);
          this.metaError.set(
            err.status === 409 ? `You already have a collection named "${trimmedName}".` : 'Unable to update this collection.',
          );
        },
      });
  }

  protected removeItem(gameId: string): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }
    const remaining = definition.items.filter((item) => item.game_id !== gameId).map((item) => item.game_id);

    this.removingGameIds.update((ids) => new Set(ids).add(gameId));
    this.itemsError.set(null);
    this.curator.updateDefinition(definition.definition_id, { game_ids: remaining }).subscribe({
      next: (updated) => {
        this.removingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(gameId);
          return next;
        });
        this.selectedDefinition.set(updated);
      },
      error: () => {
        this.removingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(gameId);
          return next;
        });
        this.itemsError.set('Unable to remove that title.');
      },
    });
  }

  protected setVisibility(visibility: CollectionVisibility): void {
    const definition = this.selectedDefinition();
    if (!definition || definition.visibility === visibility) {
      return;
    }
    this.visibilitySaving.set(true);
    this.visibilityError.set(null);
    this.shareLinkCopied.set(false);
    this.curator.setDefinitionVisibility(definition.definition_id, visibility).subscribe({
      next: (updated) => {
        this.visibilitySaving.set(false);
        this.selectedDefinition.update((current) =>
          current ? { ...current, visibility: updated.visibility, share_slug: updated.share_slug } : current,
        );
      },
      error: () => {
        this.visibilitySaving.set(false);
        this.visibilityError.set('Unable to update visibility.');
      },
    });
  }

  protected copyShareLink(): void {
    const definition = this.selectedDefinition();
    if (!definition?.share_slug || definition.visibility === 'private' || !this.isBrowser) {
      return;
    }
    const url = this.shareUrlFor(definition.share_slug);
    if (!url) {
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => this.shareLinkCopied.set(true),
      () => this.visibilityError.set('Unable to copy the link — copy it manually.'),
    );
  }

  protected confirmDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected deleteDefinition(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);
    this.curator.deleteDefinition(definition.definition_id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.backToList();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('Unable to delete this collection.');
      },
    });
  }

  protected runSelected(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }

    this.running.set(true);
    this.runError.set(null);
    this.adoptError.set(null);
    this.curator.runDefinition(definition.definition_id).subscribe({
      next: (result) => {
        this.running.set(false);
        this.runResult.set(result);
      },
      error: () => {
        this.running.set(false);
        this.runError.set('Unable to run this collection.');
      },
    });
  }

  protected adoptRunResult(): void {
    const definition = this.selectedDefinition();
    const result = this.runResult();
    if (!definition || !result) {
      return;
    }
    this.adopting.set(true);
    this.adoptError.set(null);
    this.curator
      .updateDefinition(definition.definition_id, { game_ids: result.included.map((game) => game.game_id) })
      .subscribe({
        next: (updated) => {
          this.adopting.set(false);
          this.selectedDefinition.set(updated);
          this.runResult.set(null);
        },
        error: () => {
          this.adopting.set(false);
          this.adoptError.set('Unable to adopt this proposal.');
        },
      });
  }

  protected canToggleInstall(): boolean {
    const definition = this.selectedDefinition();
    return definition?.kind === 'capacity_fill' && !!definition.console_id;
  }

  protected toggleInstall(gameId: string): void {
    const definition = this.selectedDefinition();
    if (!definition?.console_id) {
      return;
    }

    const consoleId = definition.console_id;
    const nextInstalled = !this.installedGameIds().has(gameId);

    this.installingGameIds.update((ids) => new Set(ids).add(gameId));
    const errors = new Map(this.installErrors());
    errors.delete(gameId);
    this.installErrors.set(errors);

    this.curator.setConsoleInstall(consoleId, gameId, nextInstalled).subscribe({
      next: () => {
        this.installingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(gameId);
          return next;
        });
        this.installedGameIds.update((ids) => {
          const next = new Set(ids);
          if (nextInstalled) {
            next.add(gameId);
          } else {
            next.delete(gameId);
          }
          return next;
        });
      },
      error: (response: { status: number }) => {
        this.installingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(gameId);
          return next;
        });
        const message =
          response.status === 404
            ? `Console '${consoleId}' not found — install state can only be set for a console Curator already knows about.`
            : 'Unable to update install state.';
        const next = new Map(this.installErrors());
        next.set(gameId, message);
        this.installErrors.set(next);
      },
    });
  }
}
