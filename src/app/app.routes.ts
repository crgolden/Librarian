import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { HomeComponent } from '../home/home.component';
import { PsnSettingsComponent } from '../psn/psn-settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Librarian' },
  { path: 'psn', component: PsnSettingsComponent, canActivate: [authGuard], title: 'PlayStation Network' },
  { path: '**', redirectTo: '' },
];
