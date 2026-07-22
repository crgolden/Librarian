import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CuratorService } from '../curator/curator.service';
import {
  CollectionGameResponse,
  CollectionPreviewResponse,
  CollectionRunResponse,
  CollectionSpecRequest,
  DefinitionResponse,
  ProfileDefinitionResponse,
} from '../curator/curator.models';
import { redirectIfOwnSub } from '../profile/own-sub-redirect';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';

type CollectionKind = 'filter_list' | 'capacity_fill';
type View = 'list' | 'create' | 'detail';

/** `/collections` (owner) and `/collections/:sub` (viewer, canonicalized away from your own sub).
 *
 * Owner mode: unchanged — list saved definitions, create/preview/save, view/run a definition, toggle
 * per-console installs on a capacity-fill run's results.
 *
 * Viewer mode: read-only render of another user's saved collections (`GET /users/{sub}/collections`) —
 * no create/save/run/install controls, since `ProfileDefinitionResponse` (unlike the owner's own
 * `DefinitionResponse`) doesn't carry the spec fields (`genre_filter`/`min_score`/`aaa_tier_filter`)
 * needed to re-run it. A 403 renders an inline "this section isn't available" message. */
@Component({
  selector: 'app-collections',
  imports: [FormsModule, BreadcrumbComponent],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly curator = inject(CuratorService);

  protected readonly viewerMode = signal(false);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);
  protected readonly viewerForbidden = signal(false);
  protected readonly viewerDefinitions = signal<ProfileDefinitionResponse[]>([]);
  protected readonly viewerDefinitionsError = signal<string | null>(null);
  protected readonly viewerLoading = signal(true);

  protected readonly view = signal<View>('list');

  // List
  protected readonly definitions = signal<DefinitionResponse[]>([]);
  protected readonly loadingDefinitions = signal(true);
  protected readonly definitionsError = signal<string | null>(null);

  // Create / preview / save
  protected readonly kind = signal<CollectionKind>('filter_list');
  protected readonly consoleId = signal('');
  protected readonly genreFilter = signal('');
  protected readonly minScore = signal<number | null>(null);
  protected readonly aaaTierFilter = signal('');
  protected readonly createError = signal<string | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewResult = signal<CollectionPreviewResponse | null>(null);
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // Detail / run
  protected readonly selectedDefinition = signal<DefinitionResponse | null>(null);
  protected readonly running = signal(false);
  protected readonly runError = signal<string | null>(null);
  protected readonly runResult = signal<CollectionRunResponse | null>(null);

  // Console-install toggle. Session-only: no endpoint returns current install state, so this
  // never hydrates from a persisted value, only reflects actions taken since this page loaded.
  protected readonly installedGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly installErrors = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly installingGameIds = signal<ReadonlySet<string>>(new Set());

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
    }
  }

  private loadViewerDefinitions(sub: string): void {
    this.viewerLoading.set(true);
    this.viewerDefinitionsError.set(null);
    this.curator.getUserCollections(sub).subscribe({
      next: (definitions) => {
        this.viewerDefinitions.set(definitions);
        this.viewerLoading.set(false);
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
    this.createError.set(null);
    this.previewResult.set(null);
    this.name.set('');
    this.saveError.set(null);
    this.view.set('create');
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

    this.saving.set(true);
    this.saveError.set(null);
    this.curator.saveDefinition({ ...spec, name: trimmedName }).subscribe({
      next: () => {
        this.saving.set(false);
        this.view.set('list');
        this.loadDefinitions();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Unable to save this collection.');
      },
    });
  }

  protected selectDefinition(definition: DefinitionResponse): void {
    this.selectedDefinition.set(definition);
    this.runResult.set(null);
    this.runError.set(null);
    this.installedGameIds.set(new Set());
    this.installErrors.set(new Map());
    this.view.set('detail');
  }

  protected backToList(): void {
    this.selectedDefinition.set(null);
    this.view.set('list');
  }

  protected runSelected(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }

    this.running.set(true);
    this.runError.set(null);
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

  protected canToggleInstall(): boolean {
    const definition = this.selectedDefinition();
    return definition?.kind === 'capacity_fill' && !!definition.console_id;
  }

  protected toggleInstall(game: CollectionGameResponse): void {
    const definition = this.selectedDefinition();
    if (!definition?.console_id) {
      return;
    }

    const consoleId = definition.console_id;
    const nextInstalled = !this.installedGameIds().has(game.game_id);

    this.installingGameIds.update((ids) => new Set(ids).add(game.game_id));
    const errors = new Map(this.installErrors());
    errors.delete(game.game_id);
    this.installErrors.set(errors);

    this.curator.setConsoleInstall(consoleId, game.game_id, nextInstalled).subscribe({
      next: () => {
        this.installingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(game.game_id);
          return next;
        });
        this.installedGameIds.update((ids) => {
          const next = new Set(ids);
          if (nextInstalled) {
            next.add(game.game_id);
          } else {
            next.delete(game.game_id);
          }
          return next;
        });
      },
      error: (response: { status: number }) => {
        this.installingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(game.game_id);
          return next;
        });
        const message =
          response.status === 404
            ? `Console '${consoleId}' not found — install state can only be set for a console Curator already knows about.`
            : 'Unable to update install state.';
        const next = new Map(this.installErrors());
        next.set(game.game_id, message);
        this.installErrors.set(next);
      },
    });
  }
}
