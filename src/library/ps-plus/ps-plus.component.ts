import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PsPlusRotationResponse, PsPlusTitleResponse } from '../../curator/curator.models';
import { BreadcrumbComponent, BreadcrumbItem } from '../../app/shared/breadcrumb/breadcrumb.component';
import { storeProductUrl } from '../../catalog/store-links';
import { ResolvedPsPlusRotation } from './ps-plus.resolver';

export interface RotationList {
  id: string;
  heading: string;
  empty: string;
  titles: PsPlusTitleResponse[];
}

const BREADCRUMB: BreadcrumbItem[] = [{ label: 'Library', link: ['/library'] }, { label: 'PlayStation Plus' }];

@Component({
  selector: 'app-ps-plus',
  imports: [DatePipe, BreadcrumbComponent, RouterLink],
  templateUrl: './ps-plus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsPlusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected readonly rotation = signal<PsPlusRotationResponse | null>(null);
  protected readonly notLinked = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly lists = signal<RotationList[]>([]);
  protected readonly breadcrumbItems = BREADCRUMB;

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['rotation'] as ResolvedPsPlusRotation;
    if (resolved.status === 'not-linked') {
      this.notLinked.set(true);
      return;
    }
    if (resolved.status === 'error') {
      this.error.set('Unable to load the PlayStation Plus rotation.');
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
