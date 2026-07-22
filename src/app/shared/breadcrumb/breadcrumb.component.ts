import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last/current item — it renders as plain text, not a link. */
  link?: string | string[];
}

/** Small "go up" trail for nested sub-routes (e.g. /profile/followers, /library/:sub) — the
 * persistent sitewide nav (SiteNavComponent) handles top-level cross-navigation; this handles
 * going up one level from a nested route back to its logical parent. Each hosting page computes
 * its own `items`, since the parent link often depends on a route param (e.g. which user's
 * library a viewer-mode page belongs to). */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  @Input({ required: true }) items: BreadcrumbItem[] = [];
}
