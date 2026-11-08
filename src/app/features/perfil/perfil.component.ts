import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Firestore, collection, onSnapshot, query, where } from '@angular/fire/firestore';

// CORRECCIÓN 1: La ruta correcta (solo dos ../)
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html'
})
export class PerfilComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private authService = inject(AuthService); 
  private router = inject(Router);           
  
  private historialCol = collection(this.firestore, 'historial');
  private listenerHistorial: any;

  totalEntrenamientos = 0;
  totalMinutos = 0;

  mostrarModalHistorial = false;
  filtroActivo: 'semana' | 'mes' | 'ano' | 'todo' = 'mes'; 
  historialCompleto: any[] = [];
  historialVisualizado: any[] = [];
  sesionSeleccionada: any = null; 

  constructor() {
    const userId = this.authService.currentUserUid;

    if (userId) {
      const consultaUsuario = query(this.historialCol, where('userId', '==', userId));

      // CORRECCIÓN 2: Le especificamos (snapshot: any) para quitar el error de "desconocido"
      this.listenerHistorial = onSnapshot(consultaUsuario, (snapshot: any) => {
        let entrenamientosCompletados = 0;
        let segundosTotales = 0;
        this.historialCompleto = []; 

        // También le ponemos (doc: any)
        snapshot.forEach((doc: any) => {
          const sesion: any = { id: doc.id, ...doc.data() };
          
          if (sesion['estado'] === 'completado') {
            entrenamientosCompletados++;
            if (sesion['duracionSegundos']) {
              segundosTotales += sesion['duracionSegundos'];
            }
            this.historialCompleto.push(sesion);
          }
        });
        
        this.totalEntrenamientos = entrenamientosCompletados;
        this.totalMinutos = Math.floor(segundosTotales / 60);

        this.historialCompleto.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
        
        this.aplicarFiltro(this.filtroActivo);
      });
    }
  }

  ngOnDestroy() {
    if (this.listenerHistorial) {
      this.listenerHistorial();
    }
  }

  async cerrarSesion() {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error: any) { // CORRECCIÓN 3: (error: any) para quitar el error de "desconocido"
      console.error('Error al cerrar sesión:', error);
    }
  }

  abrirHistorial() {
    this.mostrarModalHistorial = true;
    this.sesionSeleccionada = null; 
  }

  cerrarHistorial() {
    this.mostrarModalHistorial = false;
    this.sesionSeleccionada = null;
  }

  aplicarFiltro(filtro: 'semana' | 'mes' | 'ano' | 'todo') {
    this.filtroActivo = filtro;
    this.sesionSeleccionada = null; 
    
    if (filtro === 'todo') {
      this.historialVisualizado = [...this.historialCompleto];
      return;
    }

    const fechaLimite = new Date();
    if (filtro === 'semana') fechaLimite.setDate(fechaLimite.getDate() - 7);
    if (filtro === 'mes') fechaLimite.setMonth(fechaLimite.getMonth() - 1);
    if (filtro === 'ano') fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);

    this.historialVisualizado = this.historialCompleto.filter(sesion => {
      const fechaSesion = new Date(sesion.fechaCompleta);
      return fechaSesion >= fechaLimite;
    });
  }

  verDetallesSesion(sesion: any) {
    this.sesionSeleccionada = sesion;
  }

  volverAListaHistorial() {
    this.sesionSeleccionada = null;
  }
}