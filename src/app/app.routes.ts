import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProgresoComponent } from './features/progreso/progreso.component';
import { PerfilComponent } from './features/perfil/perfil.component';
import { ComunidadComponent } from './features/comunidad/comunidad.component'; 
import { LoginComponent } from './features/auth/login/login.component';

export const routes: Routes = [
  // Redireccionamos la raíz al login por defecto
  { path: '', redirectTo: 'login', pathMatch: 'full' }, 
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent }, 
  { path: 'progreso', component: ProgresoComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'comunidad', component: ComunidadComponent }
];