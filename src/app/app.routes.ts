import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProgresoComponent } from './features/progreso/progreso.component';
import { PerfilComponent } from './features/perfil/perfil.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent }, // La pantalla principal
  { path: 'progreso', component: ProgresoComponent },
  { path: 'perfil', component: PerfilComponent }
];