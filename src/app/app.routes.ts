import { Routes } from '@angular/router';
import { AppPaths, AppUrls, FollowListKinds, RouteDataKeys } from './app-paths';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { ownSubRedirectGuard } from '../profile/own-sub-redirect.guard';
import { followListResolver } from '../profile/follow-list.resolver';
import { profileResolver } from '../profile/profile.resolver';
import { profileSettingsResolver } from '../profile/profile-settings.resolver';
import { HomeComponent } from '../home/home.component';
import { homeSummaryResolver } from '../home/home.resolver';
import { psnStatusResolver } from '../psn/psn-status.resolver';
import { catalogGenresResolver, catalogResolver } from '../catalog/catalog.resolver';
import { catalogDetailResolver } from '../catalog/catalog-detail.resolver';
import { ownerCollectionsResolver, viewerCollectionsResolver } from '../collections/collections.resolver';
import { consolesResolver } from '../consoles/consoles.resolver';
import { publicCollectionResolver } from '../public-collection/public-collection.resolver';
import { libraryResolver } from '../library/library.resolver';
import { psPlusRotationResolver } from '../library/ps-plus/ps-plus.resolver';
import { latestEnrichmentRunResolver } from '../admin/admin-enrichment.resolver';
import { PageTitles, SITE_NAME } from '../shared/page-title';

export const routes: Routes = [
  { path: AppPaths.home, component: HomeComponent, resolve: { [RouteDataKeys.summary]: homeSummaryResolver }, title: SITE_NAME },
  {
    path: AppPaths.account,
    loadComponent: () => import('../psn/psn-settings.component').then((m) => m.PsnSettingsComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.status]: psnStatusResolver },
    title: PageTitles.account,
  },
  { path: AppPaths.psn, redirectTo: AppPaths.account, pathMatch: 'full' },
  {
    path: AppPaths.catalog,
    loadComponent: () => import('../catalog/catalog.component').then((m) => m.CatalogComponent),
    resolve: { [RouteDataKeys.catalog]: catalogResolver, [RouteDataKeys.genres]: catalogGenresResolver },
    title: PageTitles.catalog,
  },
  {
    path: AppPaths.catalogGame,
    loadComponent: () => import('../catalog/catalog-detail.component').then((m) => m.CatalogDetailComponent),
    resolve: { [RouteDataKeys.game]: catalogDetailResolver },
    title: PageTitles.game,
  },
  {
    path: AppPaths.collections,
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.collections]: ownerCollectionsResolver, [RouteDataKeys.genres]: catalogGenresResolver },
    title: PageTitles.collections,
  },
  {
    path: AppPaths.collectionDefinition,
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.collections]: ownerCollectionsResolver, [RouteDataKeys.genres]: catalogGenresResolver },
    title: PageTitles.collections,
  },
  {
    path: AppPaths.userCollections,
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard, ownSubRedirectGuard([AppUrls.collections])],
    resolve: { [RouteDataKeys.collections]: viewerCollectionsResolver, [RouteDataKeys.genres]: catalogGenresResolver },
    title: PageTitles.collections,
  },
  {
    path: AppPaths.consoles,
    loadComponent: () => import('../consoles/consoles.component').then((m) => m.ConsolesComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.consoles]: consolesResolver, [RouteDataKeys.genres]: catalogGenresResolver },
    title: PageTitles.consoles,
  },
  {
    path: AppPaths.sharedCollection,
    loadComponent: () =>
      import('../public-collection/public-collection.component').then((m) => m.PublicCollectionComponent),
    resolve: { [RouteDataKeys.collection]: publicCollectionResolver },
    title: PageTitles.sharedCollection,
  },
  {
    path: AppPaths.library,
    loadComponent: () => import('../library/library.component').then((m) => m.LibraryComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.library]: libraryResolver },
    title: PageTitles.library,
  },
  {
    path: AppPaths.psPlus,
    loadComponent: () => import('../library/ps-plus/ps-plus.component').then((m) => m.PsPlusComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.rotation]: psPlusRotationResolver },
    title: PageTitles.psPlus,
  },
  {
    path: AppPaths.userLibrary,
    loadComponent: () => import('../library/library.component').then((m) => m.LibraryComponent),
    canActivate: [authGuard, ownSubRedirectGuard([AppUrls.library])],
    resolve: { [RouteDataKeys.library]: libraryResolver },
    title: PageTitles.library,
  },
  {
    path: AppPaths.profile,
    loadComponent: () => import('../profile/profile-view.component').then((m) => m.ProfileViewComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.profile]: profileResolver },
    title: PageTitles.profile,
  },
  {
    path: AppPaths.profileFollowers,
    loadComponent: () => import('../profile/profile-followers.component').then((m) => m.ProfileFollowersComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.followers]: followListResolver(FollowListKinds.followers) },
    title: PageTitles.followers,
  },
  {
    path: AppPaths.profileFollowing,
    loadComponent: () => import('../profile/profile-following.component').then((m) => m.ProfileFollowingComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.following]: followListResolver(FollowListKinds.following) },
    title: PageTitles.following,
  },
  {
    path: AppPaths.profileSettings,
    loadComponent: () => import('../profile/profile-settings.component').then((m) => m.ProfileSettingsComponent),
    canActivate: [authGuard],
    resolve: { [RouteDataKeys.settings]: profileSettingsResolver },
    title: PageTitles.profileSettings,
  },
  {
    path: AppPaths.userProfile,
    loadComponent: () => import('../profile/profile-view.component').then((m) => m.ProfileViewComponent),
    canActivate: [authGuard, ownSubRedirectGuard([AppUrls.profile])],
    resolve: { [RouteDataKeys.profile]: profileResolver },
    title: PageTitles.profile,
  },
  {
    path: AppPaths.userFollowers,
    loadComponent: () => import('../profile/profile-followers.component').then((m) => m.ProfileFollowersComponent),
    canActivate: [authGuard, ownSubRedirectGuard([AppUrls.profile, FollowListKinds.followers])],
    resolve: { [RouteDataKeys.followers]: followListResolver(FollowListKinds.followers) },
    title: PageTitles.followers,
  },
  {
    path: AppPaths.userFollowing,
    loadComponent: () => import('../profile/profile-following.component').then((m) => m.ProfileFollowingComponent),
    canActivate: [authGuard, ownSubRedirectGuard([AppUrls.profile, FollowListKinds.following])],
    resolve: { [RouteDataKeys.following]: followListResolver(FollowListKinds.following) },
    title: PageTitles.following,
  },
  {
    path: AppPaths.adminEnrichment,
    loadComponent: () => import('../admin/admin-enrichment.component').then((m) => m.AdminEnrichmentComponent),
    canActivate: [authGuard, adminGuard],
    resolve: { [RouteDataKeys.latestRun]: latestEnrichmentRunResolver },
    title: PageTitles.enrichmentRuns,
  },
  {
    path: AppPaths.faq,
    loadComponent: () => import('../faq/faq.component').then((m) => m.FaqComponent),
    title: PageTitles.faq,
  },
  {
    path: AppPaths.privacy,
    loadComponent: () => import('../privacy/privacy.component').then((m) => m.PrivacyComponent),
    title: PageTitles.privacy,
  },
  {
    path: AppPaths.notFound,
    loadComponent: () => import('../not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: PageTitles.pageNotFound,
  },
];
