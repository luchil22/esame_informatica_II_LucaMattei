import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '',                redirectTo: 'esplora', pathMatch: 'full' },
  { path: 'login',           loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'esplora',         loadComponent: () => import('./pages/esplora/esplora.component').then(m => m.EsploraComponent) },
  { path: 'pronto-soccorso', loadComponent: () => import('./pages/pronto-soccorso/pronto-soccorso.component').then(m => m.ProntoSoccorsoComponent) },
  { path: 'diritti',         loadComponent: () => import('./pages/diritti/diritti.component').then(m => m.DiritiComponent) },
  { path: 'dashboard',       loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
  { path: 'referti',         loadComponent: () => import('./pages/referti/referti.component').then(m => m.RefertiComponent), canActivate: [authGuard] },
  { path: '**',              redirectTo: 'esplora' },
];
  