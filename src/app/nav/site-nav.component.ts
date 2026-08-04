import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';

export interface NavLink {
  path: string;
  label: string;
  exact?: boolean;
}

/** Single source of truth for the primary sitewide destinations — consumed by both the desktop
 * header nav and the mobile bottom tab bar so the two never drift out of sync (see DESIGN.md
 * Do's and Don'ts: don't duplicate nav-link data between desktop and mobile markup). */
export const PRIMARY_NAV_LINKS: NavLink[] = [
  { path: '/', label: 'Home', exact: true },
  { path: '/catalog', label: 'Catalog' },
  { path: '/collections', label: 'Collections' },
  { path: '/library', label: 'Library' },
  { path: '/profile', label: 'Profile' },
];

@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteNavComponent {
  protected readonly auth = inject(AuthService);
  protected readonly admin = inject(AdminService);
  protected readonly links = PRIMARY_NAV_LINKS;

  constructor() {
    // Proactively resolved for any authenticated user (not just once they visit /admin/enrichment) so the
    // nav link below appears without anyone needing to already know the URL. ensureLoaded() is idempotent
    // -- cached after its first real GET /me call, so this effect re-running as isAuthenticated() settles
    // doesn't cost extra requests.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.admin.ensureLoaded().subscribe();
      }
    });
  }
}
