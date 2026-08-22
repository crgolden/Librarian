import { HttpErrorResponse } from '@angular/common/http';
import { Location, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CuratorService } from '../curator/curator.service';
import {
  CollectionItemResponse,
  CollectionItemSortField,
  CollectionPreviewResponse,
  CollectionRunResponse,
  CollectionSpecRequest,
  CollectionVisibility,
  ConsoleResponse,
  DefinitionDetailResponse,
  DefinitionResponse,
  MeasuredSizeResponse,
  ProfileDefinitionResponse,
  StorageDeviceResponse,
} from '../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../app/shared/breadcrumb/breadcrumb.component';
import { LoadingOverlayComponent } from '../shared/loading-overlay/loading-overlay.component';
import { ResolvedCollections } from './collections.resolver';

type CollectionKind = 'filter_list' | 'capacity_fill';
type View = 'list' | 'create' | 'detail' | 'followed';

const ITEMS_PAGE_SIZE = 50;

export const RESULT_PAGE_SIZE = 50;

@Component({
  selector: 'app-collections',
  imports: [FormsModule, RouterLink, BreadcrumbComponent, LoadingOverlayComponent],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly curator = inject(CuratorService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly viewerMode = signal(false);
  protected readonly breadcrumbItems = signal<BreadcrumbItem[]>([]);
  protected readonly viewerForbidden = signal(false);
  protected readonly viewerDefinitions = signal<ProfileDefinitionResponse[]>([]);
  protected readonly viewerDefinitionsError = signal<string | null>(null);
  protected readonly viewerFollowedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly viewerFollowPending = signal<ReadonlySet<string>>(new Set());

  protected readonly view = signal<View>('list');

  protected readonly definitions = signal<DefinitionResponse[]>([]);
  protected readonly definitionsError = signal<string | null>(null);

  protected readonly followedDefinitions = signal<DefinitionResponse[]>([]);
  protected readonly loadingFollowed = signal(false);
  protected readonly followedError = signal<string | null>(null);
  protected readonly unfollowingIds = signal<ReadonlySet<string>>(new Set());

  protected readonly kind = signal<CollectionKind>('filter_list');
  protected readonly consoleId = signal('');
  protected readonly consoles = signal<ConsoleResponse[]>([]);
  protected readonly genreFilter = signal<string[]>([]);
  protected readonly genreOptions = signal<string[]>([]);
  protected readonly minScore = signal<number | null>(null);
  protected readonly aaaTierFilter = signal('');
  protected readonly includeInactive = signal(false);
  protected readonly minPercentCompleted = signal<number | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewResult = signal<CollectionPreviewResponse | null>(null);
  protected readonly previewOffset = signal(0);
  protected readonly resultPageSize = RESULT_PAGE_SIZE;

  protected readonly previewPageableTotal = computed(() => {
    const result = this.previewResult();
    return result ? Math.max(result.included_total, result.excluded_total) : 0;
  });
  protected readonly previewPageEnd = computed(() =>
    Math.min(this.previewOffset() + RESULT_PAGE_SIZE, this.previewPageableTotal()),
  );
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

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

  protected readonly items = signal<CollectionItemResponse[]>([]);
  protected readonly itemsTotal = signal(0);
  protected readonly itemsLoading = signal(false);
  protected readonly itemSearch = signal('');
  protected readonly itemSort = signal<CollectionItemSortField>('rank');
  protected readonly itemSortDir = signal<'asc' | 'desc'>('asc');

  protected readonly itemSortOptions: readonly {
    id: string;
    field: CollectionItemSortField;
    label: string;
  }[] = [
    { id: 'rank', field: 'rank', label: 'Rank' },
    { id: 'title', field: 'title', label: 'Title' },
    { id: 'oc', field: 'oc_score', label: 'OpenCritic' },
    { id: 'psn', field: 'psn_rating', label: 'PSN' },
  ];
  protected readonly itemOffset = signal(0);
  protected readonly itemsPageSize = ITEMS_PAGE_SIZE;

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly running = signal(false);
  protected readonly runError = signal<string | null>(null);
  protected readonly runResult = signal<CollectionRunResponse | null>(null);

  protected readonly runPageableTotal = computed(() => {
    const result = this.runResult();
    return result ? Math.max(result.included_total, result.excluded_total) : 0;
  });
  protected readonly adopting = signal(false);
  protected readonly adoptError = signal<string | null>(null);

  protected readonly installedGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly installErrors = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly installingGameIds = signal<ReadonlySet<string>>(new Set());
  protected readonly installsLoading = signal(false);

  protected readonly attachedDevices = signal<StorageDeviceResponse[]>([]);
  protected readonly deviceInstalledKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly deviceInstallErrors = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly deviceInstallingKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly expandedSizeGameId = signal<string | null>(null);
  protected readonly measuredSizesByGame = signal<ReadonlyMap<string, MeasuredSizeResponse[]>>(new Map());
  protected readonly measuredSizesLoading = signal(false);
  protected readonly measuredSizePlatform = signal<'PS5' | 'PS4'>('PS5');
  protected readonly measuredSizeValue = signal<number | null>(null);
  protected readonly measuredSizeSaving = signal(false);
  protected readonly measuredSizeError = signal<string | null>(null);

  protected readonly reloadingDefinitions = signal(false);

  protected readonly loading = computed(
    () =>
      this.reloadingDefinitions() ||
      this.loadingFollowed() ||
      this.detailLoading() ||
      this.itemsLoading() ||
      this.installsLoading() ||
      this.measuredSizesLoading(),
  );

  ngOnInit(): void {
    this.genreOptions.set((this.route.snapshot.data['genres'] as string[] | undefined) ?? []);
    const resolved = this.route.snapshot.data['collections'] as ResolvedCollections;

    if (resolved.mode.startsWith('viewer')) {
      const sub = this.route.snapshot.paramMap.get('sub');
      this.viewerMode.set(true);
      if (sub !== null) {
        this.breadcrumbItems.set([{ label: 'Profile', link: ['/u', sub] }, { label: 'Collections' }]);
      }
    }

    switch (resolved.mode) {
      case 'viewer':
        this.viewerDefinitions.set(resolved.definitions);
        this.loadViewerFollowedIds();
        return;
      case 'viewer-forbidden':
        this.viewerForbidden.set(true);
        return;
      case 'viewer-error':
        this.viewerDefinitionsError.set("Unable to load this user's collections.");
        return;
      case 'list':
        this.consoles.set(resolved.consoles);
        this.definitions.set(resolved.definitions);
        return;
      case 'list-error':
        this.consoles.set(resolved.consoles);
        this.definitionsError.set('Unable to load your saved collections.');
        return;
      case 'detail':
        this.consoles.set(resolved.consoles);
        this.view.set('detail');
        this.applyDefinition(resolved.definition);
        this.editName.set(resolved.definition.name);
        this.editDescription.set(resolved.definition.description ?? '');
        if (resolved.definition.kind === 'capacity_fill' && resolved.definition.console_id) {
          this.hydrateInstalls(resolved.definition.console_id);
          this.hydrateDeviceInstalls(resolved.definition.console_id);
        }
        return;
      case 'detail-error':
        this.consoles.set(resolved.consoles);
        this.view.set('detail');
        this.detailError.set('Unable to load this collection.');
        return;
    }
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

  protected kindLabel(kind: string): string {
    return kind === 'capacity_fill' ? 'Capacity fill' : kind === 'filter_list' ? 'Filter list' : kind;
  }

  protected consoleName(consoleId: string): string {
    return this.consoles().find((console) => console.console_id === consoleId)?.name ?? consoleId;
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
    this.reloadingDefinitions.set(true);
    this.definitionsError.set(null);
    this.curator.listDefinitions().subscribe({
      next: (definitions) => {
        this.definitions.set(definitions);
        this.reloadingDefinitions.set(false);
      },
      error: () => {
        this.definitionsError.set('Unable to load your saved collections.');
        this.reloadingDefinitions.set(false);
      },
    });
  }

  protected showCreate(): void {
    this.kind.set('filter_list');
    this.consoleId.set('');
    this.genreFilter.set([]);
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
      genre_filter: this.genreFilter(),
      min_score: this.minScore(),
      aaa_tier_filter: this.aaaTierFilter() || null,
      include_inactive: this.includeInactive(),
      min_percent_completed: this.minPercentCompleted(),
    };
  }

  protected preview(): void {
    this.previewOffset.set(0);
    this.loadPreview();
  }

  protected pagePreview(delta: number): void {
    const next = this.previewOffset() + delta * RESULT_PAGE_SIZE;
    if (next < 0 || next >= this.previewPageableTotal()) {
      return;
    }
    this.previewOffset.set(next);
    this.loadPreview();
  }

  private loadPreview(): void {
    this.createError.set(null);
    const spec = this.buildSpec();
    if (!spec) {
      return;
    }

    this.previewing.set(true);
    this.curator.previewCollection(spec, { limit: RESULT_PAGE_SIZE, offset: this.previewOffset() }).subscribe({
      next: (result) => {
        this.previewing.set(false);
        this.previewResult.set(result);
      },
      error: () => {
        this.previewing.set(false);
        this.previewResult.set(null);
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

    const gameIds = this.previewResult()?.included_game_ids ?? [];

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

  protected onDefinitionClick(event: MouseEvent, definitionId: string): void {
    if (CollectionsComponent.opensInNewTab(event)) {
      return;
    }
    event.preventDefault();
    this.openDefinition(definitionId);
  }

  private static opensInNewTab(event: MouseEvent): boolean {
    return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  }

  protected openDefinition(definitionId: string): void {
    this.location.go(`/collections/d/${definitionId}`);
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
    this.attachedDevices.set([]);
    this.deviceInstalledKeys.set(new Set());
    this.deviceInstallErrors.set(new Map());
    this.expandedSizeGameId.set(null);
    this.measuredSizesByGame.set(new Map());
    this.measuredSizeError.set(null);
    this.items.set([]);
    this.itemsTotal.set(0);
    this.itemSearch.set('');
    this.itemSort.set('rank');
    this.itemSortDir.set('asc');
    this.itemOffset.set(0);

    this.curator.getDefinition(definitionId).subscribe({
      next: (definition) => {
        this.detailLoading.set(false);
        this.applyDefinition(definition);
        this.editName.set(definition.name);
        this.editDescription.set(definition.description ?? '');
        if (definition.kind === 'capacity_fill' && definition.console_id) {
          this.hydrateInstalls(definition.console_id);
          this.hydrateDeviceInstalls(definition.console_id);
        }
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set('Unable to load this collection.');
      },
    });
  }

  private applyDefinition(definition: DefinitionDetailResponse): void {
    this.selectedDefinition.set(definition);
    this.items.set(definition.items);
    this.itemsTotal.set(definition.item_count);
    this.itemOffset.set(0);
  }

  private loadItems(definitionId: string): void {
    this.itemsLoading.set(true);
    this.curator
      .getDefinitionItems(definitionId, {
        q: this.itemSearch() || undefined,
        sort: this.itemSort(),
        sortDir: this.itemSortDir(),
        limit: ITEMS_PAGE_SIZE,
        offset: this.itemOffset(),
      })
      .subscribe({
        next: (page) => {
          this.itemsLoading.set(false);
          this.items.set(page.items);
          this.itemsTotal.set(page.total);
        },
        error: () => {
          this.itemsLoading.set(false);
          this.itemsError.set('Unable to load this collection’s titles.');
        },
      });
  }

  protected searchItems(term: string): void {
    this.itemSearch.set(term);
    this.itemOffset.set(0);
    this.reloadItems();
  }

  protected sortItemsBy(field: CollectionItemSortField): void {
    if (this.itemSort() === field) {
      this.itemSortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.itemSort.set(field);
      this.itemSortDir.set('asc');
    }
    this.itemOffset.set(0);
    this.reloadItems();
  }

  protected pageItems(delta: number): void {
    const next = this.itemOffset() + delta * ITEMS_PAGE_SIZE;
    if (next < 0 || next >= this.itemsTotal()) {
      return;
    }
    this.itemOffset.set(next);
    this.reloadItems();
  }

  private reloadItems(): void {
    const definition = this.selectedDefinition();
    if (definition) {
      this.loadItems(definition.definition_id);
    }
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

  private hydrateDeviceInstalls(consoleId: string): void {
    this.curator.listStorageDevices().subscribe({
      next: (devices) => {
        const attached = devices.filter((device) => device.console_id === consoleId);
        this.attachedDevices.set(attached);
        for (const device of attached) {
          this.curator.getStorageDeviceInstalls(device.device_id).subscribe({
            next: (response) => {
              this.deviceInstalledKeys.update((keys) => {
                const next = new Set(keys);
                for (const gameId of response.game_ids) {
                  next.add(this.deviceInstallKey(device.device_id, gameId));
                }
                return next;
              });
            },
            error: () => undefined,
          });
        }
      },
      error: () => undefined,
    });
  }

  private deviceInstallKey(deviceId: string, gameId: string): string {
    return `${deviceId} ${gameId}`;
  }

  protected backToList(): void {
    this.location.go('/collections');
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
          this.applyDefinition(updated);
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
    this.removingGameIds.update((ids) => new Set(ids).add(gameId));
    this.itemsError.set(null);
    this.curator.removeDefinitionItem(definition.definition_id, gameId).subscribe({
      next: () => {
        this.removingGameIds.update((ids) => {
          const next = new Set(ids);
          next.delete(gameId);
          return next;
        });
        this.loadItems(definition.definition_id);
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
    this.executeRun();
  }

  private executeRun(): void {
    const definition = this.selectedDefinition();
    if (!definition) {
      return;
    }

    this.running.set(true);
    this.runError.set(null);
    this.adoptError.set(null);
    this.curator
      .runDefinition(definition.definition_id, { limit: RESULT_PAGE_SIZE, offset: 0 })
      .subscribe({
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
      .updateDefinition(definition.definition_id, { game_ids: [...result.included_game_ids] })
      .subscribe({
        next: (updated) => {
          this.adopting.set(false);
          this.applyDefinition(updated);
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

  protected isDeviceInstalled(deviceId: string, gameId: string): boolean {
    return this.deviceInstalledKeys().has(this.deviceInstallKey(deviceId, gameId));
  }

  protected isDeviceInstallPending(deviceId: string, gameId: string): boolean {
    return this.deviceInstallingKeys().has(this.deviceInstallKey(deviceId, gameId));
  }

  protected deviceInstallError(deviceId: string, gameId: string): string | undefined {
    return this.deviceInstallErrors().get(this.deviceInstallKey(deviceId, gameId));
  }

  protected toggleDeviceInstall(deviceId: string, gameId: string): void {
    const key = this.deviceInstallKey(deviceId, gameId);
    const nextInstalled = !this.deviceInstalledKeys().has(key);

    this.deviceInstallingKeys.update((keys) => new Set(keys).add(key));
    const errors = new Map(this.deviceInstallErrors());
    errors.delete(key);
    this.deviceInstallErrors.set(errors);

    this.curator.setStorageDeviceInstall(deviceId, gameId, nextInstalled).subscribe({
      next: () => {
        this.deviceInstallingKeys.update((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        });
        this.deviceInstalledKeys.update((keys) => {
          const next = new Set(keys);
          if (nextInstalled) {
            next.add(key);
          } else {
            next.delete(key);
          }
          return next;
        });
      },
      error: (response: { status: number }) => {
        this.deviceInstallingKeys.update((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        });
        const message =
          response.status === 404
            ? `Storage device '${deviceId}' not found — install state can only be set for a device Curator already knows about.`
            : 'Unable to update install state.';
        const next = new Map(this.deviceInstallErrors());
        next.set(key, message);
        this.deviceInstallErrors.set(next);
      },
    });
  }

  protected measuredSizesFor(gameId: string): MeasuredSizeResponse[] {
    return this.measuredSizesByGame().get(gameId) ?? [];
  }

  protected toggleMeasuredSizePanel(gameId: string): void {
    if (this.expandedSizeGameId() === gameId) {
      this.expandedSizeGameId.set(null);
      return;
    }

    this.expandedSizeGameId.set(gameId);
    this.measuredSizePlatform.set('PS5');
    this.measuredSizeValue.set(null);
    this.measuredSizeError.set(null);

    if (this.measuredSizesByGame().has(gameId)) {
      return;
    }
    this.measuredSizesLoading.set(true);
    this.curator.getMeasuredSizes(gameId).subscribe({
      next: (sizes) => {
        this.measuredSizesLoading.set(false);
        this.measuredSizesByGame.update((byGame) => new Map(byGame).set(gameId, sizes));
      },
      error: () => {
        this.measuredSizesLoading.set(false);
        this.measuredSizeError.set('Unable to load measured sizes for this game.');
      },
    });
  }

  protected submitMeasuredSize(gameId: string): void {
    const sizeGb = this.measuredSizeValue();
    if (sizeGb === null || sizeGb <= 0) {
      this.measuredSizeError.set('Enter a size in GB greater than 0.');
      return;
    }

    const platform = this.measuredSizePlatform();
    this.measuredSizeSaving.set(true);
    this.measuredSizeError.set(null);
    this.curator.setMeasuredSize(gameId, platform, sizeGb).subscribe({
      next: (saved) => {
        this.measuredSizeSaving.set(false);
        this.measuredSizeValue.set(null);
        this.measuredSizesByGame.update((byGame) => {
          const next = new Map(byGame);
          const existing = (next.get(gameId) ?? []).filter((size) => size.platform !== platform);
          next.set(gameId, [...existing, saved].sort((a, b) => a.platform.localeCompare(b.platform)));
          return next;
        });
      },
      error: () => {
        this.measuredSizeSaving.set(false);
        this.measuredSizeError.set('Unable to save this measured size.');
      },
    });
  }
}
