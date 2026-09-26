import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonGhostDirective,
  ButtonPrimaryDirective,
  CardDirective,
  PageSectionDirective,
} from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark, lucideCalendarDays, lucideDownload, lucideLayers } from '@ng-icons/lucide';
import { AuthService } from '../auth/auth.service';
import { HomeSummary } from './home.resolver';
import { AppUrls, RouteDataKeys } from '../app/app-paths';
import {
  BROWSE_CATALOG_LABEL,
  COLLECTION_ENTRIES_TERM,
  LIBRARY_SUMMARY_HEADING,
  LIBRARY_TOTAL_TERM,
  MANAGE_PSN_LINK_LABEL,
  MY_LIBRARY_LABEL,
  PITCH_HEADING,
  SIGN_IN_PROMPT,
  TOTALS_UNAVAILABLE_MESSAGE,
  UNLINKED_NOTICE,
} from './home.messages';
import { NavLabels, PageTitles } from '../shared/page-title';
import { CatalogMetaDirective, StampLabelDirective } from '../shared/primitives/typography';

export interface HomeAction {
  path: string;
  label: string;
}

const MY_LIBRARY: HomeAction = { path: AppUrls.library, label: MY_LIBRARY_LABEL };
const BROWSE_CATALOG: HomeAction = { path: AppUrls.catalog, label: BROWSE_CATALOG_LABEL };
const COLLECTIONS: HomeAction = { path: AppUrls.collections, label: PageTitles.collections };
const MANAGE_PSN_LINK: HomeAction = { path: AppUrls.account, label: MANAGE_PSN_LINK_LABEL };

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    NgIcon,
    ButtonGhostDirective,
    ButtonPrimaryDirective,
    CardDirective,
    PageSectionDirective,
    CatalogMetaDirective,
    StampLabelDirective,
  ],
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
  protected readonly signInPrompt = SIGN_IN_PROMPT;
  protected readonly signInLabel = NavLabels.signIn;
  protected readonly pitchHeading = PITCH_HEADING;
  protected readonly librarySummaryHeading = LIBRARY_SUMMARY_HEADING;
  protected readonly libraryTotalTerm = LIBRARY_TOTAL_TERM;
  protected readonly collectionsTerm = PageTitles.collections;
  protected readonly collectionEntriesTerm = COLLECTION_ENTRIES_TERM;
  protected readonly unlinkedNotice = UNLINKED_NOTICE;
  protected readonly totalsUnavailableMessage = TOTALS_UNAVAILABLE_MESSAGE;

  private readonly psnLinkIsTheNextStep = computed(() => this.summary()?.linked === false);

  protected readonly actions = computed<HomeAction[]>(() =>
    this.psnLinkIsTheNextStep()
      ? [MANAGE_PSN_LINK, MY_LIBRARY, BROWSE_CATALOG, COLLECTIONS]
      : [MY_LIBRARY, BROWSE_CATALOG, COLLECTIONS, MANAGE_PSN_LINK],
  );

  ngOnInit(): void {
    this.summary.set(this.route.snapshot.data[RouteDataKeys.summary] as HomeSummary | null);
  }
}
