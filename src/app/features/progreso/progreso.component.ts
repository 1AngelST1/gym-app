import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { MapaMuscularComponent } from '../../shared/components/mapa-muscular/mapa-muscular.component';

@Component({
  selector: 'app-progreso',
  standalone: true,
  imports: [CommonModule, MapaMuscularComponent],
  templateUrl: './progreso.component.html'
})
export class ProgresoComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private historialCol = collection(this.firestore, 'historial');
  private listenerHistorial: any;

  // Variables Gamificación
  nivelGeneral = 'Novato';
  genero: 'masculino' | 'femenino' = 'masculino';
  
  niveles = {
    pecho: 'base',
    abdomen: 'base',
    brazoIzq: 'base',
    brazoDer: 'base',
    piernas: 'base'
  };

  // Variables Interfaz
  historialReciente: any[] = [];
  mostrarModalDetalle = false;
  sesionSeleccionada: any = null;
  
  // Variables Gráfica de Barras Dinámica
  datosGrafica: { diaLetra: string, fechaStr: string, volumenKg: number, porcentaje: number, hoy: boolean }[] = [];

  constructor() {
    this.listenerHistorial = onSnapshot(this.historialCol, (snapshot) => {
      let contadorPecho = 0;
      let contadorPierna = 0;
      let contadorBrazo = 0;
      let historialCompleto: any[] = [];

      snapshot.forEach((doc) => {
        const sesion: any = { id: doc.id, ...doc.data() };
        if (sesion['estado'] === 'completado') {
          historialCompleto.push(sesion);
          const nombre = sesion.rutinaNombre?.toLowerCase() || '';
          const setsTotales = sesion.totalSets || 0;

          if (nombre.includes('pecho') || nombre.includes('empuje')) contadorPecho += setsTotales;
          if (nombre.includes('pierna') || nombre.includes('gluteo')) contadorPierna += setsTotales;
          if (nombre.includes('brazo') || nombre.includes('bicep') || nombre.includes('tricep') || nombre.includes('hombro')) contadorBrazo += setsTotales;
        }
      });

      // 1. Calcular Nivel General
      const totalEntrenamientos = historialCompleto.length;
      if (totalEntrenamientos < 5) this.nivelGeneral = 'Novato';
      else if (totalEntrenamientos < 15) this.nivelGeneral = 'Principiante';
      else if (totalEntrenamientos < 30) this.nivelGeneral = 'Intermedio';
      else if (totalEntrenamientos < 50) this.nivelGeneral = 'Avanzado';
      else this.nivelGeneral = 'Élite';

      // 2. Calcular Niveles Musculares
      this.niveles.pecho = this.calcularNivelMusculo(contadorPecho);
      this.niveles.piernas = this.calcularNivelMusculo(contadorPierna);
      this.niveles.brazoIzq = this.calcularNivelMusculo(contadorBrazo);
      this.niveles.brazoDer = this.calcularNivelMusculo(contadorBrazo);

      // 3. Obtener Historial Reciente (Últimos 2)
      historialCompleto.sort((a, b) => new Date(b.fechaCompleta).getTime() - new Date(a.fechaCompleta).getTime());
      this.historialReciente = historialCompleto.slice(0, 2);

      // 4. Construir Gráfica Dinámica (Últimos 7 días)
      this.construirGrafica(historialCompleto);
    });
  }

  ngOnDestroy() {
    if (this.listenerHistorial) this.listenerHistorial();
  }

  calcularNivelMusculo(cantidadSets: number): string {
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

  construirGrafica(historial: any[]) {
    this.datosGrafica = [];
    const diasSemanaNombres = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    let volumenMaximo = 0;

    // Generar los últimos 7 días hacia atrás
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const fechaStr = fecha.toLocaleDateString('es-MX');
      const diaLetra = diasSemanaNombres[fecha.getDay()];
      
      // Buscar si entrenaste ese día y sumar volumen (kg x reps)
      let volumenDia = 0;
      const sesionesDelDia = historial.filter(h => h.fechaCorta === fechaStr);
      
      sesionesDelDia.forEach(sesion => {
        if (sesion.ejercicios) {
          sesion.ejercicios.forEach((ej: any) => {
            ej.setsActivos.forEach((set: any) => {
              if (set.completado && set.kg && set.reps) {
                volumenDia += (set.kg * set.reps);
              }
            });
          });
        }
      });

      if (volumenDia > volumenMaximo) volumenMaximo = volumenDia;

      this.datosGrafica.push({
        diaLetra: diaLetra,
        fechaStr: fechaStr,
        volumenKg: volumenDia,
        porcentaje: 0, 
        hoy: i === 0 
      });
    }

    // Calcular el porcentaje de altura para la gráfica
    this.datosGrafica.forEach(dia => {
      // Damos un 10% mínimo visual si hay volumen pero es muy bajo, o 0 si no entrenó
      dia.porcentaje = dia.volumenKg > 0 ? Math.max((dia.volumenKg / volumenMaximo) * 100, 10) : 0;
    });
  }

  cambiarGenero() {
    this.genero = this.genero === 'masculino' ? 'femenino' : 'masculino';
  }

  abrirDetalle(sesion: any) {
    this.sesionSeleccionada = sesion;
    this.mostrarModalDetalle = true;
  }

  cerrarDetalle() {
    this.mostrarModalDetalle = false;
    this.sesionSeleccionada = null;
  }

  obtenerEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pierna') || n.includes('gluteo')) return '🦵';
    if (n.includes('espalda')) return '🦍';
    return '💪';
  }
}