import { AppUrls } from '../app-paths';
import { NavLabels, PageTitles } from '../../shared/page-title';

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
  { path: AppUrls.home, label: NavLabels.home, icon: 'lucideHouse', exact: true, reachableWithoutSigningIn: true, tab: true },
  { path: AppUrls.catalog, label: PageTitles.catalog, icon: 'lucideLayoutGrid', reachableWithoutSigningIn: true, tab: true },
  { path: AppUrls.library, label: PageTitles.library, icon: 'lucideLibraryBig', tab: true },
  { path: AppUrls.collections, label: PageTitles.collections, icon: 'lucideFolderOpen', tab: true },
  { path: AppUrls.profile, label: PageTitles.profile, icon: 'lucideCircleUser' },
  { path: AppUrls.account, label: PageTitles.account, icon: 'lucideSettings' },
  { path: AppUrls.consoles, label: PageTitles.consoles, icon: 'lucideHardDrive' },
  { path: AppUrls.adminEnrichment, label: PageTitles.enrichmentRuns, icon: 'lucideSparkles', adminOnly: true },
  { path: AppUrls.faq, label: PageTitles.faq, icon: 'lucideCircleHelp', reachableWithoutSigningIn: true },
  { path: AppUrls.privacy, label: NavLabels.privacy, icon: 'lucideShield', reachableWithoutSigningIn: true },
];

export const ANONYMOUS_NAV_LINKS: NavLink[] = PRIMARY_NAV_LINKS.filter(
  (link) => link.reachableWithoutSigningIn === true,
);
