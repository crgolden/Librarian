import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { ownSubRedirectGuard } from '../profile/own-sub-redirect.guard';
import { followListResolver } from '../profile/follow-list.resolver';
import { profileResolver } from '../profile/profile.resolver';
import { HomeComponent } from '../home/home.component';
import { PsnSettingsComponent } from '../psn/psn-settings.component';
import { psnStatusResolver } from '../psn/psn-status.resolver';
import { CatalogComponent } from '../catalog/catalog.component';
import { catalogResolver } from '../catalog/catalog.resolver';
import { CollectionsComponent } from '../collections/collections.component';
import { ownerCollectionsResolver, viewerCollectionsResolver } from '../collections/collections.resolver';
import { ConsolesComponent } from '../consoles/consoles.component';
import { consolesResolver } from '../consoles/consoles.resolver';
import { PublicCollectionComponent } from '../public-collection/public-collection.component';
import { publicCollectionResolver } from '../public-collection/public-collection.resolver';
import { LibraryComponent } from '../library/library.component';
import { libraryResolver } from '../library/library.resolver';
import { FaqComponent } from '../faq/faq.component';
import { PrivacyComponent } from '../privacy/privacy.component';
import { NotFoundComponent } from '../not-found/not-found.component';
import { ProfileViewComponent } from '../profile/profile-view.component';
import { ProfileFollowersComponent } from '../profile/profile-followers.component';
import { ProfileFollowingComponent } from '../profile/profile-following.component';
import { ProfileSettingsComponent } from '../profile/profile-settings.component';
import { AdminEnrichmentComponent } from '../admin/admin-enrichment.component';
import { latestEnrichmentRunResolver } from '../admin/admin-enrichment.resolver';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Librarian' },
  {
    path: 'psn',
    component: PsnSettingsComponent,
    canActivate: [authGuard],
    resolve: { status: psnStatusResolver },
    title: 'PlayStation Network',
  },
  {
    path: 'catalog',
    component: CatalogComponent,
    canActivate: [authGuard],
    resolve: { catalog: catalogResolver },
    title: 'Catalog',
  },
  {
    path: 'collections',
    component: CollectionsComponent,
    canActivate: [authGuard],
    resolve: { collections: ownerCollectionsResolver },
    title: 'Collections',
  },
  {
    path: 'collections/d/:definitionId',
    component: CollectionsComponent,
    canActivate: [authGuard],
    resolve: { collections: ownerCollectionsResolver },
    title: 'Collections',
  },
  {
    path: 'collections/:sub',
    component: CollectionsComponent,
    canActivate: [authGuard, ownSubRedirectGuard(['/collections'])],
    resolve: { collections: viewerCollectionsResolver },
    title: 'Collections',
  },
  {
    path: 'consoles',
    component: ConsolesComponent,
    canActivate: [authGuard],
    resolve: { consoles: consolesResolver },
    title: 'Consoles & Storage',
  },
  {
    path: 'c/:slug',
    component: PublicCollectionComponent,
    resolve: { collection: publicCollectionResolver },
    title: 'Shared Collection',
  },
  {
    path: 'library',
    component: LibraryComponent,
    canActivate: [authGuard],
    resolve: { library: libraryResolver },
    title: 'Library',
  },
  {
    path: 'library/:sub',
    component: LibraryComponent,
    canActivate: [authGuard, ownSubRedirectGuard(['/library'])],
    resolve: { library: libraryResolver },
    title: 'Library',
  },
  {
    path: 'profile',
    component: ProfileViewComponent,
    canActivate: [authGuard],
    resolve: { profile: profileResolver },
    title: 'Profile',
  },
  {
    path: 'profile/followers',
    component: ProfileFollowersComponent,
    canActivate: [authGuard],
    resolve: { followers: followListResolver('followers') },
    title: 'Followers',
  },
  {
    path: 'profile/following',
    component: ProfileFollowingComponent,
    canActivate: [authGuard],
    resolve: { following: followListResolver('following') },
    title: 'Following',
  },
  { path: 'profile/settings', component: ProfileSettingsComponent, canActivate: [authGuard], title: 'Profile Settings' },
  {
    path: 'u/:sub',
    component: ProfileViewComponent,
    canActivate: [authGuard, ownSubRedirectGuard(['/profile'])],
    resolve: { profile: profileResolver },
    title: 'Profile',
  },
  {
    path: 'u/:sub/followers',
    component: ProfileFollowersComponent,
    canActivate: [authGuard, ownSubRedirectGuard(['/profile', 'followers'])],
    resolve: { followers: followListResolver('followers') },
    title: 'Followers',
  },
  {
    path: 'u/:sub/following',
    component: ProfileFollowingComponent,
    canActivate: [authGuard, ownSubRedirectGuard(['/profile', 'following'])],
    resolve: { following: followListResolver('following') },
    title: 'Following',
  },
  {
    path: 'admin/enrichment',
    component: AdminEnrichmentComponent,
    canActivate: [authGuard, adminGuard],
    resolve: { latestRun: latestEnrichmentRunResolver },
    title: 'Enrichment Runs',
  },
  { path: 'faq', component: FaqComponent, title: 'FAQ' },
  { path: 'privacy', component: PrivacyComponent, title: 'Privacy Policy' },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' },
];
