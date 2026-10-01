import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  inject,
  signal,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonGhostSmallDirective, ButtonPrimarySmallDirective } from '@crgolden/modules/primitives';
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
import { AppUrls } from '../app-paths';
import { loginUrlReturningTo } from '../../shared/bff-contract';
import { NavLabels } from '../../shared/page-title';
import { PRIMARY_NAV_LINKS } from './nav-links';
import { NAV_RAIL_SIGNOUT_ID, SiteNavIdPrefixes } from './site-nav-ids';

export const SIGN_OUT_FALLBACK_HREF = '#';

@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive, NgIcon, ButtonPrimarySmallDirective, ButtonGhostSmallDirective],
  templateUrl: './site-nav.component.html',
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

  @ViewChild('sheet') private readonly sheet?: ElementRef<HTMLDialogElement>;

  protected readonly sheetOpen = signal(false);

  protected readonly idPrefixes = SiteNavIdPrefixes;
  protected readonly navLabels = NavLabels;

  protected readonly railSignoutId = NAV_RAIL_SIGNOUT_ID;

  protected readonly signOutHref = computed(() => this.auth.logoutUrl() ?? SIGN_OUT_FALLBACK_HREF);

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
    return current && current !== AppUrls.home ? loginUrlReturningTo(current) : this.auth.loginUrl;
  });

  private urlWhereSheetOpened: string | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter((event) => event.urlAfterRedirects !== this.urlWhereSheetOpened),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeSheet());
  }

  protected openSheet(): void {
    this.sheet?.nativeElement.showModal();
    this.sheetOpen.set(true);
    this.urlWhereSheetOpened = this.router.url;
  }

  protected closeSheet(): void {
    const element = this.sheet?.nativeElement;
    if (element?.open === true) {
      element.close();
    }
    this.sheetOpen.set(false);
    this.urlWhereSheetOpened = null;
  }

  protected dismissOnBackdrop(event: MouseEvent): void {
    if (event.target === this.sheet?.nativeElement) {
      this.closeSheet();
    }
  }
}
