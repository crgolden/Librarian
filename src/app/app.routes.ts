import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { HomeComponent } from '../home/home.component';
import { PsnSettingsComponent } from '../psn/psn-settings.component';
import { psnStatusResolver } from '../psn/psn-status.resolver';
import { CatalogComponent } from '../catalog/catalog.component';
import { CollectionsComponent } from '../collections/collections.component';
import { LibraryComponent } from '../library/library.component';
import { FaqComponent } from '../faq/faq.component';
import { PrivacyComponent } from '../privacy/privacy.component';
import { NotFoundComponent } from '../not-found/not-found.component';
import { ProfileViewComponent } from '../profile/profile-view.component';
import { ProfileFollowersComponent } from '../profile/profile-followers.component';
import { ProfileFollowingComponent } from '../profile/profile-following.component';
import { ProfileSettingsComponent } from '../profile/profile-settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Librarian' },
  {
    path: 'psn',
    component: PsnSettingsComponent,
    canActivate: [authGuard],
    resolve: { status: psnStatusResolver },
    title: 'PlayStation Network',
  },
  { path: 'catalog', component: CatalogComponent, canActivate: [authGuard], title: 'Catalog' },
  { path: 'collections', component: CollectionsComponent, canActivate: [authGuard], title: 'Collections' },
  { path: 'collections/:sub', component: CollectionsComponent, canActivate: [authGuard], title: 'Collections' },
  { path: 'library', component: LibraryComponent, canActivate: [authGuard], title: 'Library' },
  { path: 'library/:sub', component: LibraryComponent, canActivate: [authGuard], title: 'Library' },
  { path: 'profile', component: ProfileViewComponent, canActivate: [authGuard], title: 'Profile' },
  { path: 'profile/followers', component: ProfileFollowersComponent, canActivate: [authGuard], title: 'Followers' },
  { path: 'profile/following', component: ProfileFollowingComponent, canActivate: [authGuard], title: 'Following' },
  { path: 'profile/settings', component: ProfileSettingsComponent, canActivate: [authGuard], title: 'Profile Settings' },
  { path: 'u/:sub', component: ProfileViewComponent, canActivate: [authGuard], title: 'Profile' },
  { path: 'u/:sub/followers', component: ProfileFollowersComponent, canActivate: [authGuard], title: 'Followers' },
  { path: 'u/:sub/following', component: ProfileFollowingComponent, canActivate: [authGuard], title: 'Following' },
  { path: 'faq', component: FaqComponent, title: 'FAQ' },
  { path: 'privacy', component: PrivacyComponent, title: 'Privacy Policy' },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' },
];
