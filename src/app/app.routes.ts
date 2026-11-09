import { Routes } from '@angular/router';

export const routes: Routes = [
  // Redireccionamos la raíz al login por defecto
  { path: '', redirectTo: 'login', pathMatch: 'full' }, 
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'progreso',
    loadComponent: () => import('./features/progreso/progreso.component').then(m => m.ProgresoComponent)
  },
  {
    path: 'perfil',
    loadComponent: () => import('./features/perfil/perfil.component').then(m => m.PerfilComponent)
  },
  {
    path: 'comunidad',
    loadComponent: () => import('./features/comunidad/comunidad.component').then(m => m.ComunidadComponent)
  }
];