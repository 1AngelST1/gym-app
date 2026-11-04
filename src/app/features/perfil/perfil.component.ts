import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html'
})
export class PerfilComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  
  private historialCol = collection(this.firestore, 'historial');
  private listenerHistorial: any;

  totalEntrenamientos = 0;
  totalMinutos = 0;

  // ==========================================
  // VARIABLES PARA EL MODAL DE HISTORIAL
  // ==========================================
  mostrarModalHistorial = false;
  filtroActivo: 'semana' | 'mes' | 'ano' | 'todo' = 'mes'; 
  historialCompleto: any[] = [];
  historialVisualizado: any[] = [];
  
  // NUEVO: Variable para ver los detalles de un entrenamiento pasado
  sesionSeleccionada: any = null; 

  constructor() {
    this.listenerHistorial = onSnapshot(this.historialCol, (snapshot) => {
      let entrenamientosCompletados = 0;
      let segundosTotales = 0;
      this.historialCompleto = []; 

      snapshot.forEach((doc) => {
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

  ngOnDestroy() {
    if (this.listenerHistorial) {
      this.listenerHistorial();
    }
  }

  // ==========================================
  // LÓGICA DEL MODAL DE HISTORIAL
  // ==========================================
  abrirHistorial() {
    this.mostrarModalHistorial = true;
    this.sesionSeleccionada = null; // Asegura que abra en la lista
  }

  cerrarHistorial() {
    this.mostrarModalHistorial = false;
    this.sesionSeleccionada = null;
  }

  aplicarFiltro(filtro: 'semana' | 'mes' | 'ano' | 'todo') {
    this.filtroActivo = filtro;
    this.sesionSeleccionada = null; // Si cambia el filtro, vuelve a la lista
    
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

  // NUEVO: Funciones para navegar entre la lista y los detalles
  verDetallesSesion(sesion: any) {
    this.sesionSeleccionada = sesion;
  }

  volverAListaHistorial() {
    this.sesionSeleccionada = null;
  }
}