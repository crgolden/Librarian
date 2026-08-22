import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorArchive,
  phosphorBooks,
  phosphorCards,
  phosphorHouse,
  phosphorPlugsConnected,
  phosphorSignOut,
  phosphorSparkle,
  phosphorUserCircle,
} from '@ng-icons/phosphor-icons/regular';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

export interface NavLink {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

/** Single source of truth for the primary sitewide destinations — consumed by both the desktop
 * header nav and the mobile bottom tab bar so the two never drift out of sync (see DESIGN.md
 * Do's and Don'ts: don't duplicate nav-link data between desktop and mobile markup). */
export const PRIMARY_NAV_LINKS: NavLink[] = [
  { path: '/', label: 'Home', icon: 'phosphorHouse', exact: true },
  { path: '/catalog', label: 'Catalog', icon: 'phosphorCards' },
  { path: '/collections', label: 'Collections', icon: 'phosphorArchive' },
  { path: '/library', label: 'Library', icon: 'phosphorBooks' },
  { path: '/profile', label: 'Profile', icon: 'phosphorUserCircle' },
];

@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive, NgIcon, AvatarComponent],
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      phosphorArchive,
      phosphorBooks,
      phosphorCards,
      phosphorHouse,
      phosphorPlugsConnected,
      phosphorSignOut,
      phosphorSparkle,
      phosphorUserCircle,
    }),
  ],
})
export class SiteNavComponent {
  protected readonly auth = inject(AuthService);
  protected readonly admin = inject(AdminService);
  protected readonly links = PRIMARY_NAV_LINKS;
  private readonly router = inject(Router);

  private readonly lastNavigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  protected readonly loginHref = computed(() => {
    this.lastNavigation();
    const current = this.router.url;
    return current && current !== '/'
      ? `${this.auth.loginUrl}?returnTo=${encodeURIComponent(current)}`
      : this.auth.loginUrl;
  });

}
