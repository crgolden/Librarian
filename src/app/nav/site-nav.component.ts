import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleHelp,
  lucideCircleUser,
  lucideEllipsis,
  lucideFolderOpen,
  lucideHardDrive,
  lucideHouse,
  lucideLayoutGrid,
  lucideLibraryBig,
  lucideLogOut,
  lucideSettings,
  lucideShield,
  lucideSparkles,
  lucideX,
} from '@ng-icons/lucide';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

export type NavIcon =
  | 'lucideCircleHelp'
  | 'lucideCircleUser'
  | 'lucideFolderOpen'
  | 'lucideHardDrive'
  | 'lucideHouse'
  | 'lucideLayoutGrid'
  | 'lucideLibraryBig'
  | 'lucideSettings'
  | 'lucideShield'
  | 'lucideSparkles';

export interface NavLink {
  path: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
  reachableWithoutSigningIn?: boolean;
  tab?: boolean;
  adminOnly?: boolean;
}

export const PRIMARY_NAV_LINKS: NavLink[] = [
  { path: '/', label: 'Home', icon: 'lucideHouse', exact: true, reachableWithoutSigningIn: true, tab: true },
  { path: '/catalog', label: 'Catalog', icon: 'lucideLayoutGrid', reachableWithoutSigningIn: true, tab: true },
  { path: '/library', label: 'Library', icon: 'lucideLibraryBig', tab: true },
  { path: '/collections', label: 'Collections', icon: 'lucideFolderOpen', tab: true },
  { path: '/profile', label: 'Profile', icon: 'lucideCircleUser' },
  { path: '/account', label: 'Account', icon: 'lucideSettings' },
  { path: '/consoles', label: 'Consoles & Storage', icon: 'lucideHardDrive' },
  { path: '/admin/enrichment', label: 'Enrichment Runs', icon: 'lucideSparkles', adminOnly: true },
  { path: '/faq', label: 'FAQ', icon: 'lucideCircleHelp', reachableWithoutSigningIn: true },
  { path: '/privacy', label: 'Privacy', icon: 'lucideShield', reachableWithoutSigningIn: true },
];

export const ANONYMOUS_NAV_LINKS: NavLink[] = PRIMARY_NAV_LINKS.filter(
  (link) => link.reachableWithoutSigningIn === true,
);

@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive, NgIcon, AvatarComponent],
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideCircleHelp,
      lucideCircleUser,
      lucideEllipsis,
      lucideFolderOpen,
      lucideHardDrive,
      lucideHouse,
      lucideLayoutGrid,
      lucideLibraryBig,
      lucideLogOut,
      lucideSettings,
      lucideShield,
      lucideSparkles,
      lucideX,
    }),
  ],
})
export class SiteNavComponent {
  protected readonly auth = inject(AuthService);
  protected readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sheet = viewChild<ElementRef<HTMLDialogElement>>('sheet');

  protected readonly sheetOpen = signal(false);

  protected readonly visibleLinks = computed(() => {
    const isAdmin = this.admin.isAdmin();
    const signedIn = this.auth.isAuthenticated();
    return PRIMARY_NAV_LINKS.filter((link) => {
      if (link.adminOnly === true && !isAdmin) return false;
      return signedIn || link.reachableWithoutSigningIn === true;
    });
  });

  protected readonly tabLinks = computed(() => this.visibleLinks().filter((link) => link.tab === true));

  protected readonly sheetLinks = computed(() => this.visibleLinks().filter((link) => link.tab !== true));

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

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeSheet());
  }

  protected openSheet(): void {
    this.sheet()?.nativeElement.showModal();
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    const element = this.sheet()?.nativeElement;
    if (element?.open === true) {
      element.close();
    }
    this.sheetOpen.set(false);
  }

  protected dismissOnBackdrop(event: MouseEvent): void {
    if (event.target === this.sheet()?.nativeElement) {
      this.closeSheet();
    }
  }
}
