import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark, lucideCalendarDays, lucideDownload, lucideLayers } from '@ng-icons/lucide';
import { AuthService } from '../auth/auth.service';
import { HomeSummary } from './home.resolver';

export interface HomeAction {
  path: string;
  label: string;
}

const MY_LIBRARY: HomeAction = { path: '/library', label: 'My Library' };
const BROWSE_CATALOG: HomeAction = { path: '/catalog', label: 'Browse Catalog' };
const COLLECTIONS: HomeAction = { path: '/collections', label: 'Collections' };
const MANAGE_PSN_LINK: HomeAction = { path: '/account', label: 'Manage PSN Link' };

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgIcon],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideBookmark,
      lucideCalendarDays,
      lucideDownload,
      lucideLayers,
    }),
  ],
})
export class HomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly summary = signal<HomeSummary | null>(null);

  private readonly psnLinkIsTheNextStep = computed(() => this.summary()?.linked === false);

  protected readonly actions = computed<HomeAction[]>(() =>
    this.psnLinkIsTheNextStep()
      ? [MANAGE_PSN_LINK, MY_LIBRARY, BROWSE_CATALOG, COLLECTIONS]
      : [MY_LIBRARY, BROWSE_CATALOG, COLLECTIONS, MANAGE_PSN_LINK],
  );

  ngOnInit(): void {
    this.summary.set(this.route.snapshot.data['summary'] as HomeSummary | null);
  }
}
