import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-progreso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progreso.component.html'
})
export class ProgresoComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  
  // 1. Apuntamos a la colección correcta: "historial"
  private historialCol = collection(this.firestore, 'historial');
  private listenerHistorial: any;

  niveles = {
    pecho: 'base',
    abdomen: 'base',
    brazoIzq: 'base',
    brazoDer: 'base',
    piernas: 'base'
  };

  // Variables para la interfaz
  historialReciente: any[] = [];
  mostrarModalDetalle = false;
  sesionSeleccionada: any = null;

  constructor() {
    // 2. Solución al error de Angular 19: Listener en el constructor
    this.listenerHistorial = onSnapshot(this.historialCol, (snapshot) => {
      let contadorPecho = 0;
      let contadorPierna = 0;
      let contadorBrazo = 0;
      let historialCompleto: any[] = [];

      snapshot.forEach((doc) => {
        const sesion: any = { id: doc.id, ...doc.data() };
        
        // Solo contamos lo que realmente entrenaste (completado)
        if (sesion['estado'] === 'completado') {
          historialCompleto.push(sesion);
          
          const nombre = sesion.rutinaNombre?.toLowerCase() || '';
          
          // Contamos cuántos sets totales hiciste de ese músculo
          const setsTotales = sesion.totalSets || 0;

          if (nombre.includes('pecho') || nombre.includes('empuje')) contadorPecho += setsTotales;
          if (nombre.includes('pierna') || nombre.includes('gluteo')) contadorPierna += setsTotales;
          if (nombre.includes('brazo') || nombre.includes('bicep') || nombre.includes('tricep') || nombre.includes('hombro')) contadorBrazo += setsTotales;
        }
      });

      // Actualizamos los niveles del muñeco
      this.niveles.pecho = this.calcularNivel(contadorPecho);
      this.niveles.piernas = this.calcularNivel(contadorPierna);
      this.niveles.brazoIzq = this.calcularNivel(contadorBrazo);
      this.niveles.brazoDer = this.calcularNivel(contadorBrazo);

      // 3. Ordenamos para obtener los 2 más recientes
      historialCompleto.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
      this.historialReciente = historialCompleto.slice(0, 2);
    });
  }

  ngOnDestroy() {
    if (this.listenerHistorial) {
      this.listenerHistorial();
    }
  }

  calcularNivel(cantidadSets: number): string {
    if (cantidadSets >= 50) return 'diamante';
    if (cantidadSets >= 30) return 'oro';
    if (cantidadSets >= 15) return 'plata';
    if (cantidadSets >= 5) return 'cobre';
    return 'base';
  }

  obtenerClasesMusculo(nivel: string): string {
    const clasesBase = 'stroke-[0.5] transition-colors cursor-pointer duration-500 ';
    switch (nivel) {
      case 'diamante': return clasesBase + 'fill-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] stroke-cyan-200 hover:fill-cyan-300';
      case 'oro': return clasesBase + 'fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] stroke-yellow-200 hover:fill-yellow-400';
      case 'plata': return clasesBase + 'fill-zinc-300 stroke-white hover:fill-white';
      case 'cobre': return clasesBase + 'fill-orange-700 stroke-orange-400 hover:fill-orange-600';
      default: return 'fill-zinc-800 stroke-zinc-700 stroke-1 hover:fill-zinc-700 transition-colors cursor-pointer';
    }
  }

  // 4. Lógica del modal de detalle
  abrirDetalle(sesion: any) {
    this.sesionSeleccionada = sesion;
    this.mostrarModalDetalle = true;
  }

  cerrarDetalle() {
    this.mostrarModalDetalle = false;
    this.sesionSeleccionada = null;
  }

  // Función para determinar el emoji dependiendo del nombre
  obtenerEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pierna') || n.includes('gluteo')) return '🦵';
    if (n.includes('espalda')) return '🦍';
    return '💪';
  }
}