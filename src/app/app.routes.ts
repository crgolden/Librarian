import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { ownSubRedirectGuard } from '../profile/own-sub-redirect.guard';
import { followListResolver } from '../profile/follow-list.resolver';
import { profileResolver } from '../profile/profile.resolver';
import { HomeComponent } from '../home/home.component';
import { psnStatusResolver } from '../psn/psn-status.resolver';
import { catalogGenresResolver, catalogResolver } from '../catalog/catalog.resolver';
import { catalogDetailResolver } from '../catalog/catalog-detail.resolver';
import { ownerCollectionsResolver, viewerCollectionsResolver } from '../collections/collections.resolver';
import { consolesResolver } from '../consoles/consoles.resolver';
import { publicCollectionResolver } from '../public-collection/public-collection.resolver';
import { libraryResolver } from '../library/library.resolver';
import { latestEnrichmentRunResolver } from '../admin/admin-enrichment.resolver';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Librarian' },
  {
    path: 'psn',
    loadComponent: () => import('../psn/psn-settings.component').then((m) => m.PsnSettingsComponent),
    canActivate: [authGuard],
    resolve: { status: psnStatusResolver },
    title: 'PlayStation Network',
  },
  {
    path: 'catalog',
    loadComponent: () => import('../catalog/catalog.component').then((m) => m.CatalogComponent),
    resolve: { catalog: catalogResolver, genres: catalogGenresResolver },
    title: 'Catalog',
  },
  {
    path: 'catalog/:gameId',
    loadComponent: () => import('../catalog/catalog-detail.component').then((m) => m.CatalogDetailComponent),
    resolve: { game: catalogDetailResolver },
    title: 'Game',
  },
  {
    path: 'collections',
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard],
    resolve: { collections: ownerCollectionsResolver, genres: catalogGenresResolver },
    title: 'Collections',
  },
  {
    path: 'collections/d/:definitionId',
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard],
    resolve: { collections: ownerCollectionsResolver, genres: catalogGenresResolver },
    title: 'Collections',
  },
  {
    path: 'collections/:sub',
    loadComponent: () => import('../collections/collections.component').then((m) => m.CollectionsComponent),
    canActivate: [authGuard, ownSubRedirectGuard(['/collections'])],
    resolve: { collections: viewerCollectionsResolver, genres: catalogGenresResolver },
    title: 'Collections',
  },
  {
    path: 'consoles',
    loadComponent: () => import('../consoles/consoles.component').then((m) => m.ConsolesComponent),
    canActivate: [authGuard],
    resolve: { consoles: consolesResolver, genres: catalogGenresResolver },
    title: 'Consoles & Storage',
  },
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('../public-collection/public-collection.component').then((m) => m.PublicCollectionComponent),
    resolve: { collection: publicCollectionResolver },
    title: 'Shared Collection',
  },
  {
    path: 'library',
    loadComponent: () => import('../library/library.component').then((m) => m.LibraryComponent),
    canActivate: [authGuard],
    resolve: { library: libraryResolver },
    title: 'Library',
  },
  {
    path: 'library/:sub',
    loadComponent: () => import('../library/library.component').then((m) => m.LibraryComponent),
    canActivate: [authGuard, ownSubRedirectGuard(['/library'])],
    resolve: { library: libraryResolver },
    title: 'Library',
  },
  {
    path: 'profile',
    loadComponent: () => import('../profile/profile-view.component').then((m) => m.ProfileViewComponent),
    canActivate: [authGuard],
    resolve: { profile: profileResolver },
    title: 'Profile',
  },
  {
    path: 'profile/followers',
    loadComponent: () => import('../profile/profile-followers.component').then((m) => m.ProfileFollowersComponent),
    canActivate: [authGuard],
    resolve: { followers: followListResolver('followers') },
    title: 'Followers',
  },
  {
    path: 'profile/following',
    loadComponent: () => import('../profile/profile-following.component').then((m) => m.ProfileFollowingComponent),
    canActivate: [authGuard],
    resolve: { following: followListResolver('following') },
    title: 'Following',
  },
  {
    path: 'profile/settings',
    loadComponent: () => import('../profile/profile-settings.component').then((m) => m.ProfileSettingsComponent),
    canActivate: [authGuard],
    title: 'Profile Settings',
  },
  {
    path: 'u/:sub',
    loadComponent: () => import('../profile/profile-view.component').then((m) => m.ProfileViewComponent),
    canActivate: [authGuard, ownSubRedirectGuard(['/profile'])],
    resolve: { profile: profileResolver },
    title: 'Profile',
  },
  {
    path: 'u/:sub/followers',
    loadComponent: () => import('../profile/profile-followers.component').then((m) => m.ProfileFollowersComponent),
    canActivate: [authGuard, ownSubRedirectGuard(['/profile', 'followers'])],
    resolve: { followers: followListResolver('followers') },
    title: 'Followers',
  },
  {
    path: 'u/:sub/following',
    loadComponent: () => import('../profile/profile-following.component').then((m) => m.ProfileFollowingComponent),
    canActivate: [authGuard, ownSubRedirectGuard(['/profile', 'following'])],
    resolve: { following: followListResolver('following') },
    title: 'Following',
  },
  {
    path: 'admin/enrichment',
    loadComponent: () => import('../admin/admin-enrichment.component').then((m) => m.AdminEnrichmentComponent),
    canActivate: [authGuard, adminGuard],
    resolve: { latestRun: latestEnrichmentRunResolver },
    title: 'Enrichment Runs',
  },
  {
    path: 'faq',
    loadComponent: () => import('../faq/faq.component').then((m) => m.FaqComponent),
    title: 'FAQ',
  },
  {
    path: 'privacy',
    loadComponent: () => import('../privacy/privacy.component').then((m) => m.PrivacyComponent),
    title: 'Privacy Policy',
  },
  {
    path: '**',
    loadComponent: () => import('../not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page Not Found',
  },
];
