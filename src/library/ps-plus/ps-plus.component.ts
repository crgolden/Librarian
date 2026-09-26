import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { PsPlusRotationResponse, PsPlusTitleResponse } from '../../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../../app/shared/breadcrumb/breadcrumb.component';
import { storeProductUrl } from '../../catalog/store-links';
import { ResolvedPsPlusRotation } from './ps-plus.resolver';
import { AppUrls, RouteDataKeys } from '../../app/app-paths';
import { PageTitles } from '../../shared/page-title';
import { ResolvedStatuses } from '../../shared/resolved-status';
import { PS_PLUS_ROTATION_LOAD_ERROR } from '../library.messages';
import { CatalogMetaDirective, CatalogTitleDirective, SpineLabelDirective } from '../../shared/primitives/typography';

export interface RotationList {
  id: string;
  heading: string;
  empty: string;
  titles: PsPlusTitleResponse[];
}

const BREADCRUMB: BreadcrumbItem[] = [{ label: PageTitles.library, link: [AppUrls.library] }, { label: PageTitles.psPlus }];

@Component({
  selector: 'app-ps-plus',
  imports: [
    DatePipe,
    BreadcrumbComponent,
    RouterLink,
    PageSectionDirective,
    CardDirective,
    CatalogMetaDirective,
    CatalogTitleDirective,
    SpineLabelDirective,
  ],
  templateUrl: './ps-plus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsPlusComponent implements OnInit {
  protected readonly appUrls = AppUrls;

  private readonly route = inject(ActivatedRoute);

  protected readonly rotation = signal<PsPlusRotationResponse | null>(null);
  protected readonly notLinked = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly lists = signal<RotationList[]>([]);
  protected readonly breadcrumbItems = BREADCRUMB;

  ngOnInit(): void {
    const resolved = this.route.snapshot.data[RouteDataKeys.rotation] as ResolvedPsPlusRotation;
    if (resolved.status === ResolvedStatuses.notLinked) {
      this.notLinked.set(true);
      return;
    }
    if (resolved.status === ResolvedStatuses.error) {
      this.error.set(PS_PLUS_ROTATION_LOAD_ERROR);
      return;
    }
    this.rotation.set(resolved.rotation);
    this.lists.set([
      {
        id: 'unclaimed',
        heading: 'Not yet claimed',
        empty: 'Every catalog title is already in your library.',
        titles: resolved.rotation.unclaimed,
      },
      {
        id: 'leaving',
        heading: 'Leaving the catalog',
        empty: 'Nothing you can claim has left since the last walk.',
        titles: resolved.rotation.leaving,
      },
      {
        id: 'added',
        heading: 'Added since the last walk',
        empty: 'Nothing new since the last walk.',
        titles: resolved.rotation.added,
      },
      {
        id: 'lapsed',
        heading: 'Claimed, now inactive',
        empty: 'None of your PlayStation Plus titles have lapsed.',
        titles: resolved.rotation.lapsed,
      },
    ]);
  }

  protected storeUrl(title: PsPlusTitleResponse): string | null {
    return storeProductUrl(title.store_product_id);
  }
}
