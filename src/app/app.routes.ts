import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { HomeComponent } from '../home/home.component';
import { PsnSettingsComponent } from '../psn/psn-settings.component';
import { CatalogComponent } from '../catalog/catalog.component';
import { CollectionsComponent } from '../collections/collections.component';
import { LibraryComponent } from '../library/library.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Librarian' },
  { path: 'psn', component: PsnSettingsComponent, canActivate: [authGuard], title: 'PlayStation Network' },
  { path: 'catalog', component: CatalogComponent, canActivate: [authGuard], title: 'Catalog' },
  { path: 'collections', component: CollectionsComponent, canActivate: [authGuard], title: 'Collections' },
  { path: 'library', component: LibraryComponent, canActivate: [authGuard], title: 'Library' },
  { path: '**', redirectTo: '' },
];
