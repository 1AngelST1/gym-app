import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProgresoComponent } from './features/progreso/progreso.component';
import { PerfilComponent } from './features/perfil/perfil.component';
import { ComunidadComponent } from './features/comunidad/comunidad.component'; 

export const routes: Routes = [
  { path: '', component: DashboardComponent }, 
  { path: 'progreso', component: ProgresoComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'comunidad', component: ComunidadComponent }
];