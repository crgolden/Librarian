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
  { path: 'library', component: LibraryComponent, canActivate: [authGuard], title: 'Library' },
  { path: 'faq', component: FaqComponent, title: 'FAQ' },
  { path: 'privacy', component: PrivacyComponent, title: 'Privacy Policy' },
  { path: '**', redirectTo: '' },
];
